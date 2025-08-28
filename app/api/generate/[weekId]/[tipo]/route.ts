// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";
import { OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";

// formatos permitidos
const ALLOWED = new Set(["reel", "post", "carrossel", "live", "stories"]);

// orçamentos de saída por formato (tokens aproximados)
const MAX_OUTPUT_BY_FORMAT: Record<string, number> = {
  reel: 1400,
  post: 1200,
  carrossel: 1600,
  live: 3200,     // ↑ maior para evitar corte no ATO 4/5
  stories: 2200,
};

// utilitário: extrai texto do Responses API, com vários fallbacks
function extractText(resp: any): string {
  try {
    if (typeof resp.output_text === "string" && resp.output_text.trim()) {
      return resp.output_text;
    }
    const c0 = resp?.output?.[0]?.content?.[0];
    if (c0?.type === "output_text" && typeof c0?.text === "string") {
      return c0.text;
    }
    const parts: string[] = [];
    for (const out of resp?.output ?? []) {
      for (const c of out?.content ?? []) {
        if (c?.type === "output_text" && typeof c?.text === "string") {
          parts.push(c.text);
        }
      }
    }
    if (parts.length) return parts.join("\n\n");
  } catch {}
  return "";
}

// gera um prompt de “continue” quando Live veio incompleto
function buildLiveContinuePrompt(already: string) {
  return [
    "Você começou a escrever um roteiro de LIVE com 5 ATOS e parou antes de concluir.",
    "Abaixo está o texto que você já escreveu (NÃO repita este conteúdo):",
    "----- INÍCIO DO CONTEÚDO JÁ ESCRITO -----",
    already,
    "----- FIM DO CONTEÚDO JÁ ESCRITO -----",
    "",
    "Agora, **complete apenas o que falta** seguindo a estrutura:",
    "• ATO 4: Recapitulação e Reforço (≈ 5 min)",
    "  - Resuma os pontos essenciais (bullets claros).",
    "  - Faça 1 pergunta de verificação de entendimento para engajar.",
    "• ATO 5: Chamada Final (≈ 1 min)",
    "  - Convite para comentar no gravado (o que ajudou).",
    "  - Chamado para compartilhar.",
    "",
    "Regras:",
    "- Não reescreva os ATOS já concluídos.",
    "- Mantenha tom: confiança serena, didático, sem promessas absolutas.",
    "- Entregue o texto pronto para uso, com títulos 'ATO 4' e 'ATO 5'.",
  ].join("\n");
}

function buildContextoSemana(week: any) {
  const sub = Array.isArray(week?.subtemas) ? week.subtemas : [];
  const subList = sub.length ? `\nSubtemas: ${sub.join(", ")}` : "";
  return `Semana: ${week?.semana_iso}\nTema central: ${week?.tema_central}${subList}`;
}

function pickPromptFormato(train: any, tipo: string): string {
  switch (tipo) {
    case "reel": return train?.prompt_reels || "";
    case "post": return train?.prompt_post || "";
    case "carrossel": return train?.prompt_carrossel || "";
    case "live": return train?.prompt_live || "";
    case "stories": return train?.prompt_stories || "";
    default: return "";
  }
}

export async function POST(req: NextRequest, { params }: { params: { weekId: string; tipo: string } }) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supabase = supabaseServer();

  try {
    const weekId = params.weekId;
    const tipo = (params.tipo || "").toLowerCase();

    if (!ALLOWED.has(tipo)) {
      return NextResponse.json({ ok: false, error: `Formato inválido: ${tipo}` }, { status: 400 });
    }

    // 1) Carrega semana
    const { data: week, error: eWeek } = await supabase
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (eWeek || !week) {
      return NextResponse.json({ ok: false, error: "Semana não encontrada." }, { status: 404 });
    }

    // 2) Carrega o treinamento mais recente
    const { data: trainings, error: eTr } = await supabase
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (eTr || !trainings?.length) {
      return NextResponse.json({ ok: false, error: "Treinamento não encontrado. Preencha em /treinamentos." }, { status: 400 });
    }

    const training = trainings[0];
    const promptGeral = (training?.prompt_geral || "").trim();
    const promptFormato = (pickPromptFormato(training, tipo) || "").trim();

    if (!promptFormato) {
      return NextResponse.json({ ok: false, error: `Prompt do formato (${tipo}) não preenchido em /treinamentos.` }, { status: 400 });
    }

    // 3) Contexto de ideias (opcional: amostra simples)
    const { data: ideas } = await supabase
      .from("ideas")
      .select("texto")
      .order("created_at", { ascending: false })
      .limit(10);

    const ideiasTexto = (ideas || [])
      .map((i: any) => i?.texto)
      .filter(Boolean)
      .join("\n- ");

    // 4) Prompt final
    const contextoSemana = buildContextoSemana(week);
    const system = [
      "Você é um estrategista de conteúdo que escreve em PT-BR, tom: confiança serena, didático, empático, ético.",
      "Evite promessas absolutas e jargão; se usar termo médico, explique em 1 linha simples.",
      "Siga fielmente as orientações do prompt específico do formato.",
    ].join("\n");

    const usuario = [
      "=== TREINAMENTO GERAL ===",
      promptGeral || "(vazio)",
      "",
      "=== CONTEXTO DA SEMANA ===",
      contextoSemana,
      "",
      "=== IDEIAS GLOBAIS (amostra) ===",
      ideiasTexto ? `- ${ideiasTexto}` : "(sem ideias importadas)",
      "",
      "=== DIRETRIZES DO FORMATO ===",
      promptFormato,
      "",
      "=== INSTRUÇÃO FINAL ===",
      "Respeite a estrutura e a saída obrigatória do formato.",
      "Entregue o conteúdo completo e pronto para uso.",
    ].join("\n");

    const maxTokens = MAX_OUTPUT_BY_FORMAT[tipo] ?? 1400;

    const body: any = {
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: usuario },
      ],
      max_output_tokens: maxTokens,
    };

    const resp = await (openai as any).responses.create(body);
    let texto = extractText(resp);

    // Auto-continue para LIVE
    if (tipo === "live") {
      const hasAto4 = /ATO\s*4/i.test(texto) || /Ato\s*4/i.test(texto);
      const hasAto5 = /ATO\s*5/i.test(texto) || /Ato\s*5/i.test(texto);
      const endsEarly = !hasAto4 || !hasAto5;

      if (endsEarly) {
        const continuePrompt = buildLiveContinuePrompt(texto);

        const resp2 = await (openai as any).responses.create({
          model: OPENAI_MODEL,
          input: [
            { role: "system", content: system },
            { role: "assistant", content: texto },
            { role: "user", content: continuePrompt },
          ],
          max_output_tokens: Math.min(maxTokens, 1600),
        });

        const complemento = extractText(resp2);
        if (complemento && complemento.trim()) {
          texto = [texto.trim(), complemento.trim()].join("\n\n");
        }
      }
    }

    if (!texto || !texto.trim()) {
      return NextResponse.json({ ok: false, error: "Sem conteúdo retornado." }, { status: 400 });
    }

    // Salva geração e artifact
    const genInsert = await supabase
      .from("generations")
      .insert({
        week_id: week.id,
        training_id_ref: training.id,
        status: "draft",
        payload: { tipo, text: texto, week_id: week.id },
      })
      .select("id")
      .single();

    const generationId = genInsert?.data?.id;

    if (generationId) {
      await supabase.from("artifacts").insert({
        generation_id: generationId,
        tipo,
        indice: 1,
        content_json: { text: texto },
      });
    }

    return NextResponse.json({
      ok: true,
      generationId: generationId || null,
      payload: texto,
    });
  } catch (err: any) {
    console.error("generate/[weekId]/[tipo] error:", err?.message || err);
    const msg = typeof err?.message === "string" ? err.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
