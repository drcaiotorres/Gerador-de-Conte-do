// app/resultado/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** Opções de formato (um por vez) */
const TIPOS = [
  { value: "reels", label: "Reel" },
  { value: "post", label: "Post estático" },
  { value: "carrossel", label: "Carrossel" },
  { value: "live", label: "Live (roteiro)" },
  { value: "stories", label: "Stories (7 dias)" },
] as const;

type Tipo = (typeof TIPOS)[number]["value"];

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas?: string[] | null;
};

export default function ResultadoPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [tipo, setTipo] = useState<Tipo>("reels");

  const [loading, setLoading] = useState(false);
  const [previewMd, setPreviewMd] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  /** Carrega semanas para o select */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/weeks", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!json?.ok) throw new Error(json?.error || "Falha ao buscar semanas");
        const arr: Week[] = json.data || [];
        setWeeks(arr);
        if (arr.length && !selectedWeek) {
          setSelectedWeek(arr[0].id);
        }
      } catch (e: any) {
        alert("Erro ao carregar semanas: " + (e?.message || String(e)));
      }
    };
    load();
  }, []);

  /** Label da semana selecionada */
  const selectedWeekLabel = useMemo(() => {
    const w = weeks.find((x) => x.id === selectedWeek);
    if (!w) return "";
    return `${w.semana_iso} — ${w.tema_central}`;
  }, [weeks, selectedWeek]);

  /** Geração (um formato de cada vez) */
  const onGenerate = async () => {
    if (!selectedWeek) return alert("Selecione uma semana.");
    if (!tipo) return alert("Selecione um formato.");

    try {
      setLoading(true);
      setPreviewMd("");
      setGenerationId(null);

      // timeout com AbortController (evita spinner infinito no mobile)
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();
      const id = setTimeout(() => controllerRef.current?.abort(), 120000); // 120s

      const res = await fetch(`/api/generate/${selectedWeek}/${tipo}`, {
        method: "POST",
        signal: controllerRef.current.signal,
      });

      clearTimeout(id);

      const json = await res.json().catch(() => null);

      setLoading(false);

      if (!json?.ok) {
        const err = json?.error || "Falha ao gerar conteúdo.";
        alert("Falha ao gerar: " + err);
        return;
      }

      // tenta vários caminhos de retorno para ser tolerante
      const fromPreview = json.previewMd || json.preview_md;
      const fromPayload =
        json.payload?.previewMd ||
        json.payload?.markdown ||
        json.payload?.text ||
        json.payload?.content;

      const text =
        typeof fromPreview === "string"
          ? fromPreview
          : typeof fromPayload === "string"
          ? fromPayload
          : stringifyPayload(json.payload);

      setPreviewMd(text || "");
      setGenerationId(json.generationId || json.generation_id || null);
    } catch (e: any) {
      setLoading(false);
      if (e?.name === "AbortError") {
        alert("Tempo esgotado (120s). Tente novamente.");
      } else {
        alert("Erro ao gerar: " + (e?.message || String(e)));
      }
    }
  };

  /** Salvar edição no histórico (se existir generationId) */
  const onSave = async () => {
    if (!generationId) {
      return alert("Nada para salvar ainda. Gere um conteúdo primeiro.");
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/generations/${generationId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edited_markdown: previewMd,
          tags: [tipo],
        }),
      });
      const json = await res.json().catch(() => null);
      setSaving(false);
      if (!json?.ok) {
        return alert(json?.error || "Falha ao salvar edição.");
      }
      alert("Versão salva no histórico!");
    } catch (e: any) {
      setSaving(false);
      alert("Erro ao salvar: " + (e?.message || String(e)));
    }
  };

  /** Exportar DOCX (client-side) */
  const onExportDocx = async () => {
    if (!previewMd.trim()) return alert("Nada para exportar.");
    try {
      const { Document, Packer, Paragraph, TextRun } = await import("docx");

      const paragraphs = mdToParagraphs(previewMd).map(
        (line) => new Paragraph({ children: [new TextRun(line)] })
      );

      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      });

      const blob = await Packer.toBlob(doc);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const suffix = TIPOS.find((t) => t.value === tipo)?.label || "Conteudo";
      a.download = `${selectedWeekLabel || "semana"} - ${suffix}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      alert("Falha ao exportar DOCX: " + (e?.message || String(e)));
    }
  };

  /** UI */
  return (
    <div className="pb-24">
      {/* Barra fixa no topo (mobile-first) */}
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-[#0b0f14]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f14]/60 border-b border-white/5">
        <div className="px-3 sm:px-0 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* linha 1: selects */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <select
              className="w-full sm:w-[420px] rounded-lg bg-[#121822] text-gray-100 px-3 py-3 text-base outline-none border border-white/10"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              {weeks.length === 0 && <option value="">Carregando…</option>}
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.semana_iso} — {w.tema_central}
                </option>
              ))}
            </select>

            <select
              className="w-full sm:w-48 rounded-lg bg-[#121822] text-gray-100 px-3 py-3 text-base outline-none border border-white/10"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as Tipo)}
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* linha 2: ações */}
          <div className="flex gap-2">
            <button
              onClick={onGenerate}
              disabled={loading || !selectedWeek}
              className="flex-1 sm:flex-none rounded-lg bg-emerald-500 text-black font-semibold px-4 py-3 disabled:opacity-60 active:scale-[.99] transition"
            >
              {loading ? "Gerando…" : "Gerar"}
            </button>

            <button
              onClick={onSave}
              disabled={!generationId || saving}
              className="hidden sm:inline-flex rounded-lg bg-blue-500 text-black font-semibold px-4 py-3 disabled:opacity-60 active:scale-[.99] transition"
            >
              {saving ? "Salvando…" : "Salvar versão"}
            </button>

            <button
              onClick={onExportDocx}
              disabled={!previewMd.trim()}
              className="hidden sm:inline-flex rounded-lg bg-white/10 text-gray-100 font-medium px-4 py-3 border border-white/10 disabled:opacity-60 active:scale-[.99] transition"
            >
              Exportar DOCX
            </button>
          </div>
        </div>
      </div>

      {/* Ações extras (mobile) */}
      <div className="mt-3 flex sm:hidden gap-2">
        <button
          onClick={onSave}
          disabled={!generationId || saving}
          className="flex-1 rounded-lg bg-blue-500 text-black font-semibold px-4 py-3 disabled:opacity-60 active:scale-[.99] transition"
        >
          {saving ? "Salvando…" : "Salvar versão"}
        </button>
        <button
          onClick={onExportDocx}
          disabled={!previewMd.trim()}
          className="flex-1 rounded-lg bg-white/10 text-gray-100 font-medium px-4 py-3 border border-white/10 disabled:opacity-60 active:scale-[.99] transition"
        >
          DOCX
        </button>
      </div>

      {/* Preview editável */}
      <div className="mt-4">
        <label className="block text-sm text-gray-400 mb-2">
          Preview editável (Markdown / texto corrido)
        </label>
        <textarea
          className="w-full min-h-[64vh] sm:min-h-[70vh] rounded-lg bg-[#0f141c] border border-white/10 px-3 py-3 text-[15px] leading-6 outline-none"
          placeholder={
            loading
              ? "Gerando conteúdo…"
              : "O conteúdo aparecerá aqui. Edite livremente antes de salvar ou exportar."
          }
          value={previewMd}
          onChange={(e) => setPreviewMd(e.target.value)}
        />
      </div>

      {/* Rodapé com instruções rápidas */}
      <div className="mt-3 text-xs text-gray-400 space-y-1">
        <p>
          Dica: no mobile, os botões principais ficam na barra fixa superior e
          logo abaixo (Salvar / DOCX).
        </p>
        <p>
          Observação: “Salvar versão” mantém o histórico da semana; “DOCX”
          exporta o texto atual do preview.
        </p>
      </div>
    </div>
  );
}

/** Fallback: transforma payload desconhecido em texto legível */
function stringifyPayload(payload: any) {
  try {
    if (!payload) return "";
    if (typeof payload === "string") return payload;
    if (payload?.text) return String(payload.text);
    return JSON.stringify(payload, null, 2);
  } catch {
    return "";
  }
}

/** Converte markdown simples em linhas para o DOCX */
function mdToParagraphs(md: string) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  // remove excesso de espaços, mas mantém linhas vazias para espaçamento
  return lines.map((l) => l.replace(/\s+$/g, ""));
}
