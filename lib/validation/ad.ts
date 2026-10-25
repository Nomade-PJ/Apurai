import { AD_POSITIONS, AD_STATUSES, type AdPosition, type AdStatus } from "../ads/types";
import { validateHttpsUrl } from "./url";

export interface AdInput {
  campaignName: string;
  advertiser: string;
  position: AdPosition;
  status?: AdStatus;
  startsAt: string;
  endsAt: string;
  targetUrl: string;
  altText: string;
}

/** Duração padrão quando o período não é informado. */
export const DEFAULT_RUN_DAYS = 30;

export type AdValidation = { ok: true; value: AdInput } | { ok: false; errors: Record<string, string> };

/** Datas de <input type="datetime-local"> (sem fuso) são interpretadas como horário de Brasília (UTC-3). */
export const withBrt = (s: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? `${s}:00-03:00` : s);

/**
 * Campos opcionais com padrão (para o painel ser simples): anunciante = nome do anúncio, texto alternativo = nome,
 * início = agora, fim = início + 30 dias. Quando informados, são validados normalmente.
 */
export function validateAdInput(raw: Record<string, unknown>, now: Date = new Date()): AdValidation {
  const errors: Record<string, string> = {};
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");

  const campaignName = str("campaignName");
  if (campaignName.length < 2 || campaignName.length > 120) errors.campaignName = "Nome da campanha deve ter de 2 a 120 caracteres.";

  const advertiser = str("advertiser") || campaignName;
  if (advertiser.length < 2 || advertiser.length > 120) errors.advertiser = "Anunciante deve ter de 2 a 120 caracteres.";

  const position = str("position") as AdPosition;
  if (!AD_POSITIONS.includes(position)) errors.position = "Espaço publicitário inválido.";

  let status: AdStatus | undefined;
  if (str("status")) {
    status = str("status") as AdStatus;
    if (!AD_STATUSES.includes(status)) errors.status = "Status inválido.";
  }

  const start = str("startsAt") ? Date.parse(withBrt(str("startsAt"))) : now.getTime();
  const end = str("endsAt") ? Date.parse(withBrt(str("endsAt"))) : start + DEFAULT_RUN_DAYS * 86_400_000;
  if (!Number.isFinite(start)) errors.startsAt = "Data inicial inválida.";
  if (!Number.isFinite(end)) errors.endsAt = "Data final inválida.";
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start) errors.endsAt = "A data final deve ser posterior à inicial.";

  const target = validateHttpsUrl(str("targetUrl"));
  if (!target.ok) errors.targetUrl = target.error;

  const altText = str("altText") || campaignName;
  if (altText.length < 2 || altText.length > 160) errors.altText = "Texto alternativo deve ter de 2 a 160 caracteres.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      campaignName,
      advertiser,
      position,
      status,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      targetUrl: (target as { url: string }).url,
      altText,
    },
  };
}
