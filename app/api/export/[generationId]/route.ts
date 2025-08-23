
import { NextRequest } from "next/server";
import { supabaseServer } from "@../../../lib/supabaseServer";
import { payloadToMarkdown } from "@../../../lib/exporters";

export async function GET(req: NextRequest, { params }: { params: { generationId: string }}) {
  const genId = params.generationId;
  const supabase = supabaseServer();
  const { data: gen, error } = await supabase.from("generations").select("*").eq("id", genId).single();
  if (error) return new Response(JSON.stringify({ ok:false, error: error.message }), { status: 500 });

  const payload = gen.edited_payload || gen.payload || {};
  const md = payloadToMarkdown(payload);
  return new Response(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="semana-${genId}.md"`
    }
  });
}
