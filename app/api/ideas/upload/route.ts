// app/api/ideas/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import { EMBEDDINGS_MODEL } from "@/lib/openai";

export const runtime = "nodejs";         // garante acesso a Buffer e fs
export const dynamic = "force-dynamic";  // não cachear

type IdeaRow = {
  pilar: string | null;
  tema: string | null;
  assunto: string;
  texto: string;
};

function normalizeKey(k: string): string {
  return k
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")     // espaços e símbolos -> _
    .replace(/^_+|_+$/g, "");        // trim _
}

function pick<T extends Record<string, any>>(row: T, keys: string[]): any {
  for (const key of keys) {
    const nk = normalizeKey(key);
    for (const [rk, val] of Object.entries(row)) {
      if (normalizeKey(rk) === nk) return val;
    }
  }
  return null;
}

function toStringOrNull(v: any): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

async function embedAll(openai: OpenAI, texts: string[]): Promise<number[][]> {
  // Faz em lotes para evitar payload grande
  const batchSize = 96;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize);
    const resp = await openai.embeddings.create({
      model: EMBEDDINGS_MODEL || "text-embedding-3-small",
      input: chunk,
    });
    for (const d of resp.data) {
      out.push(d.embedding as unknown as number[]);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Arquivo não enviado. Selecione um .xlsx ou .csv." },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { ok: false, error: "Planilha vazia ou inválida." },
        { status: 400 }
      );
    }
    const sheet = wb.Sheets[sheetName];

    // Converte a planilha para objetos. defval mantém vazio como "" (não undefined).
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // Mapeia linhas -> IdeaRow (suporta headers com variações/acentos/maiúsculas)
    const items: IdeaRow[] = [];
    for (const r of rawRows) {
      // normaliza chaves para busca tolerante
      const normRow: Record<string, any> = {};
      for (const [k, v] of Object.entries(r)) normRow[k] = v;

      const pilar = toStringOrNull(pick(normRow, ["pilar"]));
      const tema = toStringOrNull(pick(normRow, ["tema"]));
      // "assunto" é preferido; se não houver, aceita "ideia"
      const assunto =
        toStringOrNull(pick(normRow, ["assunto"])) ??
        toStringOrNull(pick(normRow, ["ideia"]));

      if (!assunto) continue; // precisa ao menos do assunto/ideia

      const texto = [pilar, tema, assunto].filter(Boolean).join(" | ");
      items.push({ pilar: pilar ?? null, tema: tema ?? null, assunto, texto });
    }

    if (items.length === 0) {
      return NextResponse.json({ ok: true, count: 0, embeddings: 0 });
    }

    // Tenta gerar embeddings (com fallback se quota/erro)
    let embeddings: number[][] | null = null;
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      embeddings = await embedAll(openai, items.map((i) => i.texto));
    } catch (e: any) {
      // quota/erro → prosseguir salvando sem embeddings
      embeddings = null;
    }

    // Insere no Supabase (global: sem week_id)
    const supabase = supabaseServer();

    // (Opcional) Inserir em lotes para tabelas grandes
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize).map((it, idx) => ({
        pilar: it.pilar,
        tema: it.tema,
        assunto: it.assunto,
        texto: it.texto,
        embedding: embeddings ? embeddings[i + idx] : null,
      }));

      const { error } = await supabase.from("ideas").insert(chunk);
      if (error) {
        // Se houver duplicatas (índice unique), podemos reportar parcial
        if (error.code === "23505") {
          // Ignora duplicatas silenciosamente e continua (melhor UX)
          // Tenta inserir uma a uma para salvar o resto sem falhar tudo
          for (const row of chunk) {
            const { error: e2 } = await supabase.from("ideas").insert(row);
            if (!e2) inserted += 1;
            // se e2.code === 23505, ignora; outros erros param
            else if (e2.code !== "23505") {
              return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
            }
          }
        } else {
          return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        }
      } else {
        inserted += chunk.length;
      }
    }

    return NextResponse.json({
      ok: true,
      count: inserted,
      embeddings: embeddings ? inserted : 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
