// app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="py-6 sm:py-10">
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-b from-[#0f141c] to-[#0b0f14] border border-white/5 p-5 sm:p-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
          Criador de Conteúdo Semanal
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-300">
          PWA para planejar e gerar conteúdos semanais com IA (OpenAI).{" "}
          <span className="text-gray-400">Feito por Dr. Caio Torres.</span>
        </p>

        {/* Navegação rápida (rolagem horizontal no mobile) */}
        <div className="mt-4 -mx-3 sm:mx-0">
          <div className="flex gap-3 overflow-x-auto px-3 sm:px-0 py-1 scrollbar-thin">
            <NavPill href="/temas" label="Temas/Subtemas" />
            <NavPill href="/treinamentos" label="Treinamentos" />
            <NavPill href="/resultado" label="Resultado/Saída" />
          </div>
        </div>
      </section>

      {/* Passo a passo resumido (atualizado) */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <Card
          title="1) Cadastre semanas ou importe planilha"
          body={
            <>
              <p>
                Em <strong>Temas/Subtemas</strong>, crie as 52 semanas do ano ou use
                o <em>upload em massa</em>.
              </p>
              <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                <li>
                  <code>semana_iso</code> (ex: 2025-W34), <code>tema_central</code>,{" "}
                  <code>subtemas</code> (separe por <code>;</code> ou <code>,</code>).
                </li>
                <li>
                  Faça também o <strong>upload de ideias globais</strong>{" "}
                  (colunas: <code>pilar</code>, <code>tema</code>, <code>assunto</code> ou{" "}
                  <code>texto</code>).
                </li>
              </ul>
              <div className="mt-3">
                <Link href="/temas" className="btn-primary">
                  Abrir Temas/Subtemas
                </Link>
              </div>
            </>
          }
        />
        <Card
          title="2) Treinamento Geral + prompts por formato"
          body={
            <>
              <p>
                Em <strong>Treinamentos</strong>, cole o{" "}
                <strong>Treinamento Geral (Agente Expert)</strong> e os prompts
                de cada formato: Reel, Post, Carrossel, Live e Stories.
              </p>
              <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                <li>Não crie conteúdo aqui; é só a “regra” do agente.</li>
                <li>Você pode atualizar quando quiser; fica salvo.</li>
              </ul>
              <div className="mt-3">
                <Link href="/treinamentos" className="btn-primary">
                  Abrir Treinamentos
                </Link>
              </div>
            </>
          }
        />
        <Card
          title="3) Gerar um formato por vez"
          body={
            <>
              <p>
                Em <strong>Resultado/Saída</strong>, selecione a{" "}
                <strong>semana</strong> e o <strong>formato</strong> (Reel, Post,
                Carrossel, Live ou Stories) e clique em <em>Gerar</em>.
              </p>
              <ul className="mt-2 text-sm text-gray-300 list-disc pl-5 space-y-1">
                <li>Preview editável (Markdown/texto corrido).</li>
                <li>Salve a versão no histórico.</li>
                <li>Exporte em <strong>DOCX</strong>.</li>
              </ul>
              <div className="mt-3">
                <Link href="/resultado" className="btn-primary">
                  Abrir Resultado/Saída
                </Link>
              </div>
            </>
          }
        />
        <Card
          title="4) Dicas rápidas"
          body={
            <ul className="text-sm text-gray-300 list-disc pl-5 space-y-1">
              <li>Mobile: barra fixa com botões principais no topo.</li>
              <li>
                Stories: segunda sempre com caixa de perguntas; quinta lembra da
                live.
              </li>
              <li>
                Se algo travar, gere um formato por vez (já está assim) e use o
                botão <em>Salvar versão</em>.
              </li>
              <li>
                PWA: adicione à tela inicial para experiência de app no celular.
              </li>
            </ul>
          }
        />
      </section>

      {/* Rodapé curto */}
      <footer className="mt-6 text-xs text-gray-500">
        <p>
          © {new Date().getFullYear()} Criador de Conteúdo Semanal — feito por
          Dr. Caio Torres.
        </p>
      </footer>

      {/* estilos utilitários inline */}
      <style jsx>{`
        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.5rem;
          background: #34d399; /* emerald-400/500 mix visível no fundo escuro */
          color: #0b0f14;
          font-weight: 600;
          padding: 0.6rem 1rem;
          transition: transform 0.05s ease;
        }
        .btn-primary:active {
          transform: scale(0.99);
        }
      `}</style>
    </main>
  );
}

/* ---------- componentes locais ---------- */

function NavPill({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-xl border border-white/10 bg-[#121822] px-4 py-2 text-sm text-gray-100 hover:bg-[#141b26] active:scale-[.99] transition"
    >
      {label}
    </Link>
  );
}

function Card({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800 p-4 sm:p-5">
      <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
      <div className="mt-2 text-sm">{body}</div>
    </div>
  );
}
