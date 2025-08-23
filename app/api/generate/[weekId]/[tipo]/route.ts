// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 180;

const TIPOS = new Set(["reels", "post", "carrossel", "live", "stories"]);

const REELS_TEMPLATE = `
### Reel P1 (Buscadores ativos)
Headline:
Introdução (gancho ≤3s):
Apresentação (1 linha):
[Bloco principal – escolha e preencha APENAS uma das estruturas abaixo]

• Se usar Problema/Solução:
Problema:
Consequência:
Solução (3–5 ações):
Benefício:

• Se usar Certo/Errado:
Jeito errado:
Consequência:
Jeito certo (3–5 ações):
Benefício:

• Se usar Oportunidade/Benefício:
Oportunidade:
Problema que resolve:
Exemplo:
Benefícios:
Como fazer (3–5 passos):

CTA final (único):
Aviso de saúde:

### Reel P2 (Conscientes passivos)
Headline:
Introdução (gancho ≤3s):
Apresentação (1 linha):
[Bloco principal – escolha e preencha APENAS uma das estruturas acima]
(complete como no P1)

CTA final (único):
Aviso de saúde:

### Reel P3 (Desavisados)
Headline:
Introdução (gancho ≤3s):
Apresentação (1 linha):
[Bloco principal – escolha e preencha APENAS uma das estruturas acima]
(complete como no P1)

CTA final (único):
Aviso de saúde:
`.trim();

const POST_TEMPLATE = `
### Post Estático (Educação)
Título (≤ 60c):
Linha de apoio (≤ 90c):
Corpo (5–8 linhas, frases curtas):
Prova/Autoridade (1 linha):
CTA (único):
Aviso de saúde (1 linha):
Legenda (2–3 parágrafos curtos, pronta para copiar):
`.trim();

/** Extrai TEXTO apenas dos blocos válidos do Responses API */
function extractText(resp: any): string {
  // caminho direto
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }

  const chunks: string[] = [];

  // varre somente outputs -> messages -> content e pega somente tipos textuais
  const outputs = resp?.output;
  if (Array.isArray(outputs)) {
    for (const out of outputs) {
      const content = out?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          // prioriza blocos válidos
          if (c?.type === "output_text" && c?.text?.value) {
            chunks.push(String(c.text.value));
          } else if (c?.type === "text" && typeof c?.text === "string") {
            chunks.push(c.text);
          } else if (c?.text?.value && typeof c.text.value === "string") {
            chunks.push(c.text.value);
          }
          // ignora tipos: reasoning, tool_use, input_text etc.
        }
      }
    }
  }

  // fallback comum
  if (chunks.length === 0) {
    const tryJoin =
      resp?.output?.[0]?.content
        ?.map((c: any) => c?.text?.value || c?.text)
        ?.filter((v: any) => typeof v === "string")
        ?.join("\n");
    if (tryJoin && String(tryJoin).trim()) {
      return String(tryJoin).trim();
    }
  }

  return chunks.join("\n").trim();
}

