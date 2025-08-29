"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-[100svh] bg-neutral-950 text-neutral-100">
      {/* Cabeçalho */}
      <header className="w-full border-b border-neutral-800">
        <div className="mx-auto max-w-[1100px] px-4 py-4 sm:px-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            Criador de Conteúdo Semanal
          </h1>
          <span className="text-xs text-neutral-400">
            Feito pelo Dr. Caio Torres
          </span>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6">
        {/* Cartão principal com instruções (responsivo) */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            Como usar (rápido)
          </h2>

          <ol className="list-decimal pl-5 space-y-2 text-sm sm:text-base text-neutral-300">
            <li>
              <span className="font-medium">Temas/Subtemas:</span> cadastre ou
              faça upload via planilha (.xlsx) dos temas da semana.
            </li>
            <li>
              <span className="font-medium">Treinamentos:</span> configure o
              <i> Treinamento Geral</i> e os prompts por formato (Reels, Post,
              Carrossel, Live, Stories).
            </li>
            <li>
              <span className="font-medium">Resultado/Saída:</span> escolha a
              semana e o <i>formato</i> (Reel/Post/Stories/Carrossel/Live) e
              clique em <b>Gerar</b> para obter somente aquele conteúdo.
            </li>
            <li>
              Revise, edite, salve versões, aplique tags e{" "}
              <b>exporte em DOCX</b> quando desejar.
            </li>
          </ol>

          {/* Ações rápidas */}
          <div className="mt-5 sm:mt-6 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
            <Link
              href="/temas"
              className="rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-center text-sm sm:text-base hover:bg-neutral-800 transition"
            >
              Ir para <b>Temas/Subtemas</b>
            </Link>

            <Link
              href="/treinamentos"
              className="rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-center text-sm sm:text-base hover:bg-neutral-800 transition"
            >
              Ir para <b>Treinamentos</b>
            </Link>

            <Link
              href="/resultado"
              className="rounded-xl border border-neutral-700 bg-neutral-800/50 px-4 py-3 text-center text-sm sm:text-base hover:bg-neutral-800 transition"
            >
              Ir para <b>Resultado/Saída</b>
            </Link>
          </div>

          {/* Boas práticas */}
          <div className="mt-6 rounded-xl bg-neutral-900/60 border border-neutral-800 p-4">
            <h3 className="text-sm sm:text-base font-semibold mb-2">
              Boas práticas
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-300">
              <li>Preferir prompts curtos e claros para respostas objetivas.</li>
              <li>
                Manter os conteúdos originais, com sua voz e seus CTAs
                preferidos.
              </li>
              <li>
                Lembrar: conteúdo informativo — não substitui avaliação
                individual.
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Rodapé enxuto */}
      <footer className="mx-auto max-w-[1100px] px-4 sm:px-6 py-6 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Dr. Caio Torres — Todos os direitos
        reservados.
      </footer>
    </main>
  );
}
