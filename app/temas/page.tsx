"use client";
import { useEffect, useState } from "react";

type Week = {
  id: string;
  semana_iso: string;
  tema_central: string;
  subtemas: string[];
};

export default function TemasPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [form, setForm] = useState({ semana_iso: "", tema_central: "", subtemas: "" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/weeks", { cache: "no-store" });
      const text = await res.text(); // robusto contra respostas não-JSON
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text);
      if (json.ok) setWeeks(json.data || []);
      else throw new Error(json.error || "Erro ao carregar semanas");
    } catch (e: any) {
      console.error(e);
      alert("Falha ao carregar semanas: " + (e?.message || e));
    }
  };

  useEffect(() => { load(); }, []);

 const createWeek = async () => {
  const body = {
    semana_iso: form.semana_iso,
    tema_central: form.tema_central,
    subtemas: form.subtemas.split(",").map((s) => s.trim()).filter(Boolean),
  };
  try {
    const res = await fetch("/api/weeks", {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // IMPORTANTE
      body: JSON.stringify(body),
    });
    const text = await res.text(); // robusto contra HTML/erro
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
    const json = JSON.parse(text);
    if (!json.ok) throw new Error(json.error || "Falha ao salvar semana");

    setForm({ semana_iso: "", tema_central: "", subtemas: "" });
    await load();
    alert("Semana salva!");
  } catch (e: any) {
    console.error("POST /api/weeks falhou:", e);
    alert("Erro ao salvar semana: " + (e?.message || e));
  }
};

  const uploadIdeas = async () => {
    if (!file) { alert("Selecione um arquivo primeiro."); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ideas/upload", { method: "POST", body: fd });
      const text = await res.text();
      setUploading(false);
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const json = JSON.parse(text);
      if (!json.ok) alert(json.error || "Erro no upload");
      else alert("Ideias importadas: " + json.count);
    } catch (e: any) {
      setUploading(false);
      console.error(e);
      alert("Falha no upload: " + (e?.message || e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Criar Semana</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="px-3 py-2 rounded bg-gray-800"
            placeholder="2025-W34"
            value={form.semana_iso}
            onChange={(e) => setForm({ ...form, semana_iso: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-gray-800"
            placeholder="Tema central"
            value={form.tema_central}
            onChange={(e) => setForm({ ...form, tema_central: e.target.value })}
          />
          <input
            className="px-3 py-2 rounded bg-gray-800"
            placeholder="Subtemas (separados por vírgula)"
            value={form.subtemas}
            onChange={(e) => setForm({ ...form, subtemas: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <button className="btn btn-accent" onClick={createWeek}>Salvar semana</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Upload de ideias (planilha XLSX ou CSV)</h2>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="mt-3">
          <button className="btn" onClick={uploadIdeas} disabled={uploading}>
            {uploading ? "Processando..." : "Enviar planilha"}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          A primeira coluna deve se chamar <code>ideia</code>.
        </p>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Semanas cadastradas</h2>
        <div className="grid gap-2">
          {weeks.map((w) => (
            <div key={w.id} className="p-3 rounded bg-gray-800/60 flex justify-between">
              <div>
                <div className="font-semibold">{w.semana_iso}</div>
                <div className="text-sm text-gray-300">{w.tema_central}</div>
              </div>
              <div className="text-sm text-gray-400">
                {Array.isArray(w.subtemas) ? w.subtemas.join(", ") : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
