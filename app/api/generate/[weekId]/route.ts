export const maxDuration = 300; // permite até 5 min na Vercel

// app/api/generate/[weekId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { OPENAI_MODEL, EMBEDDINGS_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenPiece = { type: "reels"|"post"|"carrossel"|"live"|"stories"; index?: number; content: string };

async function getWeek(supabase: ReturnType<typeof supabaseServer>, weekId: string) {
  const { data, error } = await supabase.from("weeks").select("*").eq("id", weekId).single();
  if (error || !data) throw new Error("Semana não encontrada.");
  // subtemas pode ser jsonb ou string[]
  const subtemas = Array.isArray(data.subtemas) ? data.subtemas : [];
  return { ...data, subtemas };
}

async function getLatestTraining(supabase: ReturnType<typeof supabaseServer>) {
  // pega o treinamento mais recente (um único registro)
  const { data, error } = await supabase
    .from("trainings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error("Treinamento não encontrado. Configure na aba Treinamentos.");
  return data;
}

async function getRelevantIdeas(
  supabase: ReturnType<typeof supabaseServer>,
  openai: OpenAI,
  tema: string,
  subtemas: string[],
  max = 30
) {
  try {
    const query = `Tema da semana: ${tema}. Subtemas: ${subtemas.join(", ")}`;
    const emb = await openai.embeddings.create({
      model: EMBEDDINGS_MODEL || "text-embedding-3-small",
      input: query,
    });
    const { data, error } = await supabase.rpc("match_ideas_global", {
      query_embedding: emb.data[0].embedding as any,
      match_count: max,
    });
    if (error) throw error;
    return (data || []).map((r: any) => r.texto || `${r.pilar ?? ""} | ${r.tema ?? ""} | ${r.assunto ?? ""}`.trim());
  } catch {
    // fallback simples: últimas ideias inseridas
    const { data } = await supabase
      .from("ideas")
      .select("texto")
      .order("created_at", { ascending: false })
      .limit(max);
    return (data || []).map((r: any) => r.texto);
  }
}

function buildContext(week: any, ideas: string[]) {
  const blocos = [
    `## Semana selecionada`,
    `- Semana ISO: ${week.semana_iso ?? ""}`,
    `- Tema central: ${week.tema_central ?? ""}`,
    `- Subtemas: ${(week.subtemas || []).join(", ")}`,
    ``,
    `## Banco de ideias (amostra)`,
    ...(ideas.slice(0, 20).map((t, i) => `- (${i + 1}) ${t}`)),
  ];
  return blocos.join("\n");
}
import { MODEL_CANDIDATES } from "@/lib/openai";

// Tenta com temperature; se der "Unsupported value", refaz sem temperature.
// Se o modelo não existir/sem acesso, tenta o próximo candidato.
async function generateText(openai: OpenAI, systemPrompt: string, specificPrompt: string, context: string) {
  const candidates = MODEL_CANDIDATES?.length ? MODEL_CANDIDATES : [process.env.OPENAI_MODEL || "gpt-5-mini"];
  const messages = [
    { role: "system" as const, content: systemPrompt || "Você é um estrategista de conteúdo médico, ético e didático." },
    { role: "user" as const, content: `${specificPrompt}\n\n---\nContexto:\n${context}` },
  ];

  let lastErr: any = null;
  for (const model of candidates) {
    // 1) tenta com temperature (0.6)
    try {
      const r1 = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.6,
      });
      return r1.choices?.[0]?.message?.content?.trim() || "";
    } catch (e: any) {
      const msg = String(e?.message || "");
      // Caso específico: modelo não aceita temperature customizada
      if (/Unsupported value: 'temperature'|does not support .* temperature/i.test(msg)) {
        try {
          // 2) refaz SEM temperature
          const r2 = await openai.chat.completions.create({
            model,
            messages,
            // sem temperature → usa padrão do modelo
          });
          return r2.choices?.[0]?.message?.content?.trim() || "";
        } catch (e2: any) {
          lastErr = e2;
          // tenta próximo modelo
          continue;
        }
      }

      // Se o problema for "modelo não existe/sem acesso", tenta o próximo
      if (e?.status === 404 || /model .* does not exist|do not have access/i.test(msg)) {
        lastErr = e;
        continue;
      }

      // Outros erros: pare e reporte
      throw e;
    }
  }
  throw new Error(lastErr?.message || "Falha ao gerar com os modelos candidatos.");
}

