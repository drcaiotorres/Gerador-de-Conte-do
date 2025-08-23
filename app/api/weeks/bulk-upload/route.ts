// app/api/weeks/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const maxDuration = 120;

/** remove acentos, normaliza espaços e caixa */
function rmAccents(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** normaliza cabeçalhos para chaves conhecidas, aceitando muitas variações */
function normalizeHeader(h: string) {
  const raw = String(h || "");
  // tira acentos, troca tudo que não alfanum por espaço, compacta
  const key = rmAccents(raw.replace(/[^a-z0-9]+/gi, " "));

  // semana iso direto
  if (key.includes("semana") && key.includes("iso")) return "semana_iso";

  // semana genérica (ex.: "semana", "n semana", "numero semana", "week", "wk", "sem")
  if (
    key === "semana" ||
    key.includes("n semana") ||
    key.includes("numero semana") ||
    key === "sem" ||
    key === "week" ||
    key === "wk"
  ) {
    return "semana"; // usaremos com ano ou data_inicio
  }

  // tema
  if (key.includes("tema central") || key.includes("assunto central")) return "tema_central";
  if (key === "tema" || key.includes("tema")) return "tema";

  // subtemas (coluna única)
  if (key === "subtemas" || key.includes("sub temas") || key.includes("subtema(s)")) return "subtemas";

  // subtema1..N (aceita "sub1", "sub 1", "subtema 1", "sub_topico_3", etc.)
  const mSub = key.match(/^sub.*?(\d{1,2})$/);
  if (mSub) return `subtema${mSub[1]}`;

  // datas e auxiliares
  if (key === "data" || key === "data inicio" || key === "inicio" || key === "date" || key === "start")
    return "data_inicio";
  if (key === "ano" || key === "year") return "ano";
  if (key === "num semana" || key === "n semana" || key === "numero semana" || key === "week number")
    return "num_semana";

  // fallback: retorna a própria chave normalizada
  return key;
}

/** excel serial date (1900-based) -> JS Date */
function excelDateToJSDate(n: number) {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const ms = n * 24 * 60 * 60 * 1000;
  return new Date(epoch.getTime() + ms);
}

/** date -> "YYYY-Www" */
function toISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

/** tenta obter "YYYY-Www" a partir de vários formatos possíveis */
function normalizeSemanaIso(raw: any, row: any) {
  // 1) já "YYYY-Www"
  if (typeof raw === "string" && /^(19|20)\d{2}-W\d{2}$/i.test(raw.trim())) {
    return raw.trim();
  }

  // 2) número excel (data)
  if (typeof raw === "number" && isFinite(raw)) {
    const dt = excelDateToJSDate(raw);
    return toISOWeek(dt);
  }

  // 3) string de data
  if (typeof raw === "string") {
    const s = raw.trim();
    // padrões "YYYY W##", "YYYY-W##", "YYYY/##", etc.
    let m = s.match(/^((19|20)\d{2})\s*[-/ ]?\s*W?\s*(\d{1,2})$/i);
    if (m) {
      const year = parseInt(m[1], 10);
      const wk = parseInt(m[3], 10);
      if (wk >= 1 && wk <= 53) return `${year}-W${String(wk).padStart(2, "0")}`;
    }
    // padrões "W## YYYY", "##-YYYY", "##/YYYY"
    m = s.match(/^W?\s*(\d{1,2})\s*[-/ ]\s*((19|20)\d{2})$/i);
    if (m) {
      const wk = parseInt(m[1], 10);
      const year = parseInt(m[2], 10);
      if (wk >= 1 && wk <= 53) return `${year}-W${String(wk).padStart(2, "0")}`;
    }
    // apenas "W##" ou "##" com ano em outra coluna
    m = s.match(/^W?\s*(\d{1,2})$/i);
    if (m) {
      const wk = parseInt(m[1], 10);
      const yearFromRow = parseInt(row?.ano, 10);
      const year = !isNaN(yearFromRow) && yearFromRow > 1900 ? yearFromRow : new Date().getFullYear();
      if (wk >= 1 && wk <= 53) return `${year}-W${String(wk).padStart(2, "0")}`;
    }
    // tenta como data genérica
    const dt = new Date(s);
    if (!isNaN(+dt)) return toISOWeek(dt);
  }

  // 4) colunas auxiliares: ano + num_semana
  const ano = Number(row?.ano);
  const num = Number(row?.num_semana);
  if (!isNaN(ano) && !isNaN(num) && ano > 1900 && num >= 1 && num <= 53) {
    return `${ano}-W${String(num).padStart(2, "0")}`;
  }

  // 5) data_inicio auxiliar
  if (row?.data_inicio) {
    const v = row.data_inicio;
    if (typeof v === "number" && isFinite(v)) return toISOWeek(excelDateToJSDate(v));
    const dt = new Date(v);
    if (!isNaN(+dt)) return toISOWeek(dt);
  }

  return null;
}

/** junta subtemas a partir de várias colunas possíveis */
function normalizeSubtemas(row: any) {
  const chunks: string[] = [];

  // coluna única "subtemas" (aceita vírgula, ;, |, / e quebras de linha)
  if (row?.subtemas) {
    String(row.subtemas)
      .split(/[,;|/\n\r]+/g)
      .forEach((p) => {
        const t = p.trim();
        if (t) chunks.push(t);
      });
  }

  // colunas subtema1..subtema8
  for (let i = 1; i <= 12; i++) {
    const k = `subtema${i}`;
    if (row?.[k]) {
      const t = String(row[k]).trim();
      if (t) chunks.push(t);
    }
  }

  // qualquer coluna que comece com "sub" + número (ex.: "sub 1", "subtopico3")
  Object.keys(row || {}).forEach((k) => {
    const lk = rmAccents(k.replace(/[^a-z0-9]+/gi, " "));
    const m = lk.match(/^sub.*?(\d{1,2})$/);
    if (m && row[k]) {
      const t = String(row[k]).trim();
      if (t) chunks.push(t);
    }
  });

  // de-duplicar preservando ordem
  const seen = new Set<string>();
  const arr: string[] = [];
  for (const c of chunks) {
    const key = c.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(c);
    }
  }
  return arr;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Envie um arquivo no campo 'file'." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // lê a planilha; a 1ª linha vira cabeçalho
    let rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // mapeia cabeçalhos para chaves normalizadas
    const normalizedRows = rows.map((r) => {
      const out: any = {};
      for (const [k, v] of Object.entries(r)) {
        out[normalizeHeader(String(k))] = v;
      }
      return out;
    });

    // monta payload
    const payload: any[] = [];
    const errors: Array<{ row: number; msg: string }> = [];

    for (let idx = 0; idx < normalizedRows.length; idx++) {
      const r = normalizedRows[idx];

      // prioridade de origem da semana
      const semanaRaw =
        r.semana_iso ??
        r.semana ??
        r.data_inicio ??
        r["semana (iso)"] ??
        r["iso week"] ??
        null;

      const semana_iso = normalizeSemanaIso(semanaRaw, r);

      // tema
      let tema_central = "";
      if (typeof r.tema_central === "string" && r.tema_central.trim()) tema_central = r.tema_central.trim();
      else if (typeof r.tema === "string" && r.tema.trim()) tema_central = r.tema.trim();
      else if (typeof r.assunto === "string" && r.assunto.trim()) tema_central = r.assunto.trim();
      else if (typeof r.titulo === "string" && r.titulo.trim()) tema_central = r.titulo.trim();

      const subtemas = normalizeSubtemas(r);

      if (!semana_iso) {
        errors.push({ row: idx + 2, msg: "semana_iso ausente ou inválida (tente 'semana_iso', 'semana', 'data', 'ano' + 'num_semana')" });
        continue;
      }
      if (!tema_central) {
        errors.push({ row: idx + 2, msg: "tema_central ausente (tente 'tema_central', 'tema', 'assunto', 'titulo')" });
        continue;
      }

      payload.push({
        semana_iso,
        tema_central,
        subtemas: subtemas.length ? subtemas : [],
      });
    }

    if (payload.length === 0) {
      // ajuda de debug: mostra cabeçalhos normalizados e primeiras linhas
      const sampleHeaders = normalizedRows[0] ? Object.keys(normalizedRows[0]) : [];
      const sampleFirst = normalizedRows.slice(0, 3);
      return NextResponse.json(
        {
          ok: false,
          error: "Nenhuma linha válida para importar.",
          hint: "Verifique cabeçalhos e formatos: semana_iso ou data/ano+num_semana; tema_central/tema; subtemas ou subtema1..",
          sampleHeaders,
          sampleFirst,
          errors,
        },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // upsert por semana_iso
    const { data, error } = await supabase
      .from("weeks")
      .upsert(payload, { onConflict: "semana_iso" })
      .select("*");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imported: data?.length || 0,
      errors,
      sample: data?.slice(0, 3) || [],
    });
  } catch (e: any) {
    console.error("bulk-upload weeks error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro interno." }, { status: 500 });
  }
}
