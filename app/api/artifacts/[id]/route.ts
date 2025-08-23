
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@../../../lib/supabaseServer";

export async function PATCH(req: NextRequest, { params }: { params: { id: string }}) {
  const body = await req.json();
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("artifacts").update(body).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
