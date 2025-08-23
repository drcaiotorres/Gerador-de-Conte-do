"use client";

import { useEffect, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas?: any;
};

type Tipo = "reels" | "post" | "carrossel" | "live" | "stories";

export default function Resultado() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [tipo, setTipo] = useState<Tipo>("reels");
  const [loading, setLoading] = useState(false);
  const [previewMd, setPreviewMd] = useState("");

  // Carrega semanas para o select
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/weeks");
        const json = await res.json().catch(() => null);
        if (json?.ok) setWeeks(json.data || json.weeks || []);
      } catch {
        // silencioso
      }
    })();
  }, []);

  async function onGenerate() {
    if (!selectedWeek) {
      alert("Selecione uma semana.");
      return;
    }
    setLoading(true);
    setPreviewMd("");
    try {
      const res = await fetch(`/api/generate/${selectedWeek}/${tipo}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `Erro HTTP ${res.status}`);
      }
      setPreviewMd(json.payload || "");
    } catch (e: any) {
      alert("Falha ao gerar: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Exporta o preview em DOCX
  async function onExportDocx() {
    try {
      const lines = (previewMd || "").split(/\r?\n/);
      const paragraphs = lines.map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line })],
            spacing: { after: 120 },
          })
      );
      const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}-${selectedWeek || "semana"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Falha ao exportar DOCX: " + (e?.message || e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-4">Gerar conteúdo</h1>

        <div className="grid md:grid-cols-3 gap-3">
          {/* Semana */}
          <select
            className="px-3 py-2 rounded bg-gray-800"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            <option value="">Selecione a semana…</option>
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.semana_iso} — {w.tema_central}
              </option>
            ))}
          </select>

          {/* Tipo de conteúdo */}
          <select
            className="px-3 py-2 rounded bg-gray-800"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
          >
            <option value="reels">Reels</option>
            <option value="post">Post estático</option>
            <option value="carrossel">Carrossel</option>
            <option value="live">Live</option>
            <option value="stories">Stories (7 dias)</option>
          </select>

          {/* Botão gerar */}
          <button
            className="btn btn-accent"
            onClick={onGenerate}
            disabled={!selectedWeek || loading}
          >
            {loading ? "Gerando..." : "Gerar este conteúdo"}
          </button>
        </div>
      </div>

      {/* Preview editável */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Preview editável</h2>
          <button
            className="btn px-4 py-2 rounded disabled:opacity-50"
            onClick={onExportDocx}
            disabled={!previewMd.trim()}
          >
            Exportar DOCX
          </button>
        </div>

        <textarea
          className="w-full min-h-[420px] p-3 rounded bg-gray-900 font-mono text-sm"
          value={previewMd}
          onChange={(e) => setPreviewMd(e.target.value)}
          placeholder="O conteúdo aparecerá aqui…"
        />
      </div>
    </div>
  );
}
