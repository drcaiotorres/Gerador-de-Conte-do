// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type StoriesSlide = {
  kind: "texto" | "enquete" | "pergunta" | "quiz" | "cta";
  caption: string;
  options?: string[] | null;
};

type StoriesDay = {
  weekday: string;   // "Domingo"..."Sábado"
  focus: string;     // foco do dia
  slides: StoriesSlide[];
};

type StoriesWeek = {
  week_title: string;
  days: StoriesDay[]; // 7 dias
};

// ---------- pequenos utilitários ----------
function pick<T>(v: T | undefined | null, def: T): T {
  return v === undefined || v === null ? def : v;
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // tenta extrair bloco JSON entre chaves
    const m = raw.match(/{[\s\S]*}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackStories(tema: string): StoriesWeek {
  const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const simples = (d: string): StoriesDay => ({
    weekday: d,
    focus: `${tema} — passo prático`,
    slides: [
      { kind: "texto", caption: `Hoje: ${tema} na prática` },
      { kind: "pergunta", caption: "Qual sua maior dificuldade?", options: null },
      { kind: "enquete", caption: "Você segue isso hoje?", options: ["Sim", "Ainda não"] },
      { kind: "cta", caption: "Salve e me mande 'AJUDA' na DM pra um passo a passo." },
    ],
  });
  return { week_title: `Stories da semana — ${tema}`, days: dias.map(simples) };
}

async function getWeekAndTraining(weekId: string) {
  const supabase = supabaseServer();

  // Semana
  const { data: week, error: weekErr } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", weekId)
    .maybeSingle();

  if (weekErr) throw new Error(`Erro ao buscar semana: ${weekErr.message}`);
  if (!week) throw new Error("Semana não encontrada.");

  // Treinamento (pega o mais recente)
  const { data: training, error: trErr } = await supabase
    .from("trainings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (trErr) throw new Error(`Erro ao buscar treinamento: ${trErr.message}`);

  return { week, training };
}

// ---------- prompts ----------
function buildStoriesSystemPrompt(custom?: string) {
  const base =
    "Você escreve roteiros de Instagram Stories claros, curtos e envolventes, com foco em educação em saúde e emagrecimento. Mantenha tom: confiança serena, didático, empático, sem hype. Frases curtas. Sem promessas absolutas. Sempre indique que é conteúdo informativo e não substitui avaliação individual.";

  if (custom && custom.trim()) return `${base}\n\nContexto extra do autor:\n${custom.trim()}`;
  return base;
}

function buildStoriesUserPrompt(tema: string, subtemas: string[]) {
  return `
Tema central da semana: ${tema}
Subtemas (pautas de apoio): ${subtemas && subtemas.length ? subtemas.join(", ") : "—"}

Crie um PLANO DE 7 DIAS de Stories (Dom→Sáb). Para cada dia:
- "weekday": dia da semana por extenso (Domingo...Sábado)
- "focus": frase breve do foco do dia
- "slides": 3–6 cards
  * cada slide tem:
    - "kind": "texto" | "enquete" | "pergunta" | "quiz" | "cta"
    - "caption": texto curto (máx. ~20 palavras)
    - "options": só quando for "enquete" ou "quiz" (2–4 opções)
- evite blocos longos; priorize frases curtas
- mantenha linguagem simples
- 1 CTA leve por dia (ex.: "responda a caixinha", "salve", "me chame na DM")
- Avise implicitamente que é conteúdo informativo

Respeite estritamente o schema pedido (JSON).`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { weekId: string; tipo: string } }
) {
  try {
    const { weekId, tipo } = params;

    if (!weekId || !tipo) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros ausentes." },
        { status: 400 }
      );
    }

    // Por enquanto focamos no STORIES; os demais seguem seu fluxo já existente do app.
    if (tipo !== "stories") {
      return NextResponse.json(
        { ok: false, error: "Formato não suportado nesta rota (ajuste aplicado apenas para 'stories')." },
        { status: 400 }
      );
    }

    const { week, training } = await getWeekAndTraining(weekId);
    const tema = pick<string>(week?.tema_central, "Tema da semana");
    const subtemas = Array.isArray(week?.subtemas) ? (week.subtemas as string[]) : [];

    const systemPrompt = buildStoriesSystemPrompt(training?.prompt_stories || training?.prompt_geral);
    const userPrompt = buildStoriesUserPrompt(tema, subtemas);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // JSON Schema para garantir consistência
    const schema: any = {
      type: "object",
      additionalProperties: false,
      properties: {
        week_title: { type: "string" },
        days: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["weekday", "focus", "slides"],
            properties: {
              weekday: { type: "string" },
              focus: { type: "string" },
              slides: {
                type: "array",
                minItems: 3,
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["kind", "caption"],
                  properties: {
                    kind: { type: "string", enum: ["texto", "enquete", "pergunta", "quiz", "cta"] },
                    caption: { type: "string" },
                    options: {
                      type: ["array", "null"],
                      items: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      required: ["week_title", "days"]
    };

    // Corpo da requisição (compat com SDK)
    const body: any = {
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "stories_week",
          schema,
          strict: true
        }
      },
      max_output_tokens: 2200
    };

    const resp = await (openai as any).responses.create(body);

    // Tenta extrair texto/JSON de forma robusta
    const raw =
      (resp?.output_text as string) ||
      (resp?.content?.[0]?.text as string) ||
      JSON.stringify(resp);

    let parsed = safeJsonParse<StoriesWeek>(raw);

    if (!parsed || !parsed?.days || parsed.days.length !== 7) {
      // fallback seguro (nunca devolve vazio)
      parsed = fallbackStories(tema);
    }

    // Normaliza mínimas garantias
    parsed.week_title = pick(parsed.week_title, `Stories — ${tema}`);
    parsed.days = parsed.days.map((d, i) => ({
      weekday: pick(d.weekday, ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][i] || "Dia"),
      focus: pick(d.focus, tema),
      slides: (d.slides || []).map(s => ({
        kind: (["texto","enquete","pergunta","quiz","cta"] as const).includes(s.kind as any)
          ? s.kind
          : "texto",
        caption: pick(s.caption, "Texto"),
        options: s.kind === "enquete" || s.kind === "quiz" ? pick(s.options ?? null, ["Sim","Não"]) : null
      })).slice(0, 8)
    })).slice(0, 7);

    return NextResponse.json({
      ok: true,
      payload: {
        tipo: "stories",
        tema,
        data: parsed
      }
    });
  } catch (err: any) {
    console.error("ERRO /generate/[weekId]/[tipo]:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Falha inesperada." },
      { status: 500 }
    );
  }
}
