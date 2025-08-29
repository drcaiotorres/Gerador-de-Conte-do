// app/api/artifacts/[id]/refine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai, OPENAI_MODEL as MODEL } from "@/lib/openai";

export const runtime = "nodejs";

function extractOutputText(res: any): string {
  // Vários formatos possíveis do SDK Responses:
  if (typeof res?.output_text === "string") return res.output_text;

  const c0 = res?.output?.[0]?.content?.[0];
  if (c0?.type === "output_text" && typeof c0?.text === "string") return c0.text;

  // Fallbacks comuns
  if (typeof res?.content === "string") return res.content;
  if (Array.isArray(res?.choices) && res.choices[0]?.message?.content) {
    return String(res.choices[0].message.content);
  }

  // Último recurso: serializa
  return JSON.stringify(res);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const artifactId = params.id;
    if (!artifactId) {
      return NextResponse.json({ ok: false, error: "Parâmetro id ausente." }, { status: 400 });
    }

    const supabase = supabaseServer();

    // 1) Busca artifact
    const { data: artifact, error: artErr } = await supabase
      .from("artifacts")
      .select("id, tipo, indice, content_json, edited_json, generation_id")
      .eq("id", artifactId)
      .single();

    if (artErr || !artifact) {
      return NextResponse.json(
        { ok: false, error: artErr?.message || "Artifact não encontrado." },
        { status: 404 }
      );
    }

    // 2) Lê instruções do corpo (ex: { instruction: "refaça o reels 2" , schemaName?, schema? })
    const body = await req.json().catch(() => ({}));
    const instruction: string = body?.instruction || "Aprimore o conteúdo mantendo intenção e formato.";
    const schemaName: string | undefined = body?.schemaName;
    const schema: any = body?.schema;

    const original = artifact.edited_json || artifact.content_json || {};

    // 3) Prompts: pedimos **APENAS JSON** se schema vier; senão, texto simples estruturado
    const wantJSON = Boolean(schema && schemaName);

    const systemPrompt = [
      "Você é um editor sênior de conteúdo para Instagram (reels, carrossel, live, post, stories).",
      "Tarefa: refinar/reescrever mantendo intenção, persona e formato.",
      wantJSON
        ? "Saída OBRIGATÓRIA: APENAS JSON válido conforme o schema fornecido (sem comentários, sem markdown)."
        : "Saída OBRIGATÓRIA: texto puro (sem markdown) com a estrutura pedida.",
    ].join(" ");

    const userPrompt = [
      `INSTRUÇÃO: ${instruction}`,
      `TIPO: ${artifact.tipo}`,
      `INDICE: ${artifact.indice ?? ""}`,
      `CONTEÚDO ATUAL (JSON): ${JSON.stringify(original)}`,
      wantJSON
        ? `RETORNE APENAS JSON que valide neste schema: ${JSON.stringify(schema)}`
        : "RETORNE APENAS o texto final, sem JSON, sem markdown.",
    ].join("\n\n");

    // 4) Chamada à API (sem response_format). Pedimos JSON pelo prompt quando necessário.
    const resp = await (openai as any).responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // orçamento generoso p/ refino
      max_output_tokens: 2000,
    });

    // 5) Extrai texto
    const raw = extractOutputText(resp).trim();

    // 6) Se schema foi informado, tentamos parsear JSON; senão, guardamos como { text }
    let refined: any;
    if (wantJSON) {
      try {
        refined = JSON.parse(raw);
      } catch (e) {
        // Se não veio JSON válido, empacota bruto para não perder o trabalho
        refined = { _raw: raw, _note: "Falha ao parsear JSON. Revise o prompt/schema ou refine novamente." };
      }
    } else {
      refined = { text: raw };
    }

    // 7) Atualiza artifact (edited_json)
    const { data: updated, error: upErr } = await supabase
      .from("artifacts")
      .update({
        edited_json: refined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", artifact.id)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, artifact: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
