// app/api/artifacts/[id]/refine/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// (opcional) menor latência no BR
export const preferredRegion = ["gru1", "iad1"];

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const artifactId = params?.id;
    if (!artifactId) {
      return NextResponse.json({ ok: false, error: "Parâmetro 'id' ausente." }, { status: 400 });
    }

    const { instruction } = await req.json().catch(() => ({ instruction: "" }));
    const supabase = supabaseServer();

    // 1) Pega a peça a ser refinada
    const { data: art, error: artErr } = await supabase
      .from("artifacts")
      .select("id, tipo, indice, content_json, edited_json, generation_id")
      .eq("id", artifactId)
      .single();

    if (artErr || !art) {
      return NextResponse.json({ ok: false, error: artErr?.message || "Artifact não encontrado." }, { status: 404 });
    }

    const contentAtual: string =
      art.edited_json?.content ||
      art.content_json?.content ||
      "";

    if (!contentAtual.trim()) {
      return NextResponse.json({ ok: false, error: "Artifact sem conteúdo para refinar." }, { status: 400 });
    }

    // 2) Contexto opcional da geração
    const { data: gen } = await supabase
      .from("generations")
      .select("id, week_id, training_id_ref, payload")
      .eq("id", art.generation_id)
      .single();

    const semanaInfo = gen?.payload?.week || {};
    const ideasSample = gen?.payload?.ideas_sample || [];

    // 3) Prompts
    const systemPrompt =
      "Você é um editor sênior de conteúdo para Instagram. Refine mantendo formato/tópicos e limites. Não fazer promessas médicas absolutas; linguagem clara, direta e ética.";

    const userPrompt = [
      `## Tipo: ${art.tipo}${art.indice ? ` #${art.indice}` : ""}`,
      "## Conteúdo atual (refinar mantendo estrutura):",
      contentAtual,
      "",
      "## Instrução específica:",
      instruction || "Melhorar clareza, fluidez e força de copy sem mudar o formato.",
      "",
      "## Contexto (ajuda, opcional):",
      JSON.stringify({ semana: semanaInfo, ideias: ideasSample }, null, 2),
    ].join("\n");

    // 4) JSON Schema simples (somente 'content')
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        content: { type: "string" },
      },
      required: ["content"],
    };

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 5) CHAMADA com CAST para evitar erro de tipos do SDK
    const body: any = {
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "artifact_refine",
          schema,
          strict: true,
        },
      },
      max_output_tokens: 1200,
    };

    const resp = await (openai as any).responses.create(body);

    // 6) Extrai o texto/JSON com fallback robusto
    let textOut =
      resp?.output_text ??
      resp?.output?.[0]?.content?.[0]?.text ??
      "";

    if (typeof textOut !== "string") textOut = String(textOut || "").trim();

    let json: { content: string };
    try {
      json = JSON.parse(textOut);
    } catch {
      json = { content: textOut };
    }

    const refined = (json?.content || "").trim();
    if (!refined) {
      return NextResponse.json({ ok: false, error: "Retorno vazio da IA." }, { status: 500 });
    }

    // 7) Salva como edição do artifact
    const { error: updErr } = await supabase
      .from("artifacts")
      .update({ edited_json: { content: refined } })
      .eq("id", artifactId);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, content: refined });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
