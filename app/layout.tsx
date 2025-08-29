// app/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Criador de Conteúdo Semanal",
  description:
    "App PWA para criar conteúdos semanais com IA. Feito por Dr. Caio Torres.",
  applicationName: "Criador de Conteúdo Semanal",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Observação: cabeçalho superior + barra inferior móvel fixas.
  // Damos padding-top e padding-bottom no <main> para não cobrir o conteúdo.
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-[#0b0b0f] text-gray-100 antialiased">
        {/* Header fixo (desktop + mobile) */}
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b0b0f]/80 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              Criador de Conteúdo Semanal
            </Link>

            {/* Navegação do topo (esconde em telas muito pequenas para não poluir) */}
            <nav className="hidden sm:flex gap-2">
              <Link
                href="/temas"
                className="px-3 py-1 rounded hover:bg-white/10 transition"
              >
                Temas & Subtemas
              </Link>
              <Link
                href="/treinamentos"
                className="px-3 py-1 rounded hover:bg-white/10 transition"
              >
                Treinamentos
              </Link>
              <Link
                href="/resultado"
                className="px-3 py-1 rounded hover:bg-white/10 transition"
              >
                Resultado / Saída
              </Link>
            </nav>
          </div>
        </header>

        {/* Conteúdo principal com espaçamento para header/footer fixos */}
        <main className="mx-auto max-w-5xl px-4 pt-20 pb-24">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0b0f]/80 backdrop-blur sm:hidden">
          <div className="mx-auto max-w-5xl grid grid-cols-3 text-center">
            <Link
              href="/temas"
              className="py-3 text-sm hover:bg-white/10 transition"
            >
              Temas
            </Link>
            <Link
              href="/treinamentos"
              className="py-3 text-sm hover:bg-white/10 transition"
            >
              Treinos
            </Link>
            <Link
              href="/resultado"
              className="py-3 text-sm hover:bg-white/10 transition"
            >
              Resultado
            </Link>
          </div>
        </nav>
      </body>
    </html>
  );
}
