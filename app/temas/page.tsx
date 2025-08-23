// app/temas/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas?: string[] | null;
};

function splitSubtemas(input: string) {
  return (input || "")
    .split(/[,;|/]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function TemasPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(false);

  // ---- Criar semana ----
  const [form, setForm] = useState({
    semana_iso: "",
    tema_central: "",
    subtemasStr: "",
  });
  const canCreate = useMemo(
    () => form.semana_iso.trim() && form.tema_central.trim(),
    [form]
  );

  // ---- Upload em massa (semanas) ----
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  // ---- Upload ideias (globais) ----
  const [ideasFile, setIdeasFile] = useState<File | null>(null);
  const [ideasUploading, setIdeasUploading] = useState(false);

  // ---- Edição (modal simples) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editWeek, setEditWeek] = useState<Week | null>(null);
  const [editForm, setEditForm] = useState({
    semana_iso: "",
    tema_central: "",
    subtemasStr: "",
  });
  const canSaveEdit = useMemo(
    () => editForm.semana_iso.trim() && editForm.tema_central.trim(),
    [editForm]
  );

  // Carrega semanas
  const loadWeeks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/weeks", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setLoading(false);
      if (!json?.ok) {
        alert(json?.error || "Falha ao carregar semanas.");
        return;
      }
      setWeeks(json.data || []);
    } catch (e: any) {
      setLoading(false);
      alert("Erro ao buscar semanas: " + (e?.message || String(e)));
    }
  };

  useEffect(() => {
    loadWeeks();
  }, []);

  // Criar semana
  const onCreateWeek = async () => {
    if (!canCreate) return;
    try {
      const body = {
        semana_iso: form.semana_iso.trim(),
        tema_central: form.tema_central.trim(),
        subtemas: splitSubtemas(form.subtemasStr),
      };
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        return alert(json?.error || "Erro ao salvar semana.");
      }
      setForm({ semana_iso: "", tema_central: "", subtemasStr: "" });
      await loadWeeks();
      alert("Semana criada!");
    } catch (e: any) {
      alert("Erro ao criar semana: " + (e?.message || String(e)));
    }
  };

  // Abrir modal de edição
  const openEdit = (w: Week) => {
    setEditWeek(w);
    setEditForm({
      semana_iso: w.semana_iso || "",
      tema_central: w.tema_central || "",
      subtemasStr: Array.isArray(w.subtemas) ? w.subtemas.join(", ") : "",
    });
    setEditOpen(true);
  };

  // Salvar edição
  const onSaveEdit = async () => {
    if (!editWeek) return;
    if (!canSaveEdit) return;

    try {
      const body = {
        semana_iso: editForm.semana_iso.trim(),
        tema_central: editForm.tema_central.trim(),
        subtemas: splitSubtemas(editForm.subtemasStr),
      };
      const res = await fetch(`/api/weeks/${editWeek.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!json?.ok) {
        return alert(json?.error || "Erro ao salvar edição.");
      }
      setEditOpen(false);
      setEditWeek(null);
      await loadWeeks();
      alert("Semana atualizada!");
    } catch (e: any) {
      alert("Erro ao salvar edição: " + (e?.message || String(e)));
    }
  };

  // Upload em massa (semanas)
  const onBulkUpload = async () => {
    if (!bulkFile) return alert("Selecione um arquivo XLSX/CSV.");
    try {
      setBulkUploading(true);
      const fd = new FormData();
      fd.append("file", bulkFile);
      const res = await fetch("/api/weeks/bulk-upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      setBulkUploading(false);
      if (!json?.ok) {
        return alert(json?.error || "Falha no upload em massa.");
      }
      await loadWeeks();
      const msg =
        `Importação concluída. ` +
        (json.inserted != null ? `Inseridos: ${json.inserted}. ` : "") +
        (json.updated != null ? `Atualizados: ${json.updated}. ` : "") +
        (json.errors?.length ? `Com erros: ${json.errors.length}.` : "");
      alert(msg || "Upload concluído.");
    } catch (e: any) {
      setBulkUploading(false);
      alert("Erro no upload em massa: " + (e?.message || String(e)));
    }
  };

  // Download modelo CSV (client-side)
  const downloadWeeksTemplate = () => {
    const header = "semana_iso,tema_central,subtemas\n";
    const sample1 = '2025-W34,Ansiedade e emagrecimento,"ansiedade; fome emocional; respiração"\n';
    const sample2 = '2025-W35,A importância do sono,"ronco; apneia observada; higiene do sono"\n';
    const csv = header + sample1 + sample2;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo_semanas.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Upload de ideias (globais)
  const onIdeasUpload = async () => {
    if (!ideasFile) return alert("Selecione um arquivo XLSX/CSV.");
    try {
      setIdeasUploading(true);
      const fd = new FormData();
      fd.append("file", ideasFile);
      const res = await fetch("/api/ideas/upload", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      setIdeasUploading(false);
      if (!json?.ok) {
        return alert(json?.error || "Falha no upload das ideias.");
      }
      // aceita {count} ou {inserted}
      const count =
        typeof json.count === "number"
          ? json.count
          : typeof json.inserted === "number"
          ? json.inserted
          : null;
      alert(
        count != null
          ? `Ideias importadas: ${count}`
          : "Upload de ideias concluído."
      );
    } catch (e: any) {
      setIdeasUploading(false);
      alert("Erro no upload de ideias: " + (e?.message || String(e)));
    }
  };

  return (
    <main className="py-6 sm:py-10">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
        Temas & Subtemas
      </h1>

      {/* Criar Semana */}
      <section className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5 mb-5">
        <h2 className="text-lg font-semibold mb-3">Criar Semana</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base"
            placeholder="2025-W34"
            value={form.semana_iso}
            onChange={(e) => setForm({ ...form, semana_iso: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base"
            placeholder="Tema central"
            value={form.tema_central}
            onChange={(e) => setForm({ ...form, tema_central: e.target.value })}
          />
          <input
            className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base"
            placeholder="Subtemas (vírgula/; separados)"
            value={form.subtemasStr}
            onChange={(e) => setForm({ ...form, subtemasStr: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <button
            className="rounded bg-emerald-500 text-black font-semibold h-10 px-4 disabled:opacity-60"
            onClick={onCreateWeek}
            disabled={!canCreate}
          >
            Salvar semana
          </button>
        </div>
      </section>

      {/* Upload em Massa (Semanas) */}
      <section className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5 mb-5">
        <h2 className="text-lg font-semibold mb-3">Upload em massa (semanas)</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-white"
          />
          <div className="flex gap-2">
            <button
              className="rounded bg-indigo-500 text-black font-semibold h-10 px-4 disabled:opacity-60"
              onClick={onBulkUpload}
              disabled={!bulkFile || bulkUploading}
            >
              {bulkUploading ? "Enviando…" : "Enviar planilha"}
            </button>
            <button
              className="rounded bg-white/10 border border-white/10 h-10 px-4"
              onClick={downloadWeeksTemplate}
            >
              Baixar modelo CSV
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Colunas esperadas: <code>semana_iso</code>, <code>tema_central</code>,{" "}
          <code>subtemas</code> (use <code>;</code> ou <code>,</code> para separar).
        </p>
      </section>

      {/* Upload de Ideias (globais) */}
      <section className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5 mb-5">
        <h2 className="text-lg font-semibold mb-3">Upload de ideias (globais)</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setIdeasFile(e.target.files?.[0] || null)}
            className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-700 file:px-3 file:py-2 file:text-white"
          />
          <button
            className="rounded bg-sky-500 text-black font-semibold h-10 px-4 disabled:opacity-60"
            onClick={onIdeasUpload}
            disabled={!ideasFile || ideasUploading}
          >
            {ideasUploading ? "Enviando…" : "Enviar planilha"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Colunas aceitas: <code>pilar</code> (opcional), <code>tema</code> (opcional),{" "}
          <code>assunto</code> (opcional). Se preferir, use apenas{" "}
          <code>texto</code> em uma coluna.
        </p>
      </section>

      {/* Lista de semanas */}
      <section className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Semanas cadastradas</h2>
          <button
            onClick={loadWeeks}
            className="rounded bg-white/10 border border-white/10 h-9 px-3 text-sm"
          >
            Atualizar
          </button>
        </div>

        <div className="mt-3 max-h-[55vh] overflow-auto rounded border border-white/5">
          {loading ? (
            <div className="p-4 text-gray-400">Carregando…</div>
          ) : weeks.length === 0 ? (
            <div className="p-4 text-gray-400">Nenhuma semana cadastrada.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {weeks.map((w) => (
                <li
                  key={w.id}
                  className="p-3 sm:p-4 bg-gray-800/50 hover:bg-gray-800/70 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        {w.semana_iso} — {w.tema_central}
                      </div>
                      <div className="text-sm text-gray-300 line-clamp-2">
                        {Array.isArray(w.subtemas) && w.subtemas.length
                          ? w.subtemas.join(", ")
                          : "Sem subtemas"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-white/10 border border-white/10 h-9 px-3 text-sm"
                        onClick={() => openEdit(w)}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Modal de edição (implementação simples) */}
      {editOpen && editWeek && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center sm:justify-center">
          <div className="w-full sm:max-w-lg bg-[#0f141c] border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Editar semana</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded bg-white/10 border border-white/10 h-9 px-3 text-sm"
              >
                Fechar
              </button>
            </div>

            <div className="grid gap-2">
              <input
                className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base"
                placeholder="2025-W34"
                value={editForm.semana_iso}
                onChange={(e) =>
                  setEditForm({ ...editForm, semana_iso: e.target.value })
                }
              />
              <input
                className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base"
                placeholder="Tema central"
                value={editForm.tema_central}
                onChange={(e) =>
                  setEditForm({ ...editForm, tema_central: e.target.value })
                }
              />
              <textarea
                className="w-full px-3 py-2 rounded bg-gray-800 text-sm sm:text-base min-h-[120px]"
                placeholder="Subtemas (vírgula/; separados)"
                value={editForm.subtemasStr}
                onChange={(e) =>
                  setEditForm({ ...editForm, subtemasStr: e.target.value })
                }
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="rounded bg-blue-500 text-black font-semibold h-10 px-4 disabled:opacity-60"
                onClick={onSaveEdit}
                disabled={!canSaveEdit}
              >
                Salvar alterações
              </button>
              <button
                className="rounded bg-white/10 border border-white/10 h-10 px-4"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
