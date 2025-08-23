// app/treinamentos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Training = {
  id?: string | null;
  prompt_geral?: string | null;
  prompt_reels?: string | null;
  prompt_post?: string | null;
  prompt_carrossel?: string | null;
  prompt_live?: string | null;
  prompt_stories?: string | null;
  updated_at?: string | null;
};

export default function TreinamentosPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // campos
  const [promptGeral, setPromptGeral] = useState("");
  const [promptReels, setPromptReels] = useState("");
  const [promptPost, setPromptPost] = useState("");
  const [promptCarrossel, setPromptCarrossel] = useState("");
  const [promptLive, setPromptLive] = useState("");
  const [promptStories, setPromptStories] = useState("");

  // metadados
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/trainings", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        setLoading(false);
        if (!json?.ok) {
          // primeiro acesso (sem registro) não é erro crítico
          return;
        }
        const t: Training = json.data || {};
        setPromptGeral(t.prompt_geral || "");
        setPromptReels(t.prompt_reels || "");
        setPromptPost(t.prompt_post || "");
        setPromptCarrossel(t.prompt_carrossel || "");
        setPromptLive(t.prompt_live || "");
        setPromptStories(t.prompt_stories || "");
        setLastSavedAt(t.updated_at || null);
      } catch (e: any) {
        setLoading(false);
        alert("Falha ao carregar treinamentos: " + (e?.message || String(e)));
      }
    };
    load();
  }, []);

  const dirty = useMemo(() => true, [promptGeral, promptReels, promptPost, promptCarrossel, promptLive, promptStories]);

  const onSave = async () => {
    try {
      setSaving(true);
      const body = {
        prompt_geral: promptGeral,
        prompt_reels: promptReels,
        prompt_post: promptPost,
        prompt_carrossel: promptCarrossel,
        prompt_live: promptLive,
        prompt_stories: promptStories,
      };
      const res = await fetch("/api/trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      setSaving(false);
      if (!json?.ok) {
        return alert(json?.error || "Falha ao salvar treinamentos.");
      }
      setLastSavedAt(new Date().toISOString());
      alert("Treinamentos salvos!");
    } catch (e: any) {
      setSaving(false);
      alert("Erro ao salvar: " + (e?.message || String(e)));
    }
  };

  return (
    <main className="py-6 sm:py-10 pb-24">
      {/* Barra de ações fixa no topo (mobile-first) */}
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-[#0b0f14]/80 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f14]/60 border-b border-white/5">
        <div className="px-3 sm:px-0 py-3 flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold">
            Treinamentos (Prompts)
          </h1>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 disabled:opacity-60 active:scale-[.99] transition"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {lastSavedAt && (
        <p className="text-xs text-gray-400 mt-2">
          Última atualização: {new Date(lastSavedAt).toLocaleString()}
        </p>
      )}

      {loading ? (
        <div className="mt-6 text-gray-400">Carregando…</div>
      ) : (
        <>
          {/* Orientações curtas */}
          <section className="mt-4 rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-semibold mb-2">
              Como funciona
            </h2>
            <ul className="text-sm text-gray-300 space-y-1 list-disc pl-5">
              <li>
                Cole aqui o <strong>Treinamento Geral</strong> (Agente Expert). É a base obrigatória.
              </li>
              <li>
                Depois, preencha os <strong>prompts por formato</strong> (Reel, Post, Carrossel, Live, Stories).
              </li>
              <li>
                Na página <strong>Resultado/Saída</strong>, selecione a semana e o formato para gerar.
              </li>
            </ul>
          </section>

          {/* Treinamento Geral */}
          <section className="mt-5 rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base sm:text-lg font-semibold">Treinamento Geral</h2>
              <span className="text-xs text-gray-400">
                Base do agente (não crie conteúdo aqui)
              </span>
            </div>
            <Textarea
              value={promptGeral}
              onChange={(v) => setPromptGeral(v)}
              placeholder="Cole aqui seu Prompt Geral (Agente Expert)…"
            />
          </section>

          {/* Prompts por formato */}
          <section className="mt-5 rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-semibold mb-3">
              Prompts por Formato
            </h2>

            <Field
              label="Reels"
              value={promptReels}
              setValue={setPromptReels}
              placeholder="Cole aqui o prompt específico para REELS…"
            />

            <Field
              label="Post estático"
              value={promptPost}
              setValue={setPromptPost}
              placeholder="Cole aqui o prompt para POST estático…"
            />

            <Field
              label="Carrossel"
              value={promptCarrossel}
              setValue={setPromptCarrossel}
              placeholder="Cole aqui o prompt para CARROSSEL…"
            />

            <Field
              label="Live (roteiro)"
              value={promptLive}
              setValue={setPromptLive}
              placeholder="Cole aqui o prompt para LIVE…"
            />

            <Field
              label="Stories (7 dias)"
              value={promptStories}
              setValue={setPromptStories}
              placeholder="Cole aqui o prompt para STORIES (7 dias)…"
            />

            {/* Ação extra no fim (bom para mobile) */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg bg-emerald-500 text-black font-semibold px-4 py-2 disabled:opacity-60 active:scale-[.99] transition"
              >
                {saving ? "Salvando…" : "Salvar tudo"}
              </button>
              <span className="text-xs text-gray-400 self-center">
                Dica: salve sempre que ajustar os prompts.
              </span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* ---------- Componentes auxiliares (inline) ---------- */

function Field({
  label,
  value,
  setValue,
  placeholder,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-[11px] text-gray-400">{value.length} chars</span>
      </div>
      <Textarea value={value} onChange={setValue} placeholder={placeholder} />
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="w-full min-h-[160px] rounded-lg bg-[#0f141c] border border-white/10 px-3 py-3 text-[15px] leading-6 outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
