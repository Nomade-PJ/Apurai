import Link from "next/link";
import { candidatePhotoUrl } from "@/lib/config/election";
import type { OfficialCandidate, OfficialSnapshot, OfficialState } from "@/lib/election-data/types";
import { CandidatePhoto } from "./CandidatePhoto";

const fmtInt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) + " (Brasília)";
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Cor de cada candidato fixada pela ordem na urna (campo seq), não pela posição na apuração:
 * assim a cor não troca de candidato quando a liderança muda. Nenhuma cor remete a partido.
 */
const ACCENTS = [
  { bar: "bg-sky-400", ring: "ring-sky-400", text: "text-sky-300" },
  { bar: "bg-signal", ring: "ring-signal", text: "text-signal" },
  { bar: "bg-amber-400", ring: "ring-amber-400", text: "text-amber-300" },
  { bar: "bg-fuchsia-400", ring: "ring-fuchsia-400", text: "text-fuchsia-300" },
  { bar: "bg-violet-400", ring: "ring-violet-400", text: "text-violet-300" },
  { bar: "bg-rose-400", ring: "ring-rose-400", text: "text-rose-300" },
  { bar: "bg-teal-300", ring: "ring-teal-300", text: "text-teal-200" },
  { bar: "bg-orange-400", ring: "ring-orange-400", text: "text-orange-300" },
] as const;

type Accent = (typeof ACCENTS)[number];

function accentMap(cands: OfficialCandidate[]): Map<OfficialCandidate, Accent> {
  const byBallot = [...cands].sort((a, b) => (a.sequence ?? 1e9) - (b.sequence ?? 1e9) || a.name.localeCompare(b.name, "pt-BR"));
  return new Map(byBallot.map((c, i) => [c, ACCENTS[i % ACCENTS.length]]));
}

const displayName = (c: OfficialCandidate) => c.ballotName ?? c.name;

function StatusChip({ c, leader, final }: { c: OfficialCandidate; leader: boolean; final: boolean }) {
  if (c.status) {
    const elected = /^eleit/i.test(c.status);
    return (
      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${elected ? "border-signal bg-signal/15 text-signal" : "border-navy-600 text-slate-300"}`}>
        {c.status}
      </span>
    );
  }
  if (leader && !final) return <span className="rounded-full border border-navy-600 px-2 py-0.5 text-xs text-slate-300">Na frente</span>;
  return null;
}

function Duel({ snap }: { snap: OfficialSnapshot }) {
  const colors = accentMap(snap.candidates);
  // Ordem visual estável (ordem da urna), para os cartões não trocarem de lado quando a liderança muda.
  const [a, b] = [...snap.candidates].sort((x, y) => (x.sequence ?? 1e9) - (y.sequence ?? 1e9) || x.name.localeCompare(y.name, "pt-BR"));
  const leader = a.votes === b.votes ? null : a.votes > b.votes ? a : b;
  const diff = Math.abs(a.votes - b.votes);
  const aw = clampPct(a.percent);
  const bw = clampPct(b.percent);

  return (
    <div className="mt-5">
      <ol className="grid gap-3 sm:grid-cols-2">
        {[a, b].map((c) => {
          const ac = colors.get(c)!;
          const isLeader = leader === c;
          return (
            <li key={`${c.number ?? ""}-${c.name}`} className={`rounded-xl border bg-navy-900 p-4 ${isLeader ? "border-slate-500" : "border-navy-700"}`}>
              <div className="flex items-start gap-4">
                <CandidatePhoto src={candidatePhotoUrl(c.photoId, undefined)} name={displayName(c)} size="xl" ringClass={ac.ring} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {c.number ? <span className={`rounded-md bg-navy-700 px-2 py-0.5 text-sm font-bold tabular-nums ${ac.text}`}>{c.number}</span> : null}
                    <StatusChip c={c} leader={isLeader} final={snap.final} />
                  </div>
                  <h3 className="mt-1 break-words text-lg font-bold leading-tight sm:text-xl">{displayName(c)}</h3>
                  {c.party ? <p className="text-sm text-slate-400">{c.party}</p> : null}
                  <p className={`mt-2 text-3xl font-extrabold tabular-nums leading-none sm:text-4xl ${ac.text}`}>{fmtPct(c.percent)}%</p>
                  <p className="mt-1 text-sm text-slate-300 tabular-nums">{fmtInt(c.votes)} votos</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4" role="img" aria-label={`${displayName(a)} ${fmtPct(a.percent)}% contra ${displayName(b)} ${fmtPct(b.percent)}%`}>
        <div className="relative flex h-4 overflow-hidden rounded-full bg-navy-900">
          <div className={`h-full ${colors.get(a)!.bar}`} style={{ width: `${aw}%` }} />
          <div className="flex-1" />
          <div className={`h-full ${colors.get(b)!.bar}`} style={{ width: `${bw}%` }} />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-navy-950/80" />
        </div>
        <div className="mt-1 flex justify-between text-xs tabular-nums text-slate-400">
          <span>{fmtPct(a.percent)}%</span>
          <span>50%</span>
          <span>{fmtPct(b.percent)}%</span>
        </div>
      </div>

      <p className="mt-2 text-center text-sm text-slate-300">
        {leader ? (
          <>Diferença: <strong className="tabular-nums text-slate-100">{fmtInt(diff)}</strong> votos {snap.final ? "" : <>— {displayName(leader)} na frente</>}</>
        ) : (
          <>Votos iguais até o momento.</>
        )}
      </p>
    </div>
  );
}

function Ranking({ snap }: { snap: OfficialSnapshot }) {
  const colors = accentMap(snap.candidates);
  const topVotes = snap.candidates[0]?.votes ?? 0;
  return (
    <ol className="mt-5 space-y-3">
      {snap.candidates.map((c, i) => {
        const ac = colors.get(c)!;
        return (
          <li key={`${c.number ?? ""}-${c.name}`} className="rounded-xl border border-navy-700 bg-navy-900 p-3">
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-slate-500" aria-label={`${i + 1}º lugar`}>{i + 1}</span>
              <CandidatePhoto src={candidatePhotoUrl(c.photoId, undefined)} name={displayName(c)} size="md" ringClass={ac.ring} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 break-words font-semibold leading-tight">
                    {displayName(c)}
                    {c.number ? <span className={`ml-2 text-sm font-bold tabular-nums ${ac.text}`}>{c.number}</span> : null}
                  </p>
                  <p className="shrink-0 text-lg font-bold tabular-nums">{fmtPct(c.percent)}%</p>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                  {c.party ? <span>{c.party}</span> : null}
                  <StatusChip c={c} leader={i === 0 && c.votes > 0 && topVotes > (snap.candidates[1]?.votes ?? 0)} final={snap.final} />
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-navy-800" aria-hidden>
                  <div className={`h-full rounded-full ${ac.bar}`} style={{ width: `${clampPct(c.percent)}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-300 tabular-nums">{fmtInt(c.votes)} votos</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Totals({ snap }: { snap: OfficialSnapshot }) {
  const pct = snap.sections.percent ?? (snap.sections.total ? (snap.sections.counted / snap.sections.total) * 100 : null);
  return (
    <div className="mt-5 rounded-xl border border-navy-700 bg-navy-900 p-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-slate-300">Seções totalizadas</span>
        <span className="font-semibold tabular-nums">
          {pct !== null ? `${fmtPct(pct)}%` : fmtInt(snap.sections.counted)}
        </span>
      </div>
      {pct !== null && (
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-800" role="progressbar" aria-label="Seções totalizadas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clampPct(pct))}>
          <div className="h-full rounded-full bg-slate-300" style={{ width: `${clampPct(pct)}%` }} />
        </div>
      )}
      <p className="mt-1.5 text-xs text-slate-400 tabular-nums">
        {fmtInt(snap.sections.counted)}{snap.sections.total !== null ? ` de ${fmtInt(snap.sections.total)} seções` : " seções"}
      </p>
      {(snap.validVotes !== null || snap.totalVotes !== null) && (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-navy-700 pt-3 text-sm">
          {snap.validVotes !== null && (
            <div><dt className="text-xs text-slate-400">Votos válidos</dt><dd className="font-semibold tabular-nums">{fmtInt(snap.validVotes)}</dd></div>
          )}
          {snap.totalVotes !== null && (
            <div><dt className="text-xs text-slate-400">Total de votos computados</dt><dd className="font-semibold tabular-nums">{fmtInt(snap.totalVotes)}</dd></div>
          )}
        </dl>
      )}
    </div>
  );
}

