import { SLOT_FORMATS } from "./formats";
import type { Ad, AdPosition } from "./types";
import type { AdInput } from "../validation/ad";
import { checkBanner } from "../validation/image";
import { compareAds, planMove } from "./order";
import { SchemaPendingError, StorageError, type AdPatch, type NewAd, type Store } from "../db/store";

export type AdResult =
  | { ok: true; ad: Ad }
  | { ok: false; status: number; message: string; errors?: Record<string, string> };

const isFile = (v: unknown): v is File => typeof v === "object" && v !== null && typeof (v as File).arrayBuffer === "function" && (v as File).size > 0;

/** Traduz falhas internas em mensagens úteis ao administrador (sem expor detalhes do banco). */
export function describeFailure(e: unknown): { status: number; message: string } {
  if (e instanceof SchemaPendingError) {
    return { status: 503, message: "O banco ainda não recebeu a migração mais recente (rotação/ordem de anúncios). Aplique-a conforme docs/SUPABASE_SETUP.md e tente de novo." };
  }
  if (e instanceof StorageError) {
    return { status: 502, message: "Não foi possível enviar a imagem ao armazenamento (bucket “ad-banners”). Nada foi salvo. Tente novamente; se persistir, confira o Storage no Supabase." };
  }
  return { status: 500, message: "Não foi possível concluir a operação. Nada foi alterado." };
}

interface Prepared {
  bytes: Uint8Array;
  mime: string;
  ext: string;
}

async function prepare(file: File, spec: { width: number; height: number }): Promise<Prepared | { error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkBanner(bytes, spec);
  if (!checked.ok) return { error: checked.error };
  return { bytes, mime: checked.info.mime, ext: checked.ext };
}

const objectPath = (id: string, kind: "desktop" | "mobile", ext: string) => `${id}/${kind}-${crypto.randomUUID()}.${ext}`;

interface Files {
  desktop: unknown;
  mobile: unknown;
}

/** Cria um anúncio (nasce PAUSADO) validando e enviando os banners. */
export async function createAdWithImages(store: Store, input: AdInput, files: Files): Promise<AdResult> {
  const fmt = SLOT_FORMATS[input.position];
  const errors: Record<string, string> = {};
  let desktop: Prepared | undefined;
  let mobile: Prepared | undefined;

  if (!isFile(files.desktop)) errors.desktopImage = `Envie o banner de desktop (${fmt.desktop.width}×${fmt.desktop.height} px).`;
  else {
    const r = await prepare(files.desktop, fmt.desktop);
    if ("error" in r) errors.desktopImage = r.error;
    else desktop = r;
  }
  if (isFile(files.mobile)) {
    if (!fmt.mobile) errors.mobileImage = "Este espaço é exibido apenas em desktop e não aceita imagem de celular.";
    else {
      const r = await prepare(files.mobile, fmt.mobile);
      if ("error" in r) errors.mobileImage = r.error;
      else mobile = r;
    }
  }
  if (Object.keys(errors).length || !desktop) return { ok: false, status: 422, message: "Revise as imagens.", errors };

  const id = crypto.randomUUID();
  const uploaded: string[] = [];
  try {
    const dPath = objectPath(id, "desktop", desktop.ext);
    await store.storage.upload(dPath, desktop.bytes, desktop.mime);
    uploaded.push(dPath);
    let mPath: string | null = null;
    if (mobile) {
      mPath = objectPath(id, "mobile", mobile.ext);
      await store.storage.upload(mPath, mobile.bytes, mobile.mime);
      uploaded.push(mPath);
    }
    // Nasce pausado, a menos que o administrador tenha escolhido publicar. Vai para o fim da fila do espaço.
    const siblings = (await store.listAds()).filter((a) => a.position === input.position);
    const sortOrder = siblings.length ? Math.max(...siblings.map((a) => a.sortOrder)) + 1 : 0;
    const row: NewAd = { ...input, status: input.status ?? "pausado", sortOrder, desktopImagePath: dPath, mobileImagePath: mPath };
    return { ok: true, ad: await store.createAd(row, id) };
  } catch (e) {
    await store.storage.remove(uploaded);
    return { ok: false, ...describeFailure(e) };
  }
}

