import type { Metadata } from "next";
import Link from "next/link";
import { ShareButton } from "@/components/ui/ShareButton";
import { ELECTION } from "@/lib/config/election";
import { isProd, siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Transparência e metodologia",
  description: "De onde vêm os dados oficiais, como são validados e como a publicidade é identificada.",
  alternates: { canonical: "/transparencia" },
  openGraph: { url: "/transparencia", title: "Transparência e metodologia — Apuraí", description: "De onde vêm os dados oficiais, como são validados e como a publicidade é identificada." },
};

export default function Transparencia() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <article className="max-w-3xl space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline">
      <h1 className="text-3xl font-bold">Transparência e metodologia</h1>

      <section id="sobre">
        <h2>Sobre o projeto</h2>
        <p>O Apuraí é um site independente e sazonal. Não tem vínculo com a Justiça Eleitoral, candidatos ou partidos.</p>
      </section>

      <section id="fonte">
        <h2>De onde vêm os dados oficiais</h2>
        <p>
          Os números da apuração vêm dos arquivos públicos de divulgação de resultados do Tribunal Superior Eleitoral
          (<a href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" rel="noopener noreferrer">informações técnicas do TSE</a>),
          no formato “resultado unificado” (EA20), abrangência nacional, cargo de {ELECTION.cargo}, {ELECTION.turno}º turno.
          O servidor do Apuraí consulta a fonte periodicamente e guarda o resultado em cache; os visitantes não consultam o TSE diretamente.
        </p>
        <p>
          Antes de exibir, o servidor valida a estrutura e os valores do arquivo, confere se é da eleição e do turno corretos e <strong>rejeita arquivos de simulado</strong>.
          Se a apuração ainda não começou ou o arquivo não tem votos computados, mostramos “Aguardando o início da apuração oficial” — nunca zeros nem números estimados.
        </p>
        <p>
          O percentual de cada candidato é o informado pelo TSE (campo <code>pvap</code>: votos computados do candidato em relação aos votos votáveis concorrentes); o Apuraí não recalcula percentuais.
          Cada painel mostra a fonte, o horário informado por ela e o horário da última atualização validada. Se a fonte falhar, mostramos o último resultado validado, claramente marcado como atrasado, ou informamos o erro.
          “Resultado final” só aparece quando a fonte indica totalização final.
        </p>
        <p>A atualização não equivale necessariamente a “tempo real”: depende da divulgação da fonte e de cache de poucos segundos.</p>
      </section>

      <section id="publicidade">
        <h2>Publicidade</h2>
        <p>Todo anúncio vem rotulado como “Publicidade” e “Patrocinado por”, e é vendido diretamente pelo site. Anúncios não podem imitar a interface dos resultados oficiais. Não aceitamos propaganda eleitoral nem anúncios de candidatos, partidos ou campanhas (veja a <Link href="/termos#anuncios">Política de anúncios</Link>). Quando não há anúncio ativo, o espaço não é exibido.</p>
      </section>

      <section id="erros">
        <h2>Como reportar um erro</h2>
        <p>{email ? <>Escreva para <a href={`mailto:${email}`}>{email}</a>.</> : "O canal de contato será divulgado antes do lançamento público."}</p>
      </section>

      <ShareButton path="/transparencia" title="Transparência e metodologia — Apuraí" text="Como o Apuraí obtém e valida os dados oficiais" configuredBase={siteUrl()} preferConfigured={isProd()} />
    </article>
  );
}
