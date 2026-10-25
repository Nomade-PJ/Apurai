import Link from "next/link";
import type { OfficialState } from "@/lib/election-data/types";

const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) + " (Brasília)";

/**
 * Apuração oficial. Distingue claramente: dados oficiais (ok), último resultado validado (stale),
 * ainda sem dados (waiting) e erro temporário (error). Sem dados válidos NÃO mostra candidatos, barras ou números.
 */
export function OfficialPanel({ state: st }: { state: OfficialState }) {
  const snap = st.snapshot;
  const host = st.sourceUrl ? new URL(st.sourceUrl).hostname : null;

  return (
    <section id="apuracao" aria-labelledby="apuracao-titulo" className="rounded-lg border border-navy-600 bg-navy-800 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="apuracao-titulo" className="text-xl font-semibold">Apuração oficial</h2>
        {st.status === "ok" && snap && (
          <span className="rounded-full border border-signal/60 px-2.5 py-0.5 text-xs text-signal">{snap.final ? "Totalização final" : "Apuração em andamento"}</span>
        )}
        {st.status === "stale" && (
          <span className="rounded-full border border-amber-400/70 px-2.5 py-0.5 text-xs text-amber-300">Atualização atrasada</span>
        )}
      </div>

      {st.status === "waiting" && (
        <p role="status" className="mt-4 rounded border border-navy-600 bg-navy-900 p-4 text-lg text-slate-100">
          {st.message}
          <span className="mt-1 block text-sm text-slate-400">Os resultados aparecem aqui assim que o TSE divulgar dados oficiais.</span>
        </p>
      )}

      {(st.status === "error" || st.status === "not_configured") && (
        <p role="alert" className="mt-4 rounded border border-amber-400/60 bg-amber-950/30 p-4 text-amber-100">
          {st.message}
          <span className="mt-1 block text-sm text-amber-200/80">Tentaremos novamente automaticamente.</span>
        </p>
      )}

      {st.status === "stale" && st.message && (
        <p role="status" className="mt-4 rounded border border-amber-400/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          {st.message}
          {st.fetchedAt ? ` Último resultado validado: ${fmtWhen(st.fetchedAt)}.` : ""}
        </p>
      )}

      {snap && (st.status === "ok" || st.status === "stale") && (
        <>
          {snap.simulated && (
            <p role="alert" className="mt-4 rounded border border-red-400 bg-red-950/40 p-3 text-sm text-red-200">
              ARQUIVO DE SIMULADO (apenas desenvolvimento): não são resultados reais.
            </p>
          )}
          <p className="mt-3 text-sm text-slate-300">
            {st.sourceLabel}
            {snap.sections.percent !== null ? ` — ${fmtPct(snap.sections.percent)}% das seções totalizadas` : ` — ${fmtInt(snap.sections.counted)} seções totalizadas`}
            {snap.final ? " — resultado final conforme a fonte" : ""}
          </p>
          <ol className="mt-4 space-y-4">
            {snap.candidates.map((c) => (
              <li key={`${c.number ?? ""}-${c.name}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-medium">
                    {c.ballotName ?? c.name}
                    {c.party ? <span className="ml-2 text-sm text-slate-400">{c.party}</span> : null}
                    {c.status ? <span className="ml-2 rounded border border-signal/50 px-1.5 py-0.5 text-xs text-signal">{c.status}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-lg font-semibold">{fmtPct(c.percent)}%</span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded bg-navy-900" aria-hidden>
                  <div className="h-full bg-signal" style={{ width: `${Math.min(100, Math.max(0, c.percent))}%` }} />
                </div>
                <div className="mt-1 text-sm text-slate-300">{fmtInt(c.votes)} votos</div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-400">
            Percentual conforme o TSE (campo pvap): votos computados do candidato em relação aos votos votáveis concorrentes.
            {snap.validVotes !== null ? ` Votos válidos: ${fmtInt(snap.validVotes)}.` : ""}
            {snap.totalVotes !== null ? ` Total de votos computados: ${fmtInt(snap.totalVotes)}.` : ""}
          </p>
        </>
      )}

      <dl className="mt-4 grid gap-1 border-t border-navy-700 pt-3 text-xs text-slate-400 sm:grid-cols-2">
        <div><dt className="inline">Fonte: </dt><dd className="inline">{st.sourceUrl && host ? <a className="underline" href={st.sourceUrl} rel="noopener noreferrer">{host}</a> : "não configurada"}</dd></div>
        {snap && (st.status === "ok" || st.status === "stale") && (
          <>
            <div><dt className="inline">Gerado pelo TSE em: </dt><dd className="inline">{snap.generatedAt ? fmtWhen(snap.generatedAt) : "não informado"}</dd></div>
            <div><dt className="inline">Totalização informada: </dt><dd className="inline">{snap.totalizedAt ? fmtWhen(snap.totalizedAt) : "não informada"}</dd></div>
            <div><dt className="inline">Última atualização válida: </dt><dd className="inline">{st.fetchedAt ? fmtWhen(st.fetchedAt) : "—"}</dd></div>
          </>
        )}
      </dl>
      <p className="mt-2 text-sm"><Link href="/transparencia#fonte" className="underline">Ver metodologia e fonte</Link></p>
    </section>
  );
}
