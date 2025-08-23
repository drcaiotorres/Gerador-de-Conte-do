import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_CANDIDATES = [
  process.env.OPENAI_MODEL || OPENAI_MODEL || "gpt-5-mini",
  "gpt-5-mini","gpt-4o-mini","gpt-4.1-mini"
];

async function callLLM(openai: OpenAI, messages: any[], max_tokens = 600) {
  let last:any=null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const r1 = await openai.chat.completions.create({ model, messages, max_tokens, temperature: 0.6 });
      return r1.choices?.[0]?.message?.content?.trim() || "";
    } catch (e:any) {
      const m = String(e?.message||"");
      if (/Unsupported value: 'temperature'/.test(m)) {
        const r2 = await openai.chat.completions.create({ model, messages, max_tokens });
        return r2.choices?.[0]?.message?.content?.trim() || "";
      }
      if (e?.status===404 || /does not exist|do not have access/i.test(m)) { last=e; continue; }
      throw e;
    }
  }
  throw last || new Error("Nenhum modelo disponível.");
}

export async function POST(req: NextRequest) {
  try {
    const { generation_id, tipo, indice, instruction } = await req.json();
    if (!generation_id || !tipo) return NextResponse.json({ ok:false, error:"Parâmetros obrigatórios ausentes" }, { status:400 });

    const supabase = supabaseServer();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { data: gen } = await supabase.from("generations").select("id,payload,training_id_ref").eq("id", generation_id).single();
    if (!gen?.payload) return NextResponse.json({ ok:false, error:"Geração sem payload" }, { status:400 });

    const { data: train } = await supabase.from("trainings").select("*").eq("id", gen.training_id_ref).single();
    if (!train) return NextResponse.json({ ok:false, error:"Treinamento não encontrado" }, { status:400 });

    const context = [
      `## Semana`, JSON.stringify(gen.payload.week, null, 2),
      `## Ideias (amostra)`, JSON.stringify(gen.payload.ideas_sample ?? [], null, 2)
    ].join("\n");

    const mapPrompt: Record<string,string> = {
      reels: train.prompt_reels,
      post: train.prompt_post,
      carrossel: train.prompt_carrossel,
      live: train.prompt_live,
      stories: train.prompt_stories
    };
    const specific = mapPrompt[tipo];
    if (!specific) return NextResponse.json({ ok:false, error:`Prompt específico não configurado para ${tipo}` }, { status:400 });

    const system = train.prompt_geral || "Você é um estrategista de conteúdo médico, ético e didático.";
    const userMsg =
      `${specific}\n\n---\nContexto:\n${context}\n\n---\nAplique a instrução específica: ${instruction || "melhorar clareza mantendo o mesmo formato e limites."}`;

    const text = await callLLM(openai, [
      { role:"system", content: system },
      { role:"user", content: userMsg }
    ], 600);

    const { error: insErr } = await supabase.from("artifacts").insert({
      generation_id, tipo, indice: indice ?? null, content_json: { content: text }
    });
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 });

    return NextResponse.json({ ok:true, content: text });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
