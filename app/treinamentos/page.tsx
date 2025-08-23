
"use client";
import { useEffect, useState } from "react";

export default function TreinamentosPage() {
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/trainings");
    const json = await res.json();
    if (json.ok) setData(json.data || {});
  };
  useEffect(()=>{ load(); }, []);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/trainings", { method:"POST", body: JSON.stringify(data) });
    const json = await res.json();
    setSaving(false);
    if (!json.ok) alert(json.error || "Erro ao salvar"); else alert("Treinamentos salvos.");
  };

  const field = (name: string, label: string, placeholder: string) => (
    <div className="space-y-1">
      <label className="text-sm text-gray-300">{label}</label>
      <textarea className="w-full h-32 bg-gray-800 rounded p-2" placeholder={placeholder}
        value={data?.[name] || ""} onChange={e=>setData({...data, [name]: e.target.value})}/>
    </div>
  );

  return (
    <div className="card space-y-4">
      <h2 className="text-xl font-semibold">Área de Treinamento</h2>
      <p className="text-sm text-gray-400">Defina o <b>Prompt Geral</b> e os <b>Prompts Específicos por Formato</b>. Nenhum prompt inicial é criado automaticamente.</p>
      {field("prompt_geral", "Prompt Geral (Agente Expert)", "Regra primordial do agente...")}
      <div className="grid md:grid-cols-2 gap-4">
        {field("prompt_reels", "Prompt Reels", "Instruções específicas para Reels...")}
        {field("prompt_post", "Prompt Post Estático", "Instruções para Post Estático...")}
        {field("prompt_carrossel", "Prompt Carrossel", "Instruções para Carrossel...")}
        {field("prompt_live", "Prompt Live", "Estrutura para Live...")}
        {field("prompt_stories", "Prompt Stories", "Plano de Stories (7 dias)...")}
      </div>
      <button className="btn btn-accent" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar Treinamentos"}</button>
    </div>
  );
}
