import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "./LeadForm";
import { SLOT_FORMATS, fmtSpec } from "@/lib/ads/formats";
import { AD_POSITIONS } from "@/lib/ads/types";
import { LEAD_INTERESTS } from "@/lib/validation/lead";

export const metadata: Metadata = {
  title: "Anuncie",
  description: "Espaços publicitários no Apuraí: venda direta de períodos de veiculação, identificados como publicidade.",
  alternates: { canonical: "/anuncie" },
  openGraph: { url: "/anuncie", title: "Anuncie no Apuraí", description: "Espaços publicitários com venda direta, sempre identificados como publicidade." },
};

export default function Anuncie() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Anuncie no Apuraí</h1>
        <p className="mt-2 text-slate-300">
          O Apuraí é um portal sazonal para acompanhar a apuração eleitoral com dados oficiais identificados.
          A audiência está <strong>em construção</strong>: não divulgamos estimativas de alcance sem dados que as sustentem.
        </p>
      </header>

      <section aria-labelledby="espacos">
        <h2 id="espacos" className="text-xl font-semibold">Espaços disponíveis</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {AD_POSITIONS.map((p) => {
            const f = SLOT_FORMATS[p];
            return (
              <li key={p} className="rounded border border-navy-600 bg-navy-800 p-4">
                <h3 className="font-medium">{f.label}</h3>
                <p className="text-sm text-slate-300">{f.where}</p>
                <p className="mt-1 text-xs text-slate-400">Banner: {fmtSpec(f.desktop)}{f.mobile ? ` · celular ${fmtSpec(f.mobile)}` : " · somente desktop"}</p>
              </li>
            );
          })}
        </ul>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Venda direta de períodos de veiculação, em cotas limitadas, com preço e condições combinados manualmente.</li>
          <li><strong>Sem propaganda eleitoral:</strong> não vendemos espaço para candidatos, partidos, coligações ou campanhas, nem para conteúdo que peça voto (Lei nº 9.504/1997, art. 57-C). Veja a <Link href="/termos#anuncios" className="underline">Política de anúncios</Link>.</li>
          <li>Todo anúncio é analisado antes de ir ao ar e identificado como “Publicidade”; nunca imita os resultados oficiais.</li>
          <li>Mais de um anúncio no mesmo espaço se alternam automaticamente. Banners PNG, JPG ou WEBP de até 512 KB; aceitamos o tamanho indicado ou um múltiplo dele, mantendo a proporção.</li>
          <li>Métricas fornecidas somente quando medidas de forma confiável e respeitando a privacidade. Não prometemos alcance, impressões ou conversões.</li>
        </ul>
      </section>

      <section aria-labelledby="contato">
        <h2 id="contato" className="text-xl font-semibold">Tenho interesse</h2>
        <div className="mt-3 max-w-xl"><LeadForm interests={[...LEAD_INTERESTS]} /></div>
      </section>
    </article>
  );
}
