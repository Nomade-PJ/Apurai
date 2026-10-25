import { DEFAULT_ROTATION_SECONDS, MAX_ROTATION_SECONDS, MIN_ROTATION_SECONDS } from "./formats";
import { AD_POSITIONS, type AdPosition, type SlotSettingsMap } from "./types";

export const defaultSlotSettings = (): SlotSettingsMap =>
  Object.fromEntries(AD_POSITIONS.map((p) => [p, { rotationSeconds: DEFAULT_ROTATION_SECONDS }])) as SlotSettingsMap;

export function clampRotationSeconds(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DEFAULT_ROTATION_SECONDS;
  return Math.min(MAX_ROTATION_SECONDS, Math.max(MIN_ROTATION_SECONDS, Math.round(v)));
}

export function parseRotationSeconds(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,3}$/.test(text)) return { ok: false, error: `Informe um número inteiro de ${MIN_ROTATION_SECONDS} a ${MAX_ROTATION_SECONDS} segundos.` };
  const n = Number(text);
  if (n < MIN_ROTATION_SECONDS || n > MAX_ROTATION_SECONDS) return { ok: false, error: `O intervalo deve ficar entre ${MIN_ROTATION_SECONDS} e ${MAX_ROTATION_SECONDS} segundos.` };
  return { ok: true, value: n };
}

export const isAdPosition = (v: unknown): v is AdPosition => typeof v === "string" && (AD_POSITIONS as string[]).includes(v);
