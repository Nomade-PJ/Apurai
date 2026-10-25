/**
 * Configuração centralizada da eleição exibida. Nenhum candidato fica fixo no código:
 * nomes e números vêm exclusivamente do arquivo oficial do TSE.
 *
 * Códigos conforme a página oficial "Informações técnicas sobre a divulgação de resultados 2026" do TSE
 * (https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados):
 *   1º turno (04/10/2026, pleito 3220): Eleição Geral Federal = 6257
 *   2º turno (25/10/2026, pleito 3221): Eleição Geral Federal = 6258
 * Reconfirme em `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` antes de publicar.
 */
export interface ElectionConfig {
  id: string;
  cargo: string;
  /** Código do cargo no TSE (1 = Presidente). */
  cargoCode: number;
  turno: 1 | 2;
  /** Data da votação, AAAA-MM-DD (fuso de Brasília). */
  votingDate: string;
  /** Ciclo no caminho do portal de resultados (ex.: ele2026). */
  cycle: string;
  /** Código da eleição no TSE (diretório e sufixo -e<6 dígitos> dos arquivos). */
  electionCode: number;
}

export const ELECTION: ElectionConfig = {
  id: "presidente-2026-t2",
  cargo: "Presidente da República",
  cargoCode: 1,
  turno: 2,
  votingDate: "2026-10-25",
  cycle: "ele2026",
  electionCode: 6258,
};

export const TSE_RESULTS_BASE = "https://resultados.tse.jus.br";

export class ConfigError extends Error {}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function validateElectionConfig(c: ElectionConfig): ElectionConfig {
  if (!ID_RE.test(c.id)) throw new ConfigError("id da eleição inválido");
  if (c.turno !== 1 && c.turno !== 2) throw new ConfigError("turno deve ser 1 ou 2");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.votingDate)) throw new ConfigError("votingDate deve ser AAAA-MM-DD");
  if (!/^ele\d{4}$/.test(c.cycle)) throw new ConfigError("ciclo inválido (esperado eleAAAA)");
  if (!Number.isInteger(c.electionCode) || c.electionCode <= 0 || c.electionCode > 999_999) throw new ConfigError("código da eleição inválido");
  if (!Number.isInteger(c.cargoCode) || c.cargoCode <= 0 || c.cargoCode > 9999) throw new ConfigError("código do cargo inválido");
  return c;
}

validateElectionConfig(ELECTION);

/**
 * URL do arquivo EA20 (resultado unificado, abrangência Brasil) conforme a especificação do TSE:
 * `br-c<cargo 4 dígitos>-e<eleição 6 dígitos>-u.json`, no diretório `dados/` da eleição.
 * ATENÇÃO: o padrão foi montado a partir da especificação e de fontes públicas, mas não pôde ser
 * acessado a partir do ambiente de desenvolvimento; confirme com `npm run check:source` no seu ambiente.
 */
export function officialDataUrl(c: ElectionConfig = ELECTION, base: string = TSE_RESULTS_BASE): string {
  const code6 = String(c.electionCode).padStart(6, "0");
  const cargo4 = String(c.cargoCode).padStart(4, "0");
  return `${base}/oficial/${c.cycle}/${c.electionCode}/dados/br/br-c${cargo4}-e${code6}-u.json`;
}

export type ElectionPhase = "antes" | "dia" | "encerrado";

/** Fase da votação em relação à data configurada, no fuso de Brasília. */
export function electionPhase(c: ElectionConfig, now: Date = new Date()): ElectionPhase {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now); // AAAA-MM-DD
  if (today < c.votingDate) return "antes";
  if (today === c.votingDate) return "dia";
  return "encerrado";
}
