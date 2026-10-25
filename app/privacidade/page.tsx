import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Quais dados o Apuraí coleta, para quê, por quanto tempo e como exercer seus direitos (LGPD).",
  alternates: { canonical: "/privacidade" },
};

const UPDATED = "13 de outubro de 2026";

export default function Privacidade() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  const operator = process.env.NEXT_PUBLIC_OPERATOR_NAME;
  const contact = email ? <a href={`mailto:${email}`}>{email}</a> : "o canal de contato que será informado antes do lançamento público";
  return (
    <article className="max-w-3xl space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_a]:underline">
      <h1 className="text-3xl font-bold">Política de privacidade</h1>
      <p className="text-sm text-slate-400">Última atualização: {UPDATED}. Esta política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).</p>

      <h2>1. Quem é o responsável</h2>
      <p>
        O responsável pelo tratamento dos dados é {operator ? <strong>{operator}</strong> : "o operador do Apuraí (a identificação será informada antes do lançamento público)"}.
        Para qualquer assunto sobre seus dados: {contact}.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Visitantes que apenas leem o site:</strong> não pedimos cadastro e não criamos cookies para você. A hospedagem pode registrar dados técnicos de acesso (como endereço IP) por segurança e operação. Nossos registros de aplicação não gravam dados pessoais.</li>
        <li><strong>Formulário “Anuncie”:</strong> nome da empresa, seu nome completo, e-mail, tipo de anúncio de interesse e a mensagem que você escrever. Não pedimos CPF, telefone ou endereço. Não escreva dados pessoais desnecessários na mensagem.</li>
        <li><strong>WhatsApp:</strong> depois do formulário, abrimos o WhatsApp com a mensagem pronta; <em>o envio só acontece quando você o confirma lá</em>. Se você enviar, seu número de telefone ficará visível para nós, e o WhatsApp trata seus dados conforme a política dele.</li>
        <li><strong>Área administrativa:</strong> um cookie de sessão estritamente necessário, usado apenas por quem administra o site.</li>
      </ul>

      <h2>3. Para que usamos e em que base legal</h2>
      <p>
        Usamos os dados do formulário apenas para responder ao seu interesse em anunciar e conduzir a negociação, o que corresponde a procedimentos preliminares de contrato a pedido do titular (LGPD, art. 7º, V).
        Também podemos usá-los para prevenir abusos e garantir a segurança do serviço, com base no legítimo interesse (art. 7º, IX). Não usamos os dados para publicidade, não fazemos perfis e não os vendemos.
      </p>

      <h2>4. Com quem compartilhamos e onde ficam os dados</h2>
      <p>
        Os dados do formulário ficam em banco de dados com acesso restrito à administração, mantido por provedores de infraestrutura que atuam em nosso nome (como o Supabase, para banco de dados e arquivos, e o provedor de hospedagem do site).
        Os servidores do banco de dados ficam <strong>no exterior (Estados Unidos)</strong>, o que configura transferência internacional de dados feita para operar o serviço. Você pode pedir mais informações sobre isso pelo contato acima.
        Além disso, só compartilhamos dados quando a lei exigir.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Os dados do formulário são mantidos por até <strong>12 meses</strong> após o último contato, ou até você pedir a exclusão, o que ocorrer primeiro; depois disso são excluídos.
        Registros técnicos da hospedagem seguem o prazo do provedor.
      </p>

      <h2>6. Cookies e analytics</h2>
      <p>
        Visitantes não recebem cookies do Apuraí. Não usamos cookies de publicidade nem ferramentas de analytics ou de rastreamento no momento; se isso mudar, esta política será atualizada antes.
        Anúncios de terceiros abrem em outro site, que tem política própria.
      </p>

      <h2>7. Seus direitos</h2>
      <p>
        Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre com quem os compartilhamos e a revogação de consentimento, quando for o caso (LGPD, art. 18).
        Respondemos em até 15 dias. Escreva para {contact}.
        Se entender que seus direitos não foram atendidos, você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>8. Segurança</h2>
      <p>A comunicação com o site usa HTTPS, o acesso aos dados é restrito à administração e as tabelas do banco não são acessíveis diretamente pelo público. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, adotaremos as providências previstas na LGPD.</p>

      <h2>9. Crianças e adolescentes</h2>
      <p>O Apuraí e seu formulário comercial não são direcionados a menores de 18 anos.</p>

      <h2>10. Alterações</h2>
      <p>Esta política pode ser atualizada. A data da última atualização fica no topo desta página.</p>
    </article>
  );
}
