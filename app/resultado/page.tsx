'use client';

import { useEffect, useMemo, useState } from 'react';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas?: string[];
};

type GeneratePayload = {
  week: { id: string; semana_iso: string; tema_central: string; subtemas?: string[] };
  ideas_sample?: string[];
  outputs: Array<{ type: string; index?: number; content: string }>;
};

export default function ResultadoPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [generationId, setGenerationId] = useState<string | null>(null);
  const [payload, setPayload] = useState<GeneratePayload | null>(null);
  const [previewMd, setPreviewMd] = useState<string>('');

  // estado da área "refazer"
  const [tipoRefazer, setTipoRefazer] = useState<string>('reels');
  const [indiceRefazer, setIndiceRefazer] = useState<string>('');
  const [instrucaoRefazer, setInstrucaoRefazer] = useState<string>('');
  const [refazLoading, setRefazLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // -------- helpers --------
  const findWeek = (id: string) => weeks.find((w) => w.id === id);

  async function safeJson(res: Response): Promise<any> {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    const txt = await res.text();
    throw new Error(txt || `Erro HTTP ${res.status}`);
  }

  function payloadToMarkdown(p: GeneratePayload): string {
    const lines: string[] = [];
    lines.push(`# Pacote da Semana ${p.week.semana_iso} — ${p.week.tema_central}`);
    const subs = (p.week.subtemas || []).join(', ');
    if (subs) lines.push(`**Subtemas:** ${subs}`);
    lines.push('');

    const groups = p.outputs.reduce<Record<string, { type: string; items: string[] }>>((acc, o) => {
      const key = o.type;
      if (!acc[key]) acc[key] = { type: key, items: [] };
      const labelIndex = o.index ? ` ${o.index}` : '';
      acc[key].items.push(`### ${o.type.toUpperCase()}${labelIndex}\n\n${(o.content || '').trim()}\n`);
      return acc;
    }, {});

    const order = ['reels', 'post', 'carrossel', 'live', 'stories'];
    for (const key of order) {
      if (!groups[key]) continue;
      const sectionTitle =
        key === 'reels' ? 'Reels (3 scripts)' :
        key === 'post' ? 'Post Estático' :
        key === 'carrossel' ? 'Carrossel' :
        key === 'live' ? 'Roteiro de Live' :
        key === 'stories' ? 'Stories (7 dias)' : key;

      lines.push(`## ${sectionTitle}`);
      lines.push('');
      lines.push(groups[key].items.join('\n'));
    }

    if (p.ideas_sample && p.ideas_sample.length) {
      lines.push('\n---\n');
      lines.push('#### Ideias relacionadas (amostra)');
      for (const [i, t] of p.ideas_sample.entries()) {
        lines.push(`- (${i + 1}) ${t}`);
      }
    }

    return lines.join('\n');
  }

  // -------- effects --------
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/weeks', { cache: 'no-store' });
        const data = await safeJson(res);
        const arr: Week[] = Array.isArray(data) ? data : data.weeks || data.data || [];
        setWeeks(arr);
        if (!selectedWeek && arr.length) setSelectedWeek(arr[0].id);
      } catch (e: any) {
        alert(`Falha ao carregar semanas: ${e?.message || String(e)}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (payload) setPreviewMd(payloadToMarkdown(payload));
  }, [payload]);

  const fileName = useMemo(() => {
    const w = payload?.week || findWeek(selectedWeek);
    const iso = w?.semana_iso?.replace(/[^\w-]+/g, '-') || 'semana';
    const tema = (w?.tema_central || 'conteudo').replace(/[^\w-]+/g, '-').slice(0, 50);
    return `${iso}-${tema}.docx`;
  }, [payload, selectedWeek, weeks]);

  // -------- handlers --------
  const onGenerate = async () => {
    if (!selectedWeek) return alert('Selecione uma semana.');
    setLoading(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120000);
      const res = await fetch(`/api/generate/${selectedWeek}`, { method: 'POST', signal: ctrl.signal });
      clearTimeout(timer);

      const data = await safeJson(res);
      if (!data?.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);

      setGenerationId(data.generation_id ?? null);
      setPayload(data.payload as GeneratePayload);
    } catch (err: any) {
      alert(err?.name === 'AbortError' ? 'Tempo esgotado (120s). Tente novamente.' : `Falha ao gerar: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const onExportDocx = async () => {
    if (!previewMd.trim()) return alert('Nada para exportar.');

    const titulo = payload
      ? `Pacote da Semana ${payload.week.semana_iso} — ${payload.week.tema_central}`
      : 'Pacote da Semana';
    const name = fileName || 'pacote-semana.docx';

    const lines = previewMd.split(/\r?\n/);
    const children: Paragraph[] = [
      new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: '' }),
    ];

    for (const line of lines) {
      if (line.startsWith('### ')) {
        children.push(new Paragraph({ text: line.replace(/^###\s*/, ''), heading: HeadingLevel.HEADING_3 }));
      } else if (line.startsWith('## ')) {
        children.push(new Paragraph({ text: line.replace(/^##\s*/, ''), heading: HeadingLevel.HEADING_2 }));
      } else if (line.startsWith('# ')) {
        children.push(new Paragraph({ text: line.replace(/^#\s*/, ''), heading: HeadingLevel.HEADING_1 }));
      } else {
        children.push(new Paragraph({ text: line.length ? line : ' ' }));
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const onSaveEdits = async () => {
    if (!generationId) return alert("Gere primeiro para ter um 'generation_id'.");
    setSalvando(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_payload: { markdown: previewMd } })
      });
      const data = await safeJson(res);
      if (!data?.ok) throw new Error(data?.error || "Falha ao salvar.");
      alert("Edição salva no histórico! ✅");
    } catch (e:any) {
      alert(`Erro ao salvar: ${e?.message || String(e)}`);
    } finally {
      setSalvando(false);
    }
  };

  const onRegenerate = async () => {
    if (!generationId) return alert("Gere primeiro para ter um 'generation_id'.");
    if (!tipoRefazer) return alert("Selecione o tipo da peça.");
    setRefazLoading(true);
    try {
      const res = await fetch("/api/artifacts/regenerate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          generation_id: generationId,
          tipo: tipoRefazer,
          indice: indiceRefazer ? Number(indiceRefazer) : null,
          instruction: instrucaoRefazer || "Refaça mantendo o mesmo formato e limites de tempo/tamanho."
        })
      });
      const data = await safeJson(res);
      if (!data?.ok) throw new Error(data?.error || "Falha ao refazer.");
      const novo = String(data.content || "").trim();
      if (!novo) throw new Error("Retorno vazio.");

      // acrescenta o bloco novo no preview (simples e claro)
      const header = `\n## ${tipoRefazer === 'reels' ? 'Reels (refeito)' :
                             tipoRefazer === 'post' ? 'Post Estático (refeito)' :
                             tipoRefazer === 'carrossel' ? 'Carrossel (refeito)' :
                             tipoRefazer === 'live' ? 'Roteiro de Live (refeito)' :
                             'Stories (refeito)'}\n\n`;
      setPreviewMd(prev => prev + header + novo + "\n");

      alert("Peça refeita adicionada ao preview! ✅");
    } catch (e:any) {
      alert(`Erro ao refazer: ${e?.message || String(e)}`);
    } finally {
      setRefazLoading(false);
    }
  };

  // -------- UI --------
  return (
    <div className="space-y-6">
      {/* Card de geração */}
      <div className="card p-4">
        <h1 className="text-2xl font-semibold mb-4">Gerar Pacote da Semana</h1>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <select
            className="px-3 py-2 rounded bg-gray-800"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {weeks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.semana_iso} — {w.tema_central}
              </option>
            ))}
          </select>

          <button
            className="btn btn-accent px-4 py-2 rounded disabled:opacity-50"
            onClick={onGenerate}
            disabled={loading || !selectedWeek}
            title="Gera: Reels → Post → Carrossel → Live → Stories"
          >
            {loading ? 'Gerando...' : 'Gerar pacote (ordem 1→5)'}
          </button>
        </div>
      </div>

      {/* Card do preview + ações */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Preview editável</h2>
          <div className="flex gap-2">
            <button className="btn px-4 py-2 rounded disabled:opacity-50"
              onClick={onSaveEdits}
              disabled={!previewMd.trim() || !generationId || salvando}
            >
              {salvando ? "Salvando..." : "Salvar edição"}
            </button>
            <button className="btn px-4 py-2 rounded disabled:opacity-50"
              onClick={onExportDocx}
              disabled={!previewMd.trim()}
            >
              Exportar DOCX
            </button>
          </div>
        </div>

        <textarea
          className="w-full min-h-[480px] bg-gray-900 text-gray-100 rounded p-3 leading-6"
          placeholder="Gere o pacote para visualizar aqui…"
          value={previewMd}
          onChange={(e) => setPreviewMd(e.target.value)}
        />

        {generationId && (
          <p className="text-xs text-gray-400">generation_id: {generationId}</p>
        )}
      </div>

      {/* Card: Refazer peça com feedback */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xl font-semibold">Refazer peça (feedback)</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <select className="px-3 py-2 rounded bg-gray-800" value={tipoRefazer} onChange={(e)=>setTipoRefazer(e.target.value)}>
            <option value="reels">Reels</option>
            <option value="post">Post</option>
            <option value="carrossel">Carrossel</option>
            <option value="live">Live</option>
            <option value="stories">Stories</option>
          </select>

          <input
            className="px-3 py-2 rounded bg-gray-800"
            placeholder="Índice (ex.: 2 para Reels 2) — opcional"
            value={indiceRefazer}
            onChange={(e)=>setIndiceRefazer(e.target.value)}
          />

          <input
            className="px-3 py-2 rounded bg-gray-800 md:col-span-2"
            placeholder="Instrução (ex.: mais direto, 45–55s, troque o hook)"
            value={instrucaoRefazer}
            onChange={(e)=>setInstrucaoRefazer(e.target.value)}
          />
        </div>

        <div>
          <button className="btn btn-accent px-4 py-2 rounded disabled:opacity-50"
            onClick={onRegenerate}
            disabled={refazLoading || !generationId}
          >
            {refazLoading ? "Refazendo..." : "Refazer peça"}
          </button>
        </div>
      </div>
    </div>
  );
}
