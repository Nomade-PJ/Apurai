import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do Apuraí, natureza informativa do site e política de anúncios (sem propaganda eleitoral).",
  alternates: { canonical: "/termos" },
};

const UPDATED = "13 de outubro de 2026";

export default function Termos() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <article className="max-w-3xl space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline">
      <h1 className="text-3xl font-bold">Termos de uso</h1>
      <p className="text-sm text-slate-400">Última atualização: {UPDATED}.</p>

      <h2>1. Natureza do site</h2>
      <p>
        O Apuraí é um site independente, de caráter informativo, que apresenta resultados eleitorais divulgados pela fonte oficial.
        Não é um canal da Justiça Eleitoral e não tem vínculo com candidatos, partidos ou campanhas. Para qualquer decisão que dependa dos resultados, consulte a fonte oficial.
      </p>

      <h2>2. Dados oficiais</h2>
      <p>
        Os resultados vêm do Tribunal Superior Eleitoral (TSE) e podem sofrer atraso, indisponibilidade ou correção. O Apuraí valida a estrutura dos dados, informa a fonte e o horário de cada atualização,
        não estima nem projeta resultados e, quando a fonte falha, mostra o último resultado validado marcado como atrasado ou informa a indisponibilidade. Veja a <Link href="/transparencia">página de transparência</Link>.
      </p>

      <h2>3. Uso permitido</h2>
      <p>É proibido sobrecarregar o serviço, tentar acessar áreas restritas, copiar o site de forma automatizada em larga escala ou usá-lo para disseminar desinformação.</p>

      <h2 id="anuncios">4. Política de anúncios</h2>
      <p>O Apuraí vende espaços de publicidade diretamente, em períodos combinados com cada anunciante. Para isso valem as regras abaixo.</p>
      <p><strong>Não aceitamos:</strong></p>
      <ul className="list-disc space-y-1 pl-5">
        <li>anúncios de candidatos, partidos, federações, coligações, comitês ou campanhas, nem de quem os represente;</li>
        <li>conteúdo que peça voto, promova ou ataque candidato, partido ou campanha (propaganda eleitoral, ainda que indireta);</li>
        <li>conteúdo que imite os resultados oficiais, o painel do site, pesquisas eleitorais ou comunicados de órgãos públicos;</li>
        <li>desinformação ou conteúdo ilegal.</li>
      </ul>
      <p>
        <strong>Por quê:</strong> a Lei nº 9.504/1997 (art. 57-C) restringe a propaganda eleitoral paga na internet e a sua veiculação em sites de pessoas jurídicas, com multa para quem a divulga.
        Por isso o Apuraí não comercializa espaço para propaganda eleitoral. Anúncios comerciais comuns, sem referência a candidatos, partidos ou eleições, são bem-vindos.
      </p>
      <p><strong>Como funciona:</strong></p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Todo anúncio é analisado antes de ir ao ar e pode ser recusado, pausado ou removido a qualquer momento se violar estas regras.</li>
        <li>Todo anúncio é identificado como “Publicidade” e “Patrocinado por”, e nunca se confunde com os resultados oficiais.</li>
        <li>Ao contratar, o anunciante declara que o anúncio <strong>não é propaganda eleitoral</strong>, que tem direito de usar as imagens, marcas e textos enviados e que responde pelo seu conteúdo.</li>
        <li>O Apuraí não promete alcance, impressões, cliques ou resultados comerciais.</li>
      </ul>

      <h2>5. Conteúdo e propriedade intelectual</h2>
      <p>O código, o texto e o design do Apuraí pertencem ao seu responsável. Marcas, logotipos e imagens de anúncios pertencem aos respectivos anunciantes. Os dados eleitorais pertencem à fonte oficial, que é sempre indicada.</p>

      <h2>6. Links externos</h2>
      <p>Anúncios e fontes oficiais podem levar a sites de terceiros, que têm termos e políticas próprios e pelos quais o Apuraí não se responsabiliza.</p>

      <h2>7. Disponibilidade e responsabilidade</h2>
      <p>
        O serviço é oferecido “como está”, sem garantia de disponibilidade contínua, especialmente em momentos de pico de acesso, como a noite da apuração.
        O Apuraí não se responsabiliza por atrasos, erros ou indisponibilidade da fonte oficial, nem por decisões tomadas com base nas informações exibidas.
      </p>

      <h2>8. Alterações</h2>
      <p>Estes termos podem ser atualizados. A data da última atualização fica no topo desta página.</p>

      <h2>9. Legislação e contato</h2>
      <p>
        Estes termos seguem a legislação brasileira. Dúvidas ou denúncias de anúncio irregular:{" "}
        {email ? <a href={`mailto:${email}`}>{email}</a> : "o canal de contato será informado antes do lançamento público"}.
      </p>
    </article>
  );
}
