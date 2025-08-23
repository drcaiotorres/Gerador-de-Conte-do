import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 md:p-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold">Criador de Conteudo Semanal</h1>
        <p className="text-gray-300">
          PWA para planejar e gerar conteúdos semanais com IA (OpenAI).
        </p>
      </header>

      {/* Como usar */}
      <section className="card p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-4">
        <h2 className="text-xl font-semibold">Como usar (rápido)</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-200">
          <li>
            <span className="font-medium">Temas/Subtemas:</span> cadastre semanas individualmente
            ou use o <span className="font-medium">upload em massa</span> (XLSX/CSV) para preencher várias semanas de uma vez.
            Use o botão <span className="font-medium">Editar</span> para ajustar qualquer semana.
          </li>
          <li>
            <span className="font-medium">Ideias (globais):</span> faça upload da sua planilha com ideias (pilar/tema/assunto).
            Elas alimentam os subtemas e a geração de conteúdo.
          </li>
          <li>
            <span className="font-medium">Treinamentos:</span> cole o <em>Prompt Geral</em> do agente
            e os prompts de cada formato (Reels, Post, Carrossel, Live, Stories). Anexe arquivos se precisar.
          </li>
          <li>
            <span className="font-medium">Resultado/Saída:</span> selecione a semana e escolha um <em>formato</em>
            (Reel, Post, Carrossel, Live ou Stories) para gerar <span className="font-medium">uma peça por vez</span>.
            Edite no preview e use <span className="font-medium">Exportar DOCX</span>.
          </li>
          <li>
            <span className="font-medium">Histórico, versões e feedback:</span> as gerações ficam salvas; você pode
            versionar, aplicar tags e pedir ajustes específicos (ex.: “refaça o reels 2”).
          </li>
        </ol>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/temas" className="btn px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">
            Ir para Temas/Subtemas
          </Link>
          <Link href="/treinamentos" className="btn px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">
            Ir para Treinamentos
          </Link>
          <Link href="/resultado" className="btn px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">
            Ir para Resultado/Saída
          </Link>
        </div>
      </section>

      {/* Dicas de uso */}
      <section className="card p-5 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3">
        <h2 className="text-xl font-semibold">Boas práticas</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-200">
          <li>Prefira gerar <span className="font-medium">uma peça por vez</span> (evita timeouts).</li>
          <li>Mantenha os prompts objetivos, com exemplos do seu estilo e CTAs preferidos.</li>
          <li>No upload em massa de semanas, use <code>semana_iso</code> no formato <code>YYYY-Www</code> (ex.: <code>2025-W34</code>).</li>
          <li>As ideias globais aceitam colunas <code>pilar</code>, <code>tema</code> e <code>assunto</code> (opcionais).</li>
          <li>Use o preview para ajustes finos e depois <span className="font-medium">Exportar DOCX</span>.</li>
        </ul>
      </section>

      {/* PWA / autoria */}
      <footer className="text-sm text-gray-400 pt-2">
        <div>Feito por <span className="font-medium">Dr. Caio Torres</span>.</div>
        <div className="mt-1">
          Dica PWA: no celular, “Adicionar à Tela Inicial” para usar como app.
        </div>
      </footer>
    </main>
  );
}
