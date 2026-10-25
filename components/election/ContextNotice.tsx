import { ELECTION, electionPhase } from "@/lib/config/election";

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Informa qual eleição/turno é exibido; não afirma apuração em andamento sem dados oficiais atuais. */
export function ContextNotice() {
  const phase = electionPhase(ELECTION);
  const title = `${ELECTION.cargo} — ${ELECTION.turno}º turno`;
  const text =
    phase === "antes"
      ? `A votação do ${ELECTION.turno}º turno ocorre em ${fmtDate(ELECTION.votingDate)}.`
      : phase === "dia"
        ? `Hoje é dia de votação (${fmtDate(ELECTION.votingDate)}). Os números só aparecem quando a fonte oficial os divulgar.`
        : `A votação deste turno foi em ${fmtDate(ELECTION.votingDate)}. Os dados abaixo, quando disponíveis, são os divulgados pela fonte oficial.`;
  return (
    <section aria-label="Contexto da eleição" className="mb-5 rounded-lg border border-navy-600 bg-navy-800 p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-slate-300">{text}</p>
    </section>
  );
}