/** Atualiza dados e, opcionalmente, substitui/remove banners. Trocar o espaço exige banners no novo formato. */
export async function updateAdWithImages(
  store: Store,
  id: string,
  input: AdInput,
  files: Files,
  opts: { removeMobile: boolean },
): Promise<AdResult> {
  const current = await store.getAd(id);
  if (!current) return { ok: false, status: 404, message: "Anúncio não encontrado." };

  const fmt = SLOT_FORMATS[input.position];
  const old = SLOT_FORMATS[current.position as AdPosition];
  const sameDesktop = fmt.desktop.width === old.desktop.width && fmt.desktop.height === old.desktop.height;
  const sameMobile = (fmt.mobile?.width ?? 0) === (old.mobile?.width ?? 0) && (fmt.mobile?.height ?? 0) === (old.mobile?.height ?? 0);
  const errors: Record<string, string> = {};
  let desktop: Prepared | undefined;
  let mobile: Prepared | undefined;

  if (isFile(files.desktop)) {
    const r = await prepare(files.desktop, fmt.desktop);
    if ("error" in r) errors.desktopImage = r.error;
    else desktop = r;
  } else if (!sameDesktop) {
    errors.desktopImage = `Ao trocar de espaço, envie o banner de desktop (${fmt.desktop.width}×${fmt.desktop.height} px).`;
  }

  if (isFile(files.mobile)) {
    if (!fmt.mobile) errors.mobileImage = "Este espaço é exibido apenas em desktop e não aceita imagem de celular.";
    else {
      const r = await prepare(files.mobile, fmt.mobile);
      if ("error" in r) errors.mobileImage = r.error;
      else mobile = r;
    }
  } else if (!sameMobile && current.mobileImagePath && fmt.mobile && !opts.removeMobile) {
    errors.mobileImage = `Ao trocar de espaço, envie o banner de celular (${fmt.mobile.width}×${fmt.mobile.height} px) ou remova o atual.`;
  }
  if (Object.keys(errors).length) return { ok: false, status: 422, message: "Revise as imagens.", errors };

  const uploaded: string[] = [];
  const toRemove: string[] = [];
  const patch: AdPatch = { ...input };
  try {
    if (desktop) {
      const p = objectPath(id, "desktop", desktop.ext);
      await store.storage.upload(p, desktop.bytes, desktop.mime);
      uploaded.push(p);
      patch.desktopImagePath = p;
      if (current.desktopImagePath) toRemove.push(current.desktopImagePath);
    }
    if (mobile) {
      const p = objectPath(id, "mobile", mobile.ext);
      await store.storage.upload(p, mobile.bytes, mobile.mime);
      uploaded.push(p);
      patch.mobileImagePath = p;
      if (current.mobileImagePath) toRemove.push(current.mobileImagePath);
    } else if ((opts.removeMobile || !fmt.mobile) && current.mobileImagePath) {
      patch.mobileImagePath = null;
      toRemove.push(current.mobileImagePath);
    }
    const updated = await store.updateAd(id, patch);
    if (!updated) {
      await store.storage.remove(uploaded);
      return { ok: false, status: 404, message: "Anúncio não encontrado." };
    }
    await store.storage.remove(toRemove);
    return { ok: true, ad: updated };
  } catch (e) {
    await store.storage.remove(uploaded);
    return { ok: false, ...describeFailure(e) };
  }
}

/**
 * Remove o anúncio e SOMENTE os arquivos que pertencem a ele e que nenhum outro anúncio referencia.
 * Os caminhos são gerados por anúncio (`<id>/...`), mas a checagem de uso é feita mesmo assim.
 */
export async function deleteAdAndImages(store: Store, id: string): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const removed = await store.deleteAd(id);
    if (!removed) return { ok: false, status: 404, message: "Anúncio não encontrado." };
    const mine = [removed.desktopImagePath, removed.mobileImagePath].filter((p): p is string => Boolean(p));
    if (mine.length) {
      const inUse = new Set((await store.listAds()).flatMap((a) => [a.desktopImagePath, a.mobileImagePath]));
      await store.storage.remove(mine.filter((p) => !inUse.has(p)));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, ...describeFailure(e) };
  }
}

/** Move o anúncio uma posição para cima/baixo na ordem de rotação do seu espaço. */
export async function moveAd(store: Store, id: string, direction: "up" | "down"): Promise<{ ok: true; changed: boolean } | { ok: false; status: number; message: string }> {
  try {
    const all = await store.listAds();
    const target = all.find((a) => a.id === id);
    if (!target) return { ok: false, status: 404, message: "Anúncio não encontrado." };
    const plan = planMove(all.filter((a) => a.position === target.position).sort(compareAds), id, direction);
    if (!plan) return { ok: true, changed: false };
    await store.setSortOrders(plan);
    return { ok: true, changed: true };
  } catch (e) {
    return { ok: false, ...describeFailure(e) };
  }
}