export async function POST(
  _req: NextRequest,
  ctx: { params: { weekId: string; tipo: string } }
) {
  try {
    const { weekId, tipo } = ctx.params || ({} as any);
    if (!weekId || !tipo || !TIPOS.has(tipo)) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1) Semana
    const { data: week, error: werr } = await supabase
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (werr || !week) {
      return NextResponse.json({ ok: false, error: "Semana não encontrada." }, { status: 404 });
    }

    // 2) Treinamento mais recente
    const { data: training } = await supabase
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3) Ideias (amostra)
    const { data: ideias } = await supabase
      .from("ideas")
      .select("pilar, tema, assunto, texto")
      .order("created_at", { ascending: false })
      .limit(60);

    const ideiasLista =
      (ideias || [])
        .map((i) => {
          const base =
            i?.texto ||
            [i?.pilar, i?.tema, i?.assunto].filter(Boolean).join(" | ");
          return `- ${base}`;
        })
        .join("\n") || "- (sem ideias cadastradas)";

    // 4) Prompts base
    const promptGeral =
      training?.prompt_geral ||
      "Você é um estrategista de conteúdo médico. Produza conteúdo informativo, ético e claro em PT-BR.";

    const pickFormatoPrompt = () => {
      switch (tipo) {
        case "reels":
          return (
            training?.prompt_reels ||
            "Objetivo: Gerar 3 roteiros de Reels (≤60s), texto corrido, com tópicos fixos para teleprompter."
          );
        case "post":
          return (
            training?.prompt_post ||
            "Objetivo: Post estático educativo com título forte, linha de apoio, corpo em frases curtas, prova/autoridade, CTA único, aviso de saúde e legenda pronta."
          );
        case "carrossel":
          return (
            training?.prompt_carrossel ||
            "Crie um carrossel educacional com 8 slides (título, fatos/mitos, consequências, solução, CTA)."
          );
        case "live":
          return training?.prompt_live || "Crie roteiro de live com atos 1–5, tópicos práticos e CTAs.";
        case "stories":
          return training?.prompt_stories || "Crie sequência de Stories para 7 dias com interações e CTAs.";
      }
    };

    const promptFormato = pickFormatoPrompt()!;
    const tema = week.tema_central || "Tema não definido";
    const subtemasArr = Array.isArray(week.subtemas)
      ? week.subtemas
      : typeof week.subtemas === "string"
      ? week.subtemas.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    // 5) Prompt do usuário (obriga formato fechado em Reels e Post)
    let userPrompt: string;
    if (tipo === "reels") {
      userPrompt = `
SEMANA: ${week.semana_iso}
TEMA CENTRAL: ${tema}
SUBTEMAS: ${subtemasArr.join(" | ") || "(sem subtemas)"}

BANCO DE IDEIAS (amostra):
${ideiasLista}

INSTRUÇÃO DO FORMATO (REELS, TELEPROMPTER):
${promptFormato}

Diretrizes obrigatórias:
- Tom: confiança serena, didático, empático, sem hype. Frases curtas.
- Hook ≤3s, sem clickbait.
- Valor prático: 3–5 ações objetivas.
- 1 CTA único por roteiro.
- Saúde/ética: informativo; não substitui avaliação individual; evitar promessas absolutas.
- Sem hashtags, sem comentários extras.
- Preencha APENAS uma das estruturas (Problema/Solução OU Certo/Errado OU Oportunidade/Benefício) em cada roteiro.
- Entregue a SAÍDA exatamente no seguinte formato, preenchendo os campos:

${REELS_TEMPLATE}
      `.trim();
    } else if (tipo === "post") {
      userPrompt = `
SEMANA: ${week.semana_iso}
TEMA CENTRAL: ${tema}
SUBTEMAS: ${subtemasArr.join(" | ") || "(sem subtemas)"}

BANCO DE IDEIAS (amostra):
${ideiasLista}

INSTRUÇÃO DO FORMATO (POST ESTÁTICO):
${promptFormato}

Diretrizes obrigatórias:
- Linguagem simples, frases curtas, sem hype.
- 5–8 linhas no corpo (texto corrido, sem bullets).
- 1 CTA único.
- Aviso de saúde: informativo; não substitui avaliação individual.
- Entregue a SAÍDA exatamente no seguinte formato (preencha todos os campos):

${POST_TEMPLATE}
      `.trim();
    } else {
      userPrompt = `
SEMANA: ${week.semana_iso}
TEMA CENTRAL: ${tema}
SUBTEMAS: ${subtemasArr.join(" | ") || "(sem subtemas)"}

BANCO DE IDEIAS (amostra):
${ideiasLista}

FORMATO SOLICITADO: ${tipo.toUpperCase()}
INSTRUÇÃO DO FORMATO:
${promptFormato}

Regras:
- Linguagem simples, ética e informativa (não substitui avaliação individual).
- Entregue a SAÍDA em Markdown pronto para copiar/editar.
- Seja direto e prático. Evite jargões sem explicar.
      `.trim();
    }

    // 6) OpenAI — tokens por formato
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const maxTokensMap: Record<string, number> = {
      reels: 3200,
      post: 2300,
      carrossel: 2200,
      live: 2600,
      stories: 2400,
    };

    const body: any = {
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: promptGeral },
        { role: "user", content: userPrompt },
      ],
      max_output_tokens: maxTokensMap[tipo] ?? 1600,
    };

    const resp = await (openai as any).responses.create(body);

    // 7) Extrai texto (estrito)
    const text = extractText(resp);

    if (!text) {
      console.error("Sem conteúdo retornado - shape:", {
        hasOutputText: !!resp?.output_text,
        hasOutput: !!resp?.output,
        outputType: typeof resp?.output,
      });
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, payload: text });
  } catch (e: any) {
    console.error("generate/[weekId]/[tipo] error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro interno." }, { status: 500 });
  }
}
