import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { siteUrl } from "@/lib/env";

const base = siteUrl();

export const metadata: Metadata = {
  metadataBase: base ? new URL(base) : undefined,
  title: { default: "Apuraí — acompanhe a apuração oficial", template: "%s | Apuraí" },
  description: "Resultados oficiais da apuração eleitoral com fonte e horário de atualização visíveis.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Apuraí",
    url: "/",
    title: "Apuraí — acompanhe a apuração oficial",
    description: "Resultados oficiais da apuração eleitoral, com fonte identificada e horário da última atualização.",
  },
  twitter: { card: "summary_large_image", title: "Apuraí — acompanhe a apuração oficial", description: "Resultados oficiais da apuração eleitoral, com fonte identificada." },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a1530" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-navy-950">
          Pular para o conteúdo
        </a>
        <Header />
        <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
