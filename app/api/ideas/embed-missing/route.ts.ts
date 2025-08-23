import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabaseServer";
import OpenAI from "openai";
import { EMBEDDINGS_MODEL } from "../../../../lib/openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { limit = 500 } = await req.json().catch(() => ({ limit: 500 }));
    const supabase = supabaseServer();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const { data: rows, error } = await supabase
      .from("ideas")
      .select("id, texto")
      .is("embedding", null)
      .limit(limit);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!rows || rows.length === 0) return NextResponse.json({ ok: true, updated: 0 });

    const resp = await openai.embeddings.create({
      model: EMBEDDINGS_MODEL, // text-embedding-3-small
      input: rows.map(r => r.texto)
    });

    const updates = rows.map((r, i) => ({ id: r.id, embedding: (resp.data[i].embedding as any) }));
    const { error: uerr } = await supabase.from("ideas").upsert(updates);
    if (uerr) return NextResponse.json({ ok: false, error: uerr.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