/**
 * Apuração oficial. Distingue claramente: dados oficiais (ok), último resultado validado (stale),
 * ainda sem dados (waiting) e erro temporário (error). Sem dados válidos NÃO mostra candidatos, barras ou números.
 */
export function OfficialPanel({ state: st }: { state: OfficialState }) {
  const snap = st.snapshot;
  const host = st.sourceUrl ? new URL(st.sourceUrl).hostname : null;

  return (
    <section id="apuracao" aria-labelledby="apuracao-titulo" className="rounded-xl border border-navy-600 bg-navy-800 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="apuracao-titulo" className="text-xl font-semibold">Apuração oficial</h2>
        {st.status === "ok" && snap && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/60 px-2.5 py-0.5 text-xs text-signal">
            {!snap.final && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />}
            {snap.final ? "Totalização final" : "Apuração em andamento"}
          </span>
        )}
        {st.status === "stale" && (
          <span className="rounded-full border border-amber-400/70 px-2.5 py-0.5 text-xs text-amber-300">Atualização atrasada</span>
        )}
      </div>

      {st.status === "waiting" && (
        <p role="status" className="mt-4 rounded-lg border border-navy-600 bg-navy-900 p-5 text-center text-lg text-slate-100">
          {st.message}
          <span className="mt-1 block text-sm text-slate-400">Os resultados aparecem aqui assim que o TSE divulgar dados oficiais.</span>
        </p>
      )}

      {(st.status === "error" || st.status === "not_configured") && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-400/60 bg-amber-950/30 p-4 text-amber-100">
          {st.message}
          <span className="mt-1 block text-sm text-amber-200/80">Tentaremos novamente automaticamente.</span>
        </p>
      )}

      {st.status === "stale" && st.message && (
        <p role="status" className="mt-4 rounded-lg border border-amber-400/60 bg-amber-950/30 p-3 text-sm text-amber-200">
          {st.message}
          {st.fetchedAt ? ` Último resultado validado: ${fmtWhen(st.fetchedAt)}.` : ""}
        </p>
      )}

      {snap && (st.status === "ok" || st.status === "stale") && (
        <>
          {snap.simulated && (
            <p role="alert" className="mt-4 rounded-lg border border-red-400 bg-red-950/40 p-3 text-sm text-red-200">
              ARQUIVO DE SIMULADO (apenas desenvolvimento): não são resultados reais.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-300">
            {st.sourceLabel}
            {snap.final ? " — resultado final conforme a fonte" : ""}
          </p>

          {snap.candidates.length === 2 ? <Duel snap={snap} /> : <Ranking snap={snap} />}
          <Totals snap={snap} />

          <p className="mt-4 text-xs text-slate-400">
            Percentual conforme o TSE (campo pvap): votos computados do candidato em relação aos votos votáveis concorrentes.
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
