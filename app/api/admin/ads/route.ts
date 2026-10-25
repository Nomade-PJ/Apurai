import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { AD_STATUSES, type AdStatus } from "@/lib/ads/types";
import { isAdPosition, parseRotationSeconds } from "@/lib/ads/rotation";
import { createAdWithImages, deleteAdAndImages, describeFailure, moveAd, updateAdWithImages, type AdResult } from "@/lib/ads/upload";
import { toAdView } from "@/lib/db/store";
import { getStore } from "@/lib/db";
import { requireAdmin } from "@/lib/security/admin-guard";
import { validateAdInput } from "@/lib/validation/ad";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 banners de até 512 KB + campos
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
const bad = (message = "Requisição inválida.") => json({ ok: false, message }, 400);

/** Faz a página pública refletir a alteração já na próxima visita (fora do Next, como nos testes, é ignorado). */
function refreshPublic() {
  try {
    revalidatePath("/");
  } catch {
    /* sem contexto do Next */
  }
}

/**
 * Gestão de anúncios. Toda ação exige sessão de administrador válida (validada no servidor) e origem same-origin.
 * Ações: create, update, status, delete, move (ordem de rotação) e rotation (intervalo por espaço).
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req, { checkOrigin: true })) return json({ ok: false, message: "Não autorizado." }, 401);
  const store = getStore();
  if (!store) return json({ ok: false, message: "Armazenamento não configurado (Supabase)." }, 503);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json({ ok: false, message: "Requisição grande demais." }, 413);
  const form = await req.formData().catch(() => null);
  if (!form) return bad();

  const action = form.get("action");
  const id = form.get("id");
  const validId = typeof id === "string" && UUID_RE.test(id);

  try {
    if (action === "status") {
      const status = form.get("status") as AdStatus;
      if (!validId || !AD_STATUSES.includes(status)) return bad();
      if (!(await store.setAdStatus(id, status))) return json({ ok: false, message: "Anúncio não encontrado." }, 404);
      refreshPublic();
      return json({ ok: true });
    }

    if (action === "delete") {
      if (!validId) return bad();
      const r = await deleteAdAndImages(store, id);
      if (!r.ok) return json({ ok: false, message: r.message }, r.status);
      refreshPublic();
      return json({ ok: true });
    }

    if (action === "move") {
      const dir = form.get("direction");
      if (!validId || (dir !== "up" && dir !== "down")) return bad();
      const r = await moveAd(store, id, dir);
      if (!r.ok) return json({ ok: false, message: r.message }, r.status);
      if (r.changed) refreshPublic();
      return json({ ok: true, changed: r.changed });
    }

    if (action === "rotation") {
      const position = form.get("position");
      const seconds = parseRotationSeconds(form.get("seconds"));
      if (!isAdPosition(position)) return bad("Espaço publicitário inválido.");
      if (!seconds.ok) return json({ ok: false, message: seconds.error, errors: { seconds: seconds.error } }, 422);
      await store.setRotationSeconds(position, seconds.value);
      refreshPublic();
      return json({ ok: true, seconds: seconds.value });
    }

    if (action !== "create" && action !== "update") return json({ ok: false, message: "Ação inválida." }, 400);

    const raw = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
    const v = validateAdInput(raw);
    if (!v.ok) return json({ ok: false, message: "Revise os campos indicados.", errors: v.errors }, 422);

    let result: AdResult;
    if (action === "create") {
      result = await createAdWithImages(store, v.value, { desktop: form.get("desktopImage"), mobile: form.get("mobileImage") });
    } else {
      if (!validId) return bad();
      result = await updateAdWithImages(
        store,
        id,
        v.value,
        { desktop: form.get("desktopImage"), mobile: form.get("mobileImage") },
        { removeMobile: form.get("removeMobileImage") === "1" },
      );
    }
    if (!result.ok) return json({ ok: false, message: result.message, errors: result.errors }, result.status);
    refreshPublic();
    return json({ ok: true, ad: toAdView(result.ad, store.storage) });
  } catch (e) {
    console.error("[admin] falha ao processar anúncio");
    const f = describeFailure(e);
    return json({ ok: false, message: f.message }, f.status);
  }
}
