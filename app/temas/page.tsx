"use client";

import React, { useEffect, useState } from "react";

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas: string[] | string | null;
  created_at?: string;
  updated_at?: string;
};

function splitSubtemas(input: string) {
  return input
    .split(/[,;|\/]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function TemasPage() {
  // --- estados principais ---
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // criar semana (unitário)
  const [form, setForm] = useState({
    semana_iso: "",
    tema_central: "",
    subtemas: "",
  });
  const [savingWeek, setSavingWeek] = useState(false);

  // upload de IDEIAS (global)
  const [ideasFile, setIdeasFile] = useState<File | null>(null);
  const [uploadingIdeas, setUploadingIdeas] = useState(false);

  // upload em massa de WEEKS
  const [weeksFile, setWeeksFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);

  // edição inline de semana
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    semana_iso: "",
    tema_central: "",
    subtemas: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // --- carregar lista de semanas ---
  const load = async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/weeks", { cache: "no-store" });
      const json = await safeJson(res);
      setLoadingList(false);
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Falha ao carregar semanas.");
        return;
      }
      setWeeks(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setLoadingList(false);
      alert("Erro ao listar semanas: " + (e?.message || e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  // --- criar semana (unitário) ---
  const createWeek = async () => {
    if (!form.semana_iso.trim() || !form.tema_central.trim()) {
      alert("Preencha semana e tema.");
      return;
    }
    setSavingWeek(true);
    try {
      const body = {
        semana_iso: form.semana_iso.trim(),
        tema_central: form.tema_central.trim(),
        subtemas: splitSubtemas(form.subtemas || ""),
      };
      const res = await fetch("/api/weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await safeJson(res);
      setSavingWeek(false);
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Erro ao salvar semana.");
        return;
      }
      alert("Semana salva!");
      setForm({ semana_iso: "", tema_central: "", subtemas: "" });
      await load();
    } catch (e: any) {
      setSavingWeek(false);
      alert("Erro: " + (e?.message || e));
    }
  };

  // --- upload de IDEIAS (global) ---
  const uploadIdeas = async () => {
    if (!ideasFile) {
      alert("Selecione um arquivo XLSX/CSV com as ideias.");
      return;
    }
    setUploadingIdeas(true);
    try {
      const fd = new FormData();
      fd.append("file", ideasFile);

      const res = await fetch("/api/ideas/upload", {
        method: "POST",
        body: fd,
      });
      const json = await safeJson(res);
      setUploadingIdeas(false);

      if (!res.ok || !json?.ok) {
        alert(`Falha no upload: ${json?.error || res.statusText}`);
        return;
      }
      alert(`Ideias importadas: ${json.count || 0}`);
    } catch (e: any) {
      setUploadingIdeas(false);
      alert("Erro: " + (e?.message || e));
    }
  };

  // --- upload em massa de semanas (XLSX/CSV) ---
  const uploadWeeksBulk = async () => {
    if (!weeksFile) {
      alert("Selecione um arquivo XLSX/CSV.");
      return;
    }
    setBulkUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", weeksFile);
      const res = await fetch("/api/weeks/bulk-upload", {
        method: "POST",
        body: fd,
      });
      const json = await safeJson(res);
      setBulkUploading(false);

      if (!res.ok || !json?.ok) {
        alert(`Falha no upload: ${json?.error || res.statusText}`);
        if (json?.errors?.length) {
          console.warn("Linhas com erro:", json.errors);
        }
        return;
      }

      alert(`Importados: ${json.imported || 0}`);
      await load();
    } catch (e: any) {
      setBulkUploading(false);
      alert("Erro: " + (e?.message || e));
    }
  };

  // --- iniciar edição de uma semana ---
  const startEdit = (w: Week) => {
    setEditingId(w.id);
    setEditForm({
      semana_iso: w.semana_iso || "",
      tema_central: w.tema_central || "",
      subtemas: Array.isArray(w.subtemas)
        ? w.subtemas.join(", ")
        : (w.subtemas as string) || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ semana_iso: "", tema_central: "", subtemas: "" });
    setSavingEdit(false);
  };

  // --- salvar edição ---
  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.semana_iso.trim() || !editForm.tema_central.trim()) {
      alert("Preencha semana e tema.");
      return;
    }

    setSavingEdit(true);
    try {
      const body = {
        semana_iso: editForm.semana_iso.trim(),
        tema_central: editForm.tema_central.trim(),
        subtemas: splitSubtemas(editForm.subtemas || ""),
      };

      const res = await fetch(`/api/weeks/${editingId}`, {
        method: "PUT", // troque para "PATCH" se seu backend usar PATCH
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await safeJson(res);
      setSavingEdit(false);

      if (!res.ok || !json?.ok) {
        alert(json?.error || "Erro ao salvar edição.");
        return;
      }

      alert("Semana atualizada!");
      cancelEdit();
      await load();
    } catch (e: any) {
      setSavingEdit(false);
      alert("Erro: " + (e?.message || e));
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Criar semana (unitário) */}
      <div className="card p-4 md:p-5 rounded-xl bg-gray-900/60 border border-gray-800">
        <h2 className="text-xl font-semibold mb-3">Criar Semana</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="px-3 py-2 rounded bg-gray-800 outline-none"
            placeholder="2025-W34"
            value={form.semana_iso}
            onChange={(e) => setForm({ ...form, semana_iso: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-gray-800 outline-none"
            placeholder="Tema central"
            value={form.tema_central}
            onChange={(e) => setForm({ ...form, tema_central: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-gray-800 outline-none"
            placeholder="Subtemas (separados por vírgula)"
            value={form.subtemas}
            onChange={(e) => setForm({ ...form, subtemas: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <button
            className="btn btn-accent px-4 py-2 rounded disabled:opacity-50"
            onClick={createWeek}
            disabled={savingWeek}
          >
            {savingWeek ? "Salvando..." : "Salvar semana"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Dica: <code>semana_iso</code> usa o padrão ISO (ex.: <code>2025-W34</code>).
        </p>
      </div>

      {/* Upload em massa de semanas */}
      <div className="card p-4 md:p-5 rounded-xl bg-gray-900/60 border border-gray-800">
        <h2 className="text-xl font-semibold mb-3">Upload em massa de semanas (XLSX/CSV)</h2>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setWeeksFile(e.target.files?.[0] || null)}
        />
        <div className="mt-3">
          <button
            className="btn px-4 py-2 rounded disabled:opacity-50"
            onClick={uploadWeeksBulk}
            disabled={!weeksFile || bulkUploading}
          >
            {bulkUploading ? "Importando..." : "Enviar e importar"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Cabeçalhos aceitos (qualquer um equivalente):<br />
          • <code>semana_iso</code> (ou <code>data</code>, <code>data_inicio</code>, <code>ano</code> + <code>num_semana</code>)<br />
          • <code>tema_central</code> (ou <code>tema</code>)<br />
          • <code>subtemas</code> (separadas por vírgula/; / |) ou colunas <code>subtema1..subtema8</code>
        </p>
      </div>

      {/* Upload de ideias (global) */}
      <div className="card p-4 md:p-5 rounded-xl bg-gray-900/60 border border-gray-800">
        <h2 className="text-xl font-semibold mb-3">Upload de ideias (XLSX/CSV)</h2>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setIdeasFile(e.target.files?.[0] || null)}
        />
        <div className="mt-3">
          <button
            className="btn px-4 py-2 rounded disabled:opacity-50"
            onClick={uploadIdeas}
            disabled={!ideasFile || uploadingIdeas}
          >
            {uploadingIdeas ? "Processando..." : "Enviar planilha"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Aceita colunas: <code>pilar</code>, <code>tema</code>, <code>assunto</code> (opcionais).<br />
          O texto base é montado automaticamente a partir dessas colunas.
        </p>
      </div>

      {/* Lista de semanas + Edição inline */}
      <div className="card p-4 md:p-5 rounded-xl bg-gray-900/60 border border-gray-800">
        <h2 className="text-xl font-semibold mb-3">Semanas cadastradas</h2>
        {loadingList ? (
          <div className="text-gray-300">Carregando...</div>
        ) : weeks.length === 0 ? (
          <div className="text-gray-400">Nenhuma semana cadastrada ainda.</div>
        ) : (
          <div className="grid gap-2">
            {weeks.map((w) => {
              const isEditing = editingId === w.id;
              const subs =
                Array.isArray(w.subtemas)
                  ? w.subtemas.join(", ")
                  : typeof w.subtemas === "string"
                  ? w.subtemas
                  : "";

              return (
                <div
                  key={w.id}
                  className="p-3 rounded bg-gray-800/60 flex flex-col gap-3"
                >
                  {!isEditing ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="font-semibold">{w.semana_iso}</div>
                          <div className="text-sm text-gray-300">{w.tema_central}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn px-3 py-1 rounded"
                            onClick={() => startEdit(w)}
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                      {subs && <div className="text-sm text-gray-400">{subs}</div>}
                    </>
                  ) : (
                    <>
                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          className="px-3 py-2 rounded bg-gray-800 outline-none"
                          placeholder="2025-W34"
                          value={editForm.semana_iso}
                          onChange={(e) =>
                            setEditForm({ ...editForm, semana_iso: e.target.value })
                          }
                        />
                        <input
                          className="px-3 py-2 rounded bg-gray-800 outline-none"
                          placeholder="Tema central"
                          value={editForm.tema_central}
                          onChange={(e) =>
                            setEditForm({ ...editForm, tema_central: e.target.value })
                          }
                        />
                        <input
                          className="px-3 py-2 rounded bg-gray-800 outline-none"
                          placeholder="Subtemas (separados por vírgula)"
                          value={editForm.subtemas}
                          onChange={(e) =>
                            setEditForm({ ...editForm, subtemas: e.target.value })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-accent px-4 py-2 rounded disabled:opacity-50"
                          onClick={saveEdit}
                          disabled={savingEdit}
                        >
                          {savingEdit ? "Salvando..." : "Salvar alterações"}
                        </button>
                        <button
                          className="btn px-4 py-2 rounded"
                          onClick={cancelEdit}
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">
                        Atenção: <code>semana_iso</code> deve ser única (ex.: <code>2025-W34</code>). Se existir,
                        o backend pode recusar a alteração.
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
