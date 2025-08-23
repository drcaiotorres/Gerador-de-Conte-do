
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@../../../lib/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: { generationId: string }}) {
  const supabase = supabaseServer();
  const { data, error } = await supabase.from("generation_versions").select("*").eq("generation_id", params.generationId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest, { params }: { params: { generationId: string }}) {
  const supabase = supabaseServer();
  const body = await req.json();
  const { label, payload, edited_payload } = body;
  const { data, error } = await supabase.from("generation_versions").insert({
    generation_id: params.generationId,
    label: label || "snapshot",
    payload,
    edited_payload
  }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
