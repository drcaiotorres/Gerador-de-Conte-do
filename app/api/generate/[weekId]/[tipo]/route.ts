// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = OPENAI_MODEL; // ex.: "gpt-4.1-mini"

type TipoFormato = "reels" | "post" | "carrossel" | "live" | "stories";

function buildOutputInstruction(tipo: TipoFormato) {
  // Pedimos TEXTO PURO (markdown) — sem JSON, sem schemas
  switch (tipo) {
    case "reels":
      return `Retorne o roteiro final **em texto corrido markdown**, já estruturado nos tópicos exigidos do seu prompt de REELS. Não inclua comentários de sistema.`;
    case "post":
      return `Retorne o conteúdo final **em texto corrido markdown** (post estático), com título, linha de apoio, corpo e CTA conforme seu prompt de POST.`;
    case "carrossel":
      return `Retorne **apenas** o carrossel final como markdown, com "Slide 1:", "Slide 2:" ... e o texto de cada slide.`;
    case "live":
      return `Retorne a live completa **em markdown**, com ATO 1 a ATO 5, tópicos claros e falas sucintas.`;
    case "stories":
      return `Retorne a grade de 7 dias **em markdown**, nomeando cada dia (Domingo a Sábado) e listando os quadros (enquete, caixinha, CTA etc.).`;
    default:
      return `Retorne o conteúdo final em **markdown**.`;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { weekId: string; tipo: TipoFormato } }
) {
  try {
    const { weekId, tipo } = params;
    if (!weekId || !tipo) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1) Semana selecionada
    const { data: week, error: weekErr } = await supabase
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (weekErr || !week) {
      return NextResponse.json({ ok: false, error: "Semana não encontrada." }, { status: 404 });
    }

    // 2) Treinamentos (pegamos o mais recente)
    const { data: training, error: trErr } = await supabase
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (trErr) {
      return NextResponse.json({ ok: false, error: "Falha ao ler treinamentos." }, { status: 500 });
    }

    const promptGeral = training?.prompt_geral || "";
    const promptPorFormato =
      tipo === "reels" ? training?.prompt_reels
      : tipo === "post" ? training?.prompt_post
      : tipo === "carrossel" ? training?.prompt_carrossel
      : tipo === "live" ? training?.prompt_live
      : tipo === "stories" ? training?.prompt_stories
      : "";

    // 3) Amostra de ideias globais para inspirar (sem embeddings)
    const { data: ideas } = await supabase
      .from("ideas")
      .select("texto")
      .order("created_at", { ascending: false })
      .limit(30);

    const ideiasLista = (ideas || []).map(i => `- ${i.texto}`).join("\n");

    // 4) Monta o comando ao modelo
    const outputInstruction = buildOutputInstruction(tipo);
    const contextoSemana = `SEMANA: ${week.semana_iso}\nTEMA CENTRAL: ${week.tema_central}\nSUBTEMAS: ${(Array.isArray(week.subtemas) ? week.subtemas.join(", ") : "")}`;
    const bancoIdeias = ideiasLista ? `IDEIAS GLOBAIS (amostra):\n${ideiasLista}` : `IDEIAS GLOBAIS: (sem amostra)`;    

    const systemPrompt = [
      "Você é um estrategista de conteúdo que escreve em PT-BR, tom confiante, didático e empático.",
      "Siga à risca as regras do Treinamento Geral e do Prompt do Formato.",
      "O conteúdo deve ser substancial e prático. Evite jargões não explicados.",
      "A SAÍDA DEVE SER ESTRITAMENTE EM TEXTO MARKDOWN. NÃO RETORNE JSON.",
    ].join("\n");

    const userPrompt = [
      "=== CONTEXTO DA SEMANA ===",
      contextoSemana,
      "",
      "=== TREINAMENTO GERAL ===",
      promptGeral || "(não fornecido)",
      "",
      "=== PROMPT DO FORMATO ===",
      promptPorFormato || "(não fornecido)",
      "",
      "=== BANCO DE IDEIAS (AMOSTRA) ===",
      bancoIdeias,
      "",
      "=== INSTRUÇÃO DE SAÍDA ===",
      outputInstruction,
      "",
      "Importante: entregue APENAS o texto final, pronto para colar. Sem explicações adicionais."
    ].join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 5) Chamada ao Responses API sem response_format/text.format
    const body: any = {
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Não enviar temperature custom se seu modelo não aceitar:
      // max_output_tokens ajuda a evitar truncamento
      max_output_tokens: 2200,
    };

    const resp = await (openai as any).responses.create(body);

    // 6) Extrai string de maneira robusta
    const md =
      (resp as any)?.output_text ||
      (resp as any)?.content?.[0]?.text ||
      (resp as any)?.output?.[0]?.content?.[0]?.text ||
      "";

    if (!md || !String(md).trim()) {
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado." }, { status: 400 });
    }

    // 7) Salva um "generation" simples (opcional)
    const { data: gen, error: genErr } = await supabase
      .from("generations")
      .insert({
        week_id: week.id,
        status: "draft",
        payload: { md, tipo },
      })
      .select()
      .single();

    if (genErr) {
      // Não bloqueia o retorno do conteúdo ao usuário
      return NextResponse.json({ ok: true, payload: { md }, generation_id: null });
    }

    return NextResponse.json({ ok: true, payload: { md }, generation_id: gen.id });
  } catch (err: any) {
    console.error("generate error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro ao gerar conteúdo." },
      { status: 500 }
    );
  }
}
