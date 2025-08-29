// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import OpenAI from "openai";
import { OPENAI_MODEL } from "@/lib/openai";

/**
 * Objetivo deste handler:
 * - Tolerar prompts grandes sem truncar conteúdo
 * - Evitar erros da Responses API com response_format/text.format
 * - Geração em segmentos com marcador <CONTINUE> até finalizar
 * - Retornos sempre em texto, depois salvamos como payload bruto
 */

export const runtime = "nodejs";

const MAX_SEGMENTS = 8; // segurança para não entrar em loop
const DEFAULT_SEGMENT_TOKENS = Number(process.env.OPENAI_MAX_TOKENS_PER_SEGMENT || 1800);

// Extrai texto da Responses API de forma defensiva
function extractText(resp: any): string {
  // Novo SDK geralmente expõe .output_text
  if (resp?.output_text && typeof resp.output_text === "string") return resp.output_text;

  // Fallback para structure output->content
  const out = resp?.output;
  if (Array.isArray(out) && out.length > 0) {
    const content = out[0]?.content;
    if (Array.isArray(content)) {
      const firstText = content.find((c: any) => c.type === "output_text" || c.type === "text");
      if (firstText?.text) return firstText.text;
      if (content[0]?.text) return content[0].text;
    }
  }

  // Fallback extra: alguns retornos antigos tinham choices/messages
  const msg = resp?.choices?.[0]?.message?.content;
  if (typeof msg === "string") return msg;

  return "";
}

// Chama a API com retries simples
async function callOpenAI(client: OpenAI, body: any, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await (client as any).responses.create(body);
      const text = extractText(resp);
      if (text && text.trim().length > 0) return text;
      // se vier vazio, tenta mais uma
    } catch (e: any) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  return "";
}

// Geração em segmentos: usa marcador <CONTINUE> p/ completar trechos longos
async function generateInChunks(params: {
  client: OpenAI;
  system: string;
  userInstruction: string; // prompt final com TODO o seu texto grande
  segmentTokens?: number;
}) {
  const { client, system, userInstruction } = params;
  const segTokens = Math.max(800, params.segmentTokens || DEFAULT_SEGMENT_TOKENS);

  // instrução para o modelo usar marcador quando truncar
  const suffixGuide =
    "\n\nIMPORTANTE: Se estiver acabando o limite, termine a resposta com a palavra exata <CONTINUE> (em maiúsculas, sozinha na linha). Eu pedirei para continuar e você retoma do ponto exato onde parou, sem repetir texto.";

  const baseBody = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: userInstruction + suffixGuide },
    ],
    max_output_tokens: segTokens,
    temperature: 1, // usar default compatível com Responses API
  };

  let allText = "";
  let segmentCount = 0;

  // 1º segmento
  let text = await callOpenAI(client, baseBody);
  if (!text) throw new Error("Sem conteúdo retornado do modelo (segmento inicial).");
  allText += text.trim();
  segmentCount++;

  // Enquanto vier <CONTINUE>, pedimos continuação
  while (segmentCount < MAX_SEGMENTS && /\b<CONTINUE>\b\s*$/i.test(allText)) {
    const continueBody = {
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "CONTINUE do ponto exato onde parou acima. Não repita nada. Entregue somente a próxima parte. Quando terminar tudo, NÃO use <CONTINUE>.",
        },
      ],
      max_output_tokens: segTokens,
      temperature: 1,
    };

    const more = await callOpenAI(client, continueBody);
    if (!more) break;
    allText = allText.replace(/\b<CONTINUE>\b\s*$/i, ""); // remove marcador antigo
    allText += "\n" + more.trim();
    segmentCount++;

    // se o novo bloco ainda termina com <CONTINUE>, loop segue;
    // senão, finalizamos.
    if (!/\b<CONTINUE>\b\s*$/i.test(allText)) break;
  }

  // limpeza final de marcador se sobrar
  allText = allText.replace(/\b<CONTINUE>\b\s*$/gi, "").trim();
  return allText;
}

