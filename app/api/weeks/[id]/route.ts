// app/api/weeks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function splitSubtemas(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[,;|/]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

async function handleUpdate(req: NextRequest, params: { id: string }) {
  const { id } = params || {};
  if (!id) {
    return NextResponse.json({ ok: false, error: "Parâmetro 'id' ausente." }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido no corpo da requisição." }, { status: 400 });
  }

  const semana_iso = (body?.semana_iso ?? "").toString().trim();
  const tema_central = (body?.tema_central ?? "").toString().trim();
  const subtemas = splitSubtemas(body?.subtemas);

  if (!semana_iso || !tema_central) {
    return NextResponse.json(
      { ok: false, error: "Campos obrigatórios: 'semana_iso' e 'tema_central'." },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();
  const updatePayload = {
    semana_iso,
    tema_central,
    subtemas,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("weeks")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    // Trate conflito por índice único de semana_iso de forma clara
    const msg = error.message || "Erro ao atualizar.";
    const status = msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")
      ? 409
      : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  return NextResponse.json({ ok: true, data });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  return handleUpdate(req, ctx.params);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  return handleUpdate(req, ctx.params);
}
