import type { Ad, AdPosition, AdStatus, AdView, Lead, SlotSettingsMap } from "../ads/types";
import { defaultSlotSettings } from "../ads/rotation";
import { compareAds } from "../ads/order";
import type { LeadInput } from "../validation/lead";
import type { AdInput } from "../validation/ad";
import type { OfficialSnapshot } from "../election-data/types";

export const BANNER_BUCKET = "ad-banners";

/** Falha de persistência: o detalhe técnico vai só para o log do servidor, nunca para o visitante. */
export class PersistenceError extends Error {}
/** Falha ao gravar/enviar arquivo no Storage. */
export class StorageError extends PersistenceError {}
/** O banco ainda não recebeu a migração que cria colunas/tabelas usadas pelo código. */
export class SchemaPendingError extends PersistenceError {}

export interface BannerStorage {
  /** Grava (ou substitui) um objeto no bucket de banners. */
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Remove objetos; falhas são toleradas (arquivo órfão é inofensivo). */
  remove(paths: string[]): Promise<void>;
  /** URL pública do objeto. */
  publicUrl(path: string): string;
}

export interface StoredOfficial {
  electionCode: number;
  round: 1 | 2;
  snapshot: unknown;
  sourceGeneratedAt: string | null;
  fetchedAt: string;
}

export type NewAd = AdInput & {
  sortOrder?: number;
  status: AdStatus;
  desktopImagePath: string | null;
  mobileImagePath: string | null;
};

export type AdPatch = Partial<Omit<NewAd, "status">> & { status?: AdStatus };

/** Abstração de persistência: SupabaseStore (produção) e MemoryStore (apenas desenvolvimento/testes). */
export interface Store {
  readonly kind: "memory" | "supabase";
  readonly storage: BannerStorage;
  listAds(): Promise<Ad[]>;
  /** Anúncios com status ativo e dentro do período (filtro de exibição pública; o servidor ainda reaplica a elegibilidade). */
  listActiveAds(now: Date): Promise<Ad[]>;
  getAd(id: string): Promise<Ad | null>;
  createAd(ad: NewAd, id?: string): Promise<Ad>;
  updateAd(id: string, patch: AdPatch): Promise<Ad | null>;
  setAdStatus(id: string, status: AdStatus): Promise<boolean>;
  /** Remove o registro e devolve o que foi removido (para limpar os arquivos do próprio anúncio); null se não existir. */
  deleteAd(id: string): Promise<Ad | null>;
  /** Define a ordem de exibição de vários anúncios de uma vez. */
  setSortOrders(updates: { id: string; sortOrder: number }[]): Promise<void>;
  /** Intervalo de rotação por espaço. Sem configuração salva => padrão. */
  getSlotSettings(): Promise<SlotSettingsMap>;
  setRotationSeconds(position: AdPosition, seconds: number): Promise<void>;
  addLead(lead: LeadInput): Promise<void>;
  listLeads(limit?: number): Promise<Lead[]>;
  getOfficial(electionCode: number): Promise<StoredOfficial | null>;
  saveOfficial(rec: { electionCode: number; round: 1 | 2; snapshot: OfficialSnapshot; sourceGeneratedAt: string | null }): Promise<void>;
}

export const toAdView = (ad: Ad, storage: BannerStorage): AdView => {
  const { desktopImagePath, mobileImagePath, ...rest } = ad;
  return {
    ...rest,
    desktopImageUrl: desktopImagePath ? storage.publicUrl(desktopImagePath) : null,
    mobileImageUrl: mobileImagePath ? storage.publicUrl(mobileImagePath) : null,
  };
};

/** Apenas desenvolvimento/testes: perde tudo ao reiniciar e não é compartilhado entre instâncias. */
export class MemoryStorage implements BannerStorage {
  private files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async upload(path: string, bytes: Uint8Array, contentType: string) {
    this.files.set(path, { bytes: new Uint8Array(bytes), contentType });
  }
  async remove(paths: string[]) {
    for (const p of paths) this.files.delete(p);
  }
  has(path: string) {
    return this.files.has(path);
  }
  count() {
    return this.files.size;
  }
  publicUrl(path: string): string {
    const f = this.files.get(path);
    return f ? `data:${f.contentType};base64,${Buffer.from(f.bytes).toString("base64")}` : "";
  }
}

export class MemoryStore implements Store {
  readonly kind = "memory" as const;
  readonly storage = new MemoryStorage();
  private ads = new Map<string, Ad>();
  private slots = defaultSlotSettings();
  private leads: Lead[] = [];
  private official = new Map<number, StoredOfficial>();
  private seq = 0;

  async listAds() {
    return [...this.ads.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  async listActiveAds(now: Date) {
    const t = now.getTime();
    return (await this.listAds())
      .filter((a) => a.status === "ativo" && Date.parse(a.startsAt) <= t && Date.parse(a.endsAt) >= t)
      .sort(compareAds);
  }
  async getAd(id: string) {
    return this.ads.get(id) ?? null;
  }
  async createAd(ad: NewAd, id: string = crypto.randomUUID()) {
    const now = new Date().toISOString();
    const created: Ad = { ...ad, sortOrder: ad.sortOrder ?? 0, id, createdAt: now, updatedAt: now };
    this.ads.set(id, created);
    return created;
  }
  async updateAd(id: string, patch: AdPatch) {
    const cur = this.ads.get(id);
    if (!cur) return null;
    const next: Ad = { ...cur, ...patch, updatedAt: new Date().toISOString() };
    this.ads.set(id, next);
    return next;
  }
  async setAdStatus(id: string, status: AdStatus) {
    return (await this.updateAd(id, { status })) !== null;
  }
  async deleteAd(id: string) {
    const cur = this.ads.get(id) ?? null;
    if (cur) this.ads.delete(id);
    return cur;
  }
  async setSortOrders(updates: { id: string; sortOrder: number }[]) {
    for (const u of updates) {
      const cur = this.ads.get(u.id);
      if (cur) this.ads.set(u.id, { ...cur, sortOrder: u.sortOrder, updatedAt: new Date().toISOString() });
    }
  }
  async getSlotSettings() {
    return structuredClone(this.slots);
  }
  async setRotationSeconds(position: AdPosition, seconds: number) {
    this.slots[position] = { rotationSeconds: seconds };
  }
  async addLead(lead: LeadInput) {
    this.leads.push({ ...lead, id: `lead-${++this.seq}`, createdAt: new Date().toISOString() });
  }
  async listLeads(limit = 200) {
    return [...this.leads].reverse().slice(0, limit);
  }
  async getOfficial(electionCode: number) {
    return this.official.get(electionCode) ?? null;
  }
  async saveOfficial(rec: { electionCode: number; round: 1 | 2; snapshot: OfficialSnapshot; sourceGeneratedAt: string | null }) {
    this.official.set(rec.electionCode, { ...rec, fetchedAt: new Date().toISOString() });
  }
}
