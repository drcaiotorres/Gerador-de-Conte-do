
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { openai, OPENAI_MODEL } from "@/lib/openai";

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const { feedback, promptGeral, promptFormato, contextoSemana, ideiasRelevantes, blocoAtual, jsonSchema, schemaName } = await req.json();
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: promptGeral },
      { role: "user", content: `Contexto da semana: ${contextoSemana}` },
      { role: "user", content: `Ideias relevantes: ${ideiasRelevantes}` },
      { role: "user", content: `Versão atual do bloco: ${JSON.stringify(blocoAtual)}` },
      { role: "user", content: `Ajuste este bloco seguindo o feedback: ${feedback}` },
      { role: "user", content: promptFormato }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName || "refine_schema",
        schema: jsonSchema
      }
    }
  });
  const text = (response as any).output_text;
  const updated = JSON.parse(text || "{}");

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("artifacts").update({ edited_json: updated }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data: updated });
}
