import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ad, AdPosition, AdStatus, Lead, SlotSettingsMap } from "../ads/types";
import { AD_POSITIONS } from "../ads/types";
import { clampRotationSeconds, defaultSlotSettings } from "../ads/rotation";
import { compareAds } from "../ads/order";
import type { LeadInput } from "../validation/lead";
import type { OfficialSnapshot } from "../election-data/types";
import {
  BANNER_BUCKET, PersistenceError, SchemaPendingError, StorageError,
  type AdPatch, type BannerStorage, type NewAd, type Store, type StoredOfficial,
} from "./store";

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(v as string).toISOString();


/** Códigos do Postgres/PostgREST para coluna/tabela inexistente: migração ainda não aplicada. */
const SCHEMA_MISSING = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

function check<T>(res: { data: T; error: { message: string; code?: string } | null }, op: string): T {
  if (res.error) {
    console.error(`[db] falha em ${op}: ${res.error.code ?? "erro"}`);
    if (res.error.code && SCHEMA_MISSING.has(res.error.code)) throw new SchemaPendingError(op);
    throw new PersistenceError(op);
  }
  return res.data;
}

export class SupabaseBannerStorage implements BannerStorage {
  constructor(private client: SupabaseClient, private baseUrl: string) {}
  async upload(path: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.client.storage.from(BANNER_BUCKET).upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
    if (error) {
      console.error("[storage] falha no upload");
      throw new StorageError("upload");
    }
  }
  async remove(paths: string[]) {
    if (!paths.length) return;
    const { error } = await this.client.storage.from(BANNER_BUCKET).remove(paths);
    if (error) console.error("[storage] falha ao remover arquivo antigo (ignorada)");
  }
  publicUrl(path: string) {
    return `${this.baseUrl}/storage/v1/object/public/${BANNER_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }
}

/**
 * Persistência no Supabase (Postgres + Storage) usando a chave de serviço, SOMENTE no servidor.
 * As tabelas têm RLS ativo e nenhuma policy para anon/authenticated (ver supabase/migrations).
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  readonly storage: BannerStorage;

  constructor(private db: SupabaseClient, baseUrl: string) {
    this.storage = new SupabaseBannerStorage(db, baseUrl);
  }

  private toAd(r: Row): Ad {
    return {
      id: String(r.id),
      campaignName: String(r.campaign_name),
      advertiser: String(r.advertiser),
      position: r.position as Ad["position"],
      status: r.status as AdStatus,
      startsAt: iso(r.starts_at),
      endsAt: iso(r.ends_at),
      targetUrl: String(r.target_url),
      desktopImagePath: r.desktop_image_path ? String(r.desktop_image_path) : null,
      mobileImagePath: r.mobile_image_path ? String(r.mobile_image_path) : null,
      altText: String(r.alt_text),
      sortOrder: Number(r.sort_order ?? 0),
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
    };
  }

  private toRow(p: AdPatch): Row {
    const m: Row = {};
    if (p.campaignName !== undefined) m.campaign_name = p.campaignName;
    if (p.advertiser !== undefined) m.advertiser = p.advertiser;
    if (p.position !== undefined) m.position = p.position;
    if (p.status !== undefined) m.status = p.status;
    if (p.startsAt !== undefined) m.starts_at = p.startsAt;
    if (p.endsAt !== undefined) m.ends_at = p.endsAt;
    if (p.targetUrl !== undefined) m.target_url = p.targetUrl;
    if (p.altText !== undefined) m.alt_text = p.altText;
    if (p.sortOrder !== undefined) m.sort_order = p.sortOrder;
    if (p.desktopImagePath !== undefined) m.desktop_image_path = p.desktopImagePath;
    if (p.mobileImagePath !== undefined) m.mobile_image_path = p.mobileImagePath;
    return m;
  }

  async listAds() {
    const rows = check(await this.db.from("ads").select("*").order("created_at", { ascending: false }), "listAds") as Row[];
    return rows.map((r) => this.toAd(r));
  }

  async listActiveAds(now: Date) {
    const t = now.toISOString();
    const rows = check(
      await this.db.from("ads").select("*").eq("status", "ativo").lte("starts_at", t).gte("ends_at", t).order("created_at", { ascending: false }),
      "listActiveAds",
    ) as Row[];
    // A ordem de rotação é aplicada em memória: a página pública continua funcionando mesmo antes da migração de ordem.
    return rows.map((r) => this.toAd(r)).sort(compareAds);
  }

  async getAd(id: string) {
    const row = check(await this.db.from("ads").select("*").eq("id", id).maybeSingle(), "getAd") as Row | null;
    return row ? this.toAd(row) : null;
  }

  async createAd(ad: NewAd, id?: string) {
    const row = { ...this.toRow(ad), ...(id ? { id } : {}) };
    return this.toAd(check(await this.db.from("ads").insert(row).select("*").single(), "createAd") as Row);
  }

  async updateAd(id: string, patch: AdPatch) {
    const row = check(await this.db.from("ads").update(this.toRow(patch)).eq("id", id).select("*").maybeSingle(), "updateAd") as Row | null;
    return row ? this.toAd(row) : null;
  }

  async setAdStatus(id: string, status: AdStatus) {
    return (await this.updateAd(id, { status })) !== null;
  }

  async deleteAd(id: string) {
    const row = check(await this.db.from("ads").delete().eq("id", id).select("*").maybeSingle(), "deleteAd") as Row | null;
    return row ? this.toAd(row) : null;
  }

  async setSortOrders(updates: { id: string; sortOrder: number }[]) {
    for (const u of updates) check(await this.db.from("ads").update({ sort_order: u.sortOrder }).eq("id", u.id), "setSortOrders");
  }

  /** Falha de leitura => padrões (a página pública nunca quebra por causa da configuração de rotação). */
  async getSlotSettings(): Promise<SlotSettingsMap> {
    const out = defaultSlotSettings();
    try {
      const rows = check(await this.db.from("ad_slot_settings").select("position, rotation_seconds"), "getSlotSettings") as Row[];
      for (const r of rows) {
        const p = String(r.position) as AdPosition;
        if (AD_POSITIONS.includes(p)) out[p] = { rotationSeconds: clampRotationSeconds(r.rotation_seconds) };
      }
    } catch {
      /* mantém os padrões */
    }
    return out;
  }

  async setRotationSeconds(position: AdPosition, seconds: number) {
    check(await this.db.from("ad_slot_settings").upsert({ position, rotation_seconds: seconds }, { onConflict: "position" }), "setRotationSeconds");
  }

  async addLead(lead: LeadInput) {
    check(
      await this.db.from("leads").insert({ company: lead.company, contact: lead.contact, email: lead.email, interest: lead.interest, message: lead.message }),
      "addLead",
    );
  }

  async listLeads(limit = 200): Promise<Lead[]> {
    const rows = check(await this.db.from("leads").select("*").order("created_at", { ascending: false }).limit(limit), "listLeads") as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      company: String(r.company),
      contact: String(r.contact),
      email: String(r.email),
      interest: String(r.interest ?? ""),
      message: String(r.message),
      createdAt: iso(r.created_at),
    }));
  }

  async getOfficial(electionCode: number): Promise<StoredOfficial | null> {
    const r = check(await this.db.from("official_results").select("*").eq("election_code", electionCode).maybeSingle(), "getOfficial") as Row | null;
    if (!r) return null;
    return {
      electionCode: Number(r.election_code),
      round: Number(r.round) as 1 | 2,
      snapshot: r.snapshot,
      sourceGeneratedAt: r.source_generated_at ? iso(r.source_generated_at) : null,
      fetchedAt: iso(r.fetched_at),
    };
  }

  async saveOfficial(rec: { electionCode: number; round: 1 | 2; snapshot: OfficialSnapshot; sourceGeneratedAt: string | null }) {
    check(
      await this.db.from("official_results").upsert(
        {
          election_code: rec.electionCode,
          round: rec.round,
          snapshot: rec.snapshot,
          source_generated_at: rec.sourceGeneratedAt,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "election_code" },
      ),
      "saveOfficial",
    );
  }
}
