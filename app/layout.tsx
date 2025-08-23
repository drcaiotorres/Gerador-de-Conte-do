// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Criador de Conteúdo Semanal",
  description:
    "PWA para planejar e gerar conteúdos semanais com IA (OpenAI). Feito por Dr. Caio Torres.",
  themeColor: "#0b0f14",
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover", // melhor uso da área segura no iPhone com notch
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <head>
        {/* Metas extras para PWA iOS (opcionais, não quebram se já houver manifest) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-screen bg-[#0b0f14] text-gray-100 antialiased">
        {/* container central com padding menor no mobile */}
        <div className="mx-auto max-w-5xl px-3 sm:px-6">
          {children}
        </div>
      </body>
    </html>
  );
}
