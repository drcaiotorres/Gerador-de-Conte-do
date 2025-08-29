import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

type Params = { weekId: string; tipo: "reel" | "post" | "stories" | "carrossel" | "live" };

export const runtime = "nodejs";

/** Schema mínimo e seguro para cada tipo. Expandimos se precisar depois. */
function schemaFor(tipo: Params["tipo"]) {
  if (tipo === "stories") {
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
                titulo: { type: "string" },
                roteiro: { type: "string" },     // texto corrido dos slides
                enquetes: {
                  type: "array",
                  items: { type: "string" },
                  default: []
                },
                perguntas: {
                  type: "array",
                  items: { type: "string" },
                  default: []
                },
                cta: { type: "string" }
              },
              required: ["titulo", "roteiro"]
            }
          }
        },
        required: ["titulo_serie", "dias"]
      },
      strict: true as const
    };
  }

  // Para os outros formatos, por enquanto retornamos markdown simples
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

/** Prompt de sistema enxuto e consistente */
function systemPrompt(tipo: Params["tipo"]) {
  return [
    `Você é um redator médico focado em emagrecimento. Tom: confiança serena, didático, empático, linguagem simples.`,
    `Gere conteúdo de alto valor, prático e acionável. Evite jargão; quando usar, explique em 1 linha.`,
    `Não prometa resultados absolutos. Inclua aviso de saúde quando adequado.`,
    `Formato solicitado: ${tipo}.`
  ].join("\n");
}

/** Monta o pedido conforme o tipo */
function userPrompt(tipo: Params["tipo"], tema: string, subtemas: string[], promptGeral?: string, promptFormato?: string) {
  const base = [
    `Tema central da semana: "${tema}".`,
    subtemas?.length ? `Subtemas: ${subtemas.join(" | ")}` : `Sem subtemas adicionais.`,
    promptGeral ? `Diretriz geral: ${promptGeral}` : ``,
    promptFormato ? `Diretriz do formato: ${promptFormato}` : ``,
  ].filter(Boolean).join("\n");

  if (tipo === "stories") {
    return [
      base,
      `Crie uma mini-série para 7 dias (segunda a domingo), cada dia com:`,
      `- título curto;`,
      `- roteiro (texto corrido dos slides);`,
      `- 0–2 enquetes curtas;`,
      `- 0–2 perguntas de caixinha;`,
      `- CTA adequado.`,
      `Inclua "titulo_serie" e "resumo_semana".`
    ].join("\n");
  }

  // Demais formatos: devolva markdown simples (schema pequeno acima)
  return [
    base,
    `Gere um conteúdo em markdown pronto para colar.`
  ].join("\n");
}

/** Extrai texto/JSON do Responses API com tolerância */
function extractText(resp: any): string {
  // SDK novo fornece output_text
  if (resp?.output_text && typeof resp.output_text === "string") {
    return resp.output_text;
  }
  // fallback manual
  try {
    const first = resp?.output?.[0]?.content?.[0];
    if (first?.type === "output_text" && typeof first?.text === "string") {
      return first.text;
    }
  } catch {}
  return "";
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { weekId, tipo } = params;

    if (!["reel", "post", "stories", "carrossel", "live"].includes(tipo)) {
      return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
    }

    const supa = supabaseServer();
    const { data: week, error: werr } = await supa
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (werr || !week) {
      return NextResponse.json({ ok: false, error: "Semana não encontrada." }, { status: 404 });
    }

    // Carrega prompts de treinamento (opcional)
    const { data: training } = await supa
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const promptGeral = training?.prompt_geral || "";
    const promptFormato =
      tipo === "reel" ? training?.prompt_reels :
      tipo === "post" ? training?.prompt_post :
      tipo === "carrossel" ? training?.prompt_carrossel :
      tipo === "live" ? training?.prompt_live :
      tipo === "stories" ? training?.prompt_stories : "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sys = systemPrompt(tipo);
    const usr = userPrompt(tipo, week.tema_central, week.subtemas ?? [], promptGeral, promptFormato);
    const { name, schema, strict } = schemaFor(tipo);

    // ⚠️ Uso correto do Responses API: 'text.format' (NADA de 'response_format')
    const body: any = {
      model: MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: usr }
      ],
      text: {
        format: "json_schema",
        json_schema: { name, schema, strict }
      },
      max_output_tokens: tipo === "live" ? 5500 : 1800
    };

    const resp = await (openai as any).responses.create(body);
    const raw = extractText(resp);
    if (!raw.trim()) {
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado do modelo." }, { status: 400 });
    }

    // Tenta parsear JSON do structured output
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback: quando não vier JSON válido por algum motivo, embrulha em objeto simples
      parsed = { markdown: raw };
    }

    return NextResponse.json({ ok: true, payload: parsed }, { status: 200 });
  } catch (err: any) {
    const msg = err?.message || "Erro interno";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