export async function POST(_req: NextRequest, { params }: { params: { weekId: string } }) {
  try {
    const weekId = params?.weekId;
    if (!weekId) return NextResponse.json({ ok: false, error: "Parâmetro weekId ausente." }, { status: 400 });

    const supabase = supabaseServer();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Dados base
    const week = await getWeek(supabase, weekId);
    const training = await getLatestTraining(supabase);
    const ideas = await getRelevantIdeas(supabase, openai, week.tema_central, week.subtemas, 30);
    const context = buildContext(week, ideas);

    // 2) Ordem de geração (1→5)
    const pieces: GenPiece[] = [];

    // 1 - Reels (3 variações)
    if (!training.prompt_reels) throw new Error("Prompt de Reels não configurado na aba Treinamentos.");
    const reelsText = await generateText(openai, training.prompt_geral || "", training.prompt_reels, context);
    pieces.push({ type: "reels", index: 1, content: reelsText });

    // 2 - Post estático
    if (!training.prompt_post) throw new Error("Prompt de Post não configurado na aba Treinamentos.");
    const postText = await generateText(openai, training.prompt_geral || "", training.prompt_post, context);
    pieces.push({ type: "post", content: postText });

    // 3 - Carrossel
    if (!training.prompt_carrossel) throw new Error("Prompt de Carrossel não configurado na aba Treinamentos.");
    const carrosselText = await generateText(openai, training.prompt_geral || "", training.prompt_carrossel, context);
    pieces.push({ type: "carrossel", content: carrosselText });

    // 4 - Live
    if (!training.prompt_live) throw new Error("Prompt de Live não configurado na aba Treinamentos.");
    const liveText = await generateText(openai, training.prompt_geral || "", training.prompt_live, context);
    pieces.push({ type: "live", content: liveText });

    // 5 - Stories (com suas regras de Segunda/Quinta já no prompt do usuário)
    if (!training.prompt_stories) throw new Error("Prompt de Stories não configurado na aba Treinamentos.");
    const storiesText = await generateText(openai, training.prompt_geral || "", training.prompt_stories, context);
    pieces.push({ type: "stories", content: storiesText });

    // 3) Persistir geração + artifacts
    const payload = {
      week: { id: week.id, semana_iso: week.semana_iso, tema_central: week.tema_central, subtemas: week.subtemas },
      ideas_sample: ideas.slice(0, 20),
      outputs: pieces,
    };

    const { data: gen, error: genErr } = await supabase
      .from("generations")
      .insert({
        week_id: week.id,
        training_id_ref: training.id,
        status: "draft",
        payload,
        edited_payload: null,
      })
      .select()
      .single();

    if (genErr) {
      // Não falhe o fluxo por causa do histórico:
      console.warn("Falha ao salvar generations:", genErr.message);
    }

    // artifacts (um por peça)
    if (gen?.id) {
      for (const p of pieces) {
        const { error: artErr } = await supabase.from("artifacts").insert({
          generation_id: gen.id,
          tipo: p.type,
          indice: p.index ?? null,
          content_json: { content: p.content },
          edited_json: null,
          tags: null,
          feedbacks: null,
        });
        if (artErr) console.warn("Falha ao salvar artifact:", artErr.message);
      }
    }

    return NextResponse.json({ ok: true, generation_id: gen?.id ?? null, payload });
  } catch (e: any) {
    console.error("Erro em /api/generate:", e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
