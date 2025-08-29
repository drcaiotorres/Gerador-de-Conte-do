// app/api/generate/[weekId]/[tipo]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabaseServer";

// Garante execução em Node
export const runtime = "nodejs";

type RouteParams = { params: { weekId: string; tipo: string } };

// --- Helper: extrai texto de qualquer forma que o Responses API retorne
function extractText(resp: any): string {
  // 1) Campo direto (SDK costuma expor)
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text;
  }

  // 2) Novo formato: array "output" com "content" interno
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

  // 3) Alguns backends colocam em "text"
  if (!acc && typeof resp?.text === "string") acc = resp.text;

  // 4) Alguns colocam em "message.content"
  if (!acc && resp?.message?.content) {
    const mc = resp.message.content;
    if (Array.isArray(mc)) {
      for (const m of mc) if (typeof m?.text === "string") acc += m.text;
    } else if (typeof mc === "string") {
      acc = mc;
    }
  }

  return acc;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { weekId, tipo } = params;
    const supabase = supabaseServer();

    // 1) Semana
    const { data: week, error: wErr } = await supabase
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .single();

    if (wErr || !week) {
      return NextResponse.json(
        { ok: false, error: "Semana não encontrada." },
        { status: 404 }
      );
    }

    const tema = week.tema_central ?? "";
    const subtemasArr = Array.isArray(week.subtemas) ? week.subtemas : [];
    const subtemas = subtemasArr.filter(Boolean).join(", ");

    // 2) Treinamentos (pega o mais recente)
    const { data: training } = await supabase
      .from("trainings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Escolhe o prompt do formato
    const keyMap: Record<string, string> = {
      reels: "prompt_reels",
      post: "prompt_post",
      carrossel: "prompt_carrossel",
      live: "prompt_live",
      stories: "prompt_stories",
    };
    const key = keyMap[tipo] ?? "prompt_post";
    const promptFormato =
      (training && (training as any)[key]) ||
      `Gere um rascunho em markdown sobre "${tema}" com subtemas: ${subtemas}.`;

    const promptGeral = (training?.prompt_geral ?? "").trim();

    // 3) Monta input simples (sem schema) para evitar incompatibilidades de SDK
    //    Vamos pedir SAÍDA EM MARKDOWN para o preview funcionar
    const developerMsg =
      (promptGeral ? promptGeral + "\n\n" : "") +
      "Você deve responder SEMPRE em português do Brasil e ENTREGAR apenas o conteúdo final em MARKDOWN, sem explicações fora do conteúdo.";

    const userText = [
      `SEMANA: ${week.semana_iso}`,
      `TEMA: ${tema}`,
      `SUBTEMAS: ${subtemas || "(sem subtemas cadastrados)"}`,
      `FORMATO: ${tipo.toUpperCase()}`,
      "",
      "INSTRUÇÕES ESPECÍFICAS DO FORMATO:",
      promptFormato,
    ].join("\n");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Importante: não enviar temperature custom em modelos que não aceitam
    // e não usar response_format (mudou para text.format). Aqui pedimos TEXTO puro.
    const body: any = {
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "developer", content: developerMsg },
        {
          role: "user",
          content: [{ type: "text", text: userText }],
        },
      ],
      // Sem text.format => saída livre em texto; mais robusto para diferentes SDKs
      max_output_tokens: 2500,
    };

    const resp = await (openai as any).responses.create(body);
    const markdown = extractText(resp);

    if (!markdown || !markdown.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Sem conteúdo retornado do modelo. Tente novamente em alguns segundos.",
        },
        { status: 400 }
      );
    }

    // Retorna no formato que o frontend espera
    return NextResponse.json({ ok: true, payload: { markdown } });
  } catch (e: any) {
    const msg =
      e?.error?.message || e?.message || "Erro inesperado ao gerar conteúdo.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
