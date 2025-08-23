
import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Social Content Studio",
  description: "Geração semi-automática de conteúdos semanais"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav className="sticky top-0 z-10 backdrop-blur border-b border-white/10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex gap-4">
            <Link className="btn" href="/">Home</Link>
            <Link className="btn" href="/temas">Temas/Subtemas</Link>
            <Link className="btn" href="/treinamentos">Treinamentos</Link>
            <Link className="btn" href="/resultado">Resultado/Saída</Link>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto p-4">{children}</main>
      </body>
    </html>
  );
}
