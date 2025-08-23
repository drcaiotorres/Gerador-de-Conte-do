
export default function Page() {
  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-2">Social Content Studio</h1>
      <p className="text-sm text-gray-300 mb-4">
        Seu app PWA para gerar conteúdos semanais com IA usando a API da OpenAI.
      </p>
      <ol className="list-decimal pl-6 space-y-1 text-gray-200">
        <li>Preencha 52 semanas em <b>Temas/Subtemas</b>.</li>
        <li>Faça upload da sua planilha (600+ ideias) em <b>Temas/Subtemas</b>.</li>
        <li>Defina o <b>Treinamento Geral</b> e os <b>Prompts por Formato</b> em <b>Treinamentos</b>.</li>
        <li>Vá em <b>Resultado/Saída</b>, escolha a semana e clique <b>Gerar pacote</b>.</li>
        <li>Edite, salve versões, aplique tags e exporte em Markdown.</li>
      </ol>
    </div>
  );
}
