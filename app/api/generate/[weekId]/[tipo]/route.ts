// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

type Params = { weekId: string; tipo: "reel" | "post" | "stories" | "carrossel" | "live" };

// ---------- Helpers ----------
function extractText(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;

  const out = resp?.output ?? resp?.outputs ?? resp?.data?.output;
  let acc = "";
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content ?? item?.contents;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (typeof c?.text === "string") acc += c.text;
          else if (c?.type === "output_text" && typeof c?.text === "string") acc += c.text;
          else if (typeof c?.content === "string") acc += c.content;
        }
      } else if (typeof item?.text === "string") {
        acc += item.text;
      }
    }
  }
  if (!acc && typeof resp?.text === "string") acc = resp.text;
  if (!acc && resp?.message?.content) {
    const mc = resp.message.content;
    if (Array.isArray(mc)) for (const m of mc) if (typeof m?.text === "string") acc += m.text;
    else if (typeof mc === "string") acc = mc;
  }
  return acc;
}

const WEEKDAYS = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"] as const;
type Weekday = typeof WEEKDAYS[number];

function sortDias(dias: any[]) {
  const order = new Map(WEEKDAYS.map((d, i) => [d, i]));
  return [...dias].sort((a, b) => (order.get(a?.dia) ?? 99) - (order.get(b?.dia) ?? 99));
}

// ---------- Schemas ----------
function storiesJSONSchema() {
  return {
    name: "stories_schema",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        titulo_serie: { type: "string" },
        resumo_semana: { type: "string" },
        dias: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              dia: { type: "string", enum: WEEKDAYS as unknown as string[] },
              titulo: { type: "string" },
              roteiro: { type: "string" },
              enquetes: { type: "array", items: { type: "string" }, default: [] },
              perguntas: { type: "array", items: { type: "string" }, default: [] },
              cta: { type: "string" }
            },
            required: ["dia", "titulo", "roteiro", "cta"]
          }
        }
      },
      required: ["titulo_serie", "dias"]
    },
    strict: true as const
  };
}

function markdownSchemaFor(tipo: Params["tipo"]) {
  return {
    name: `${tipo}_markdown`,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { markdown: { type: "string" } },
      required: ["markdown"]
    },
    strict: true as const
  };
}

// ---------- Prompts ----------
function systemPrompt(tipo: Params["tipo"]) {
  return [
    "Você é redator médico do Dr. Caio Torres (emagrecimento).",
    "Tom: confiança serena, didático, empático, linguagem simples.",
    "Evite jargões; quando usar, explique em 1 linha.",
    "Não prometa resultados absolutos. Inclua aviso de saúde quando adequado.",
    `Formato solicitado: ${tipo}. Responda SEMPRE em PT-BR.`,
  ].join("\n");
}

function userPrompt(
  tipo: Params["tipo"],
  tema: string,
  subtemas: string[],
  promptGeral?: string,
  promptFormato?: string
) {
  const base = [
    `Tema central da semana: "${tema}".`,
    subtemas?.length ? `Subtemas: ${subtemas.join(" | ")}` : `Sem subtemas adicionais.`,
    promptGeral ? `Diretriz geral: ${promptGeral}` : ``,
    promptFormato ? `Diretriz do formato: ${promptFormato}` : ``,
  ].filter(Boolean).join("\n");

  if (tipo === "stories") {
    return [
      base,
      "",
      "Regras FIXAS de programação dos Stories:",
      "- Segunda-feira: sempre abrir com CAIXA DE PERGUNTAS (sobre o tema da semana).",
      "- Quinta-feira: lembrar da LIVE (com CTA claro para definir lembrete).",
      "",
      "Agora gere a série completa de 7 dias (Segunda → Domingo), obedecendo:",
      "- Cada dia deve conter: dia, título curto, roteiro (texto corrido dos slides), 0–2 enquetes, 0–2 perguntas de caixinha e 1 CTA.",
      "- Seja prático e acionável; 3–5 pontos/ações implícitas no roteiro.",
      "- Mantenha consistência com o tema e subtemas.",
      "",
      "IMPORTANTE: Entregue no formato do JSON Schema solicitado (titulo_serie, resumo_semana, dias[7])."
    ].join("\n");
  }

  return [
    base,
    "Entregue o conteúdo final em MARKDOWN pronto para colar."
  ].join("\n");
}

// ---------- Handler ----------
export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { weekId, tipo } = params;

    if (!["reel", "post", "stories", "carrossel", "live"].includes(tipo)) {
      return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
    }

    // Semana
    const supa = supabaseServer();
    const { data: week, error: werr } = await supa
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (werr || !week) {
      return NextResponse.json({ ok: false, error: "Semana não encontrada." }, { status: 404 });
    }

    // Treinamento (mais recente)
    const { data: training } = await supa
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mapKey: Record<string, keyof typeof training> = {
      reel: "prompt_reels",
      post: "prompt_post",
      carrossel: "prompt_carrossel",
      live: "prompt_live",
      stories: "prompt_stories",
    };
    const promptFormato = training ? (training as any)[mapKey[tipo]] : "";
    const promptGeral = training?.prompt_geral || "";

    const tema = week.tema_central || "";
    const subtemas = Array.isArray(week.subtemas) ? week.subtemas : [];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const system = systemPrompt(tipo);
    const user = userPrompt(tipo, tema, subtemas, promptGeral, promptFormato);

    const body: any = {
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_output_tokens: tipo === "live" ? 5500 : 2200
    };

    if (tipo === "stories") {
      // Força JSON estruturado com 7 dias
      const { name, schema, strict } = storiesJSONSchema();
      body.text = { format: "json_schema", json_schema: { name, schema, strict } };
    } else {
      // demais formatos: markdown simples
      const { name, schema, strict } = markdownSchemaFor(tipo);
      body.text = { format: "json_schema", json_schema: { name, schema, strict } };
    }

    const resp = await (openai as any).responses.create(body);
    const raw = extractText(resp);
    if (!raw || !raw.trim()) {
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado do modelo." }, { status: 400 });
    }

    // Tenta parsear JSON (quando pedimos schema). Se falhar, cai como markdown simples
    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { markdown: raw };
    }

    // Se for stories e o modelo teimar, repara a ordem e checa contagem
    if (tipo === "stories" && payload?.dias && Array.isArray(payload.dias)) {
      payload.dias = sortDias(payload.dias);
      if (payload.dias.length !== 7) {
        // Proteção mínima: se vier menos, devolve erro amigável
        return NextResponse.json(
          { ok: false, error: `Modelo retornou ${payload.dias.length}/7 dias. Tente gerar novamente.` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ ok: true, payload }, { status: 200 });
  } catch (err: any) {
    const msg = err?.message || "Erro interno";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