async function fetchTrainingAndWeek(supabase: any, weekId: string) {
  const { data: week, error: werr } = await supabase.from("weeks").select("*").eq("id", weekId).single();
  if (werr || !week) throw new Error("Semana não encontrada.");

  // pega qualquer treinamento (ou o mais recente)
  const { data: training, error: terr } = await supabase
    .from("trainings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (terr || !training) throw new Error("Treinamento não encontrado.");

  return { week, training };
}

function buildPrompt(tipo: string, training: any, week: any, ideasSample: string[]) {
  // prompts específicos por formato (iguais aos que você já cadastrou)
  const map: Record<string, string | undefined> = {
    reels: training.prompt_reels,
    post: training.prompt_post,
    carrossel: training.prompt_carrossel,
    live: training.prompt_live,
    stories: training.prompt_stories,
  };

  const formatoPrompt = (map[tipo] || "").trim();
  if (!formatoPrompt) {
    throw new Error(`Prompt específico para "${tipo}" não encontrado em Treinamentos.`);
  }

  // Dados da semana
  const subtemasStr = Array.isArray(week.subtemas) ? week.subtemas.join(", ") : String(week.subtemas || "");
  const ideasStr = ideasSample.length ? "- " + ideasSample.join("\n- ") : "(sem ideias sugeridas)";

  // Prompt geral + contexto + prompt específico do formato
  const final =
    `${training.prompt_geral || ""}\n\n` +
    `### CONTEXTO DA SEMANA\n` +
    `Semana: ${week.semana_iso}\n` +
    `Tema central: ${week.tema_central}\n` +
    `Subtemas: ${subtemasStr}\n\n` +
    `### BANCO DE IDEIAS (amostra)\n${ideasStr}\n\n` +
    `### PROMPT DO FORMATO (${tipo.toUpperCase()})\n` +
    `${formatoPrompt}\n`;

  return final;
}

async function sampleIdeas(supabase: any, user_id: string | null, tema_central: string) {
  // Puxa até 10 ideias quaisquer do usuário (ou globais) relacionadas ao tema (bem simples)
  const { data, error } = await supabase
    .from("ideas")
    .select("texto,tema")
    .ilike("texto", `%${tema_central.split(" ")[0]}%`)
    .limit(10);

  if (error) return [];
  return (data || []).map((r: any) => r.texto).filter(Boolean);
}

export async function POST(req: NextRequest, { params }: { params: { weekId: string; tipo: string } }) {
  try {
    const { weekId, tipo } = params;
    const supabase = supabaseServer();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Busca semana + treinamento
    const { week, training } = await fetchTrainingAndWeek(supabase, weekId);

    // 2) Amostra simples de ideias (sem embeddings p/ evitar latência aqui)
    const ideas = await sampleIdeas(supabase, week.user_id || null, week.tema_central || "");

    // 3) Monta prompts
    const systemPrompt =
      "Você é um estrategista e redator sênior. Responda sempre em português do Brasil. Siga **exatamente** as instruções do usuário. Não invente dados médicos além do que o prompt der. Quando a resposta ficar grande, termine com <CONTINUE> e eu pedirei para continuar.";
    const userPrompt = buildPrompt(tipo, training, week, ideas);

    // 4) Gera em segmentos até completar
    const text = await generateInChunks({
      client: openai,
      system: systemPrompt,
      userInstruction: userPrompt,
      segmentTokens: DEFAULT_SEGMENT_TOKENS,
    });

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado." }, { status: 400 });
    }

    // 5) Persiste em generations/artifacts
    const genPayload = {
      tipo,
      semana_iso: week.semana_iso,
      tema_central: week.tema_central,
      content: text,
    };

    // cria/insere generation
    const { data: gen, error: gerr } = await supabase
      .from("generations")
      .insert({
        week_id: week.id,
        training_id_ref: training.id,
        status: "draft",
        payload: genPayload,
      })
      .select("id")
      .single();
    if (gerr) throw gerr;

    // cria artifact único para este tipo
    await supabase.from("artifacts").insert({
      generation_id: gen.id,
      tipo,
      indice: 1,
      content_json: { text },
      tags: null,
      feedbacks: null,
    });

    return NextResponse.json({ ok: true, payload: genPayload, generation_id: gen.id });
  } catch (e: any) {
    const msg = e?.message || String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
