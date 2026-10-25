export interface OfficialCandidate {
  /** Nome completo (campo nm). */
  name: string;
  /** Nome de urna (campo nmu), quando informado. */
  ballotName: string | null;
  party: string | null;
  number: string | null;
  sequence: number | null;
  /** vap: votos computados para o candidato. */
  votes: number;
  /** pvap: percentual de votos computados do candidato em relação aos votos votáveis concorrentes (2 casas). */
  percent: number;
  /** st do candidato (ex.: "Eleito", "2º turno"); só vem preenchido com totalização final. */
  status: string | null;
}

export interface OfficialSections {
  /** ts: total de seções (quando informado). */
  total: number | null;
  /** st: seções totalizadas. */
  counted: number;
  /** pst: percentual de seções totalizadas (0–100). */
  percent: number | null;
}

export interface OfficialSnapshot {
  electionCode: number;
  round: 1 | 2;
  candidates: OfficialCandidate[];
  sections: OfficialSections;
  /** v.vv: votos válidos (nominais + legenda). */
  validVotes: number | null;
  /** v.tv: total de votos computados. */
  totalVotes: number | null;
  /** Geração do arquivo pela fonte (dg/hg), ISO UTC. */
  generatedAt: string | null;
  /** Totalização (dt/ht), ISO UTC. */
  totalizedAt: string | null;
  /** true somente quando a fonte indica totalização final (tf = "s" ou and = "f"). */
  final: boolean;
  /** Arquivo de simulado (f = "s"). Nunca aceito em produção. */
  simulated: boolean;
}

export type OfficialStatus = "ok" | "stale" | "waiting" | "error" | "not_configured";

export interface OfficialState {
  status: OfficialStatus;
  snapshot: OfficialSnapshot | null;
  /** Quando o Apuraí validou o resultado exibido (ISO). */
  fetchedAt: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  /** Mensagem legível, sem detalhes internos. */
  message: string | null;
}

export class NormalizationError extends Error {}
/** Arquivo marcado como simulado (f = "s") recebido onde só dados reais são aceitos. */
export class SimulatedDataError extends NormalizationError {}
