"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdCreative } from "@/components/advertising/AdCreative";
import { AdFrame } from "@/components/advertising/AdFrame";
import { AdRotator } from "@/components/advertising/AdRotator";
import { BannerFit } from "@/components/admin/BannerFit";
import { precheckBanner, type BannerVerdict } from "@/lib/ads/banner-rules";
import { toBrtInput } from "@/lib/ads/datetime";
import { MAX_IMAGE_BYTES, MAX_ROTATION_SECONDS, MIN_ROTATION_SECONDS, SLOT_FORMATS, fmtSpec, type ImageSpec } from "@/lib/ads/formats";
import { compareAds } from "@/lib/ads/order";
import { AD_POSITIONS, type AdPosition, type AdStatus, type AdView, type SlotSettingsMap } from "@/lib/ads/types";

export interface AdRow extends AdView {
  /** true se o anúncio está elegível para exibição agora (calculado no servidor). */
  live: boolean;
}

type Notice = { kind: "ok" | "error"; text: string } | null;
const NOTICE_CLS = { ok: "alert alert-ok", error: "alert alert-error" } as const;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const isActive = (s: AdStatus) => s === "ativo";

async function send(fd: FormData): Promise<{ ok: boolean; body: { message?: string; errors?: Record<string, string> } }> {
  try {
    const res = await fetch("/api/admin/ads", { method: "POST", body: fd });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && body.ok === true, body };
  } catch {
    return { ok: false, body: { message: "Falha de conexão. Tente novamente." } };
  }
}
const formWith = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

function readDims(url: string): Promise<ImageSpec | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // naturalWidth/Height já consideram a orientação EXIF, como o servidor (lib/validation/image.ts).
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Arquivo escolhido + prévia + veredito (recalculado se o espaço mudar, sem perder o arquivo).
 * As dimensões medidas ficam amarradas ao arquivo a que pertencem: ao trocar de arquivo, o veredito nunca usa as medidas do anterior.
 */
function useBannerFile(spec: ImageSpec | null) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [measured, setMeasured] = useState<{ file: File; dims: ImageSpec | null } | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setMeasured(null);
      return;
    }
    const url = URL.createObjectURL(file);
    let cancelled = false;
    setPreview(url);
    void readDims(url).then((d) => {
      if (!cancelled) setMeasured({ file, dims: d });
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const dims: ImageSpec | null | "pending" = !file ? null : measured && measured.file === file ? measured.dims : "pending";

  const verdict: BannerVerdict | null = useMemo(() => {
    if (!file || !spec || dims === "pending") return null;
    return precheckBanner({ type: file.type, size: file.size }, dims, spec);
  }, [file, spec, dims]);

  return { file, setFile, preview, verdict, checking: dims === "pending" };
}
type BannerState = ReturnType<typeof useBannerFile>;
/** Erros que o ajuste automático resolve (proporção, tamanho em pixels, peso do arquivo). */
const FIXABLE: string[] = ["wrong_ratio", "too_large", "too_heavy"];

function BannerField({
  id, label, spec, state, existingUrl, existingLabel, serverError, optional,
}: {
  id: string;
  label: string;
  spec: ImageSpec;
  state: BannerState;
  existingUrl?: string | null;
  existingLabel?: string;
  serverError?: string;
  optional?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const x2 = { width: spec.width * 2, height: spec.height * 2 };
  const shown = state.preview ?? existingUrl ?? null;
  const errorText = state.verdict && !state.verdict.ok ? state.verdict.message : serverError;
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="font-medium">{label}{optional ? " (opcional)" : ""}</label>
      <p id={`${id}-hint`} className="text-xs text-slate-400">
        Recomendado: {fmtSpec(spec)} (ou {fmtSpec(x2)} para telas nítidas). Aceita pequenas variações que mantenham a proporção. PNG, JPG ou WEBP, até {Math.round(MAX_IMAGE_BYTES / 1024)} KB.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-describedby={`${id}-hint ${id}-msg`}
          aria-invalid={Boolean(errorText)}
          onChange={(e) => state.setFile(e.target.files?.[0] ?? null)}
          className="block max-w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-navy-600 file:bg-navy-800 file:px-3 file:py-1.5 file:text-sm file:text-slate-100 hover:file:bg-navy-700"
        />
        {state.file && (
          <button type="button" className="btn px-2.5 py-1 text-xs" onClick={() => { state.setFile(null); if (inputRef.current) inputRef.current.value = ""; }}>
            Limpar arquivo
          </button>
        )}
      </div>
      <div id={`${id}-msg`} className="min-h-5" aria-live="polite">
        {state.checking && <p className="text-slate-300">Verificando imagem…</p>}
        {errorText && <p role="alert" className="text-red-300">{errorText}</p>}
        {state.verdict?.ok && (
          <p className="text-signal">{state.verdict.exact ? "Dimensões ideais. " : "Compatível. "}{state.verdict.note ?? ""}</p>
        )}
      </div>
      {state.file && state.verdict && !state.verdict.ok && FIXABLE.includes(state.verdict.code) && (
        <BannerFit key={`${state.file.name}-${state.file.size}`} idPrefix={id} file={state.file} spec={spec} onResult={(f) => state.setFile(f)} />
      )}
      {shown && (
        <figure className="mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Prévia do banner" className="max-h-28 w-auto max-w-full rounded border border-navy-600 bg-navy-950 object-contain" />
          <figcaption className="mt-1 break-all text-xs text-slate-400">{state.preview ? `Prévia do arquivo escolhido${state.file ? ` (${state.file.name})` : ""} — ainda não salvo` : existingLabel ?? "Banner atual"}</figcaption>
        </figure>
      )}
    </div>
  );
}

const sameSpec = (a: ImageSpec | null, b: ImageSpec | null) => (a?.width ?? 0) === (b?.width ?? 0) && (a?.height ?? 0) === (b?.height ?? 0);

function AdForm({ ad, onSaved, onCancel }: { ad?: AdRow; onSaved: (text: string) => void; onCancel?: () => void }) {
  const router = useRouter();
  const [position, setPosition] = useState<AdPosition>(ad?.position ?? "topo");
  const [publish, setPublish] = useState(false);
  const [removeMobile, setRemoveMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fmt = SLOT_FORMATS[position];
  const old = ad ? SLOT_FORMATS[ad.position] : null;
  const desktop = useBannerFile(fmt.desktop);
  const mobile = useBannerFile(fmt.mobile);
  const idp = ad ? `ad-${ad.id}` : "ad-new";

  const movedSlot = Boolean(ad && old && !sameSpec(old.desktop, fmt.desktop));
  const keepsDesktop = Boolean(ad) && !movedSlot;
  const keepsMobile = Boolean(ad?.mobileImageUrl) && !removeMobile && Boolean(old && sameSpec(old.mobile, fmt.mobile));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFieldErrors({});
    setNotice(null);

    const problems: string[] = [];
    if (!desktop.file && !keepsDesktop) problems.push(movedSlot ? "Ao trocar de espaço, envie um banner no novo formato." : "Escolha o banner principal.");
    if (desktop.checking || mobile.checking) problems.push("Aguarde a verificação das imagens.");
    if (desktop.verdict && !desktop.verdict.ok) problems.push("Corrija o banner principal.");
    if (mobile.verdict && !mobile.verdict.ok) problems.push("Corrija o banner de celular.");
    if (ad?.mobileImageUrl && !mobile.file && !removeMobile && fmt.mobile && !sameSpec(old?.mobile ?? null, fmt.mobile)) problems.push("Ao trocar de espaço, envie o novo banner de celular ou marque a remoção do atual.");
    if (problems.length) return setNotice({ kind: "error", text: problems.join(" ") });

    const fd = new FormData(e.currentTarget);
    fd.set("action", ad ? "update" : "create");
    fd.set("position", position);
    if (ad) fd.set("id", ad.id);
    else fd.set("status", publish ? "ativo" : "pausado");
    if (desktop.file) fd.set("desktopImage", desktop.file);
    if (mobile.file && fmt.mobile) fd.set("mobileImage", mobile.file);
    if (removeMobile) fd.set("removeMobileImage", "1");

    setBusy(true);
    const r = await send(fd);
    setBusy(false);
    if (r.ok) {
      router.refresh();
      onSaved(ad ? "Anúncio atualizado." : publish ? "Anúncio cadastrado e publicado." : "Anúncio cadastrado como inativo. Ative-o quando quiser publicá-lo.");
    } else {
      setFieldErrors(r.body.errors ?? {});
      setNotice({ kind: "error", text: r.body.message ?? "Não foi possível salvar." });
    }
  }

  const err = (k: string) => fieldErrors[k] && <p className="mt-1 text-sm text-red-300">{fieldErrors[k]}</p>;
  return (
    <form onSubmit={submit} className="card space-y-4" aria-label={ad ? `Editar anúncio ${ad.campaignName}` : "Novo anúncio"}>
      {ad && <h4 className="font-medium">Editar: {ad.campaignName}</h4>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Nome do anúncio <span className="text-slate-400">(também aparece como “Patrocinado por”)</span>
          <input name="campaignName" required minLength={2} maxLength={120} defaultValue={ad?.campaignName} className="field" aria-invalid={Boolean(fieldErrors.campaignName)} />
          {err("campaignName")}
        </label>
        <label className="text-sm">
          Onde será exibido
          <select value={position} onChange={(e) => setPosition(e.target.value as AdPosition)} className="field">
            {AD_POSITIONS.map((p) => <option key={p} value={p}>{SLOT_FORMATS[p].label}</option>)}
          </select>
          <span className="mt-1 block text-xs text-slate-400">{fmt.where}</span>
          {err("position")}
        </label>
        <label className="text-sm">
          Link de destino (https)
          <input name="targetUrl" type="url" required placeholder="https://" defaultValue={ad?.targetUrl} className="field" aria-invalid={Boolean(fieldErrors.targetUrl)} />
          {err("targetUrl")}
        </label>
      </div>

      <BannerField
        id={`${idp}-desktop`}
        label={ad ? "Trocar banner principal" : "Banner principal"}
        spec={fmt.desktop}
        state={desktop}
        existingUrl={keepsDesktop ? ad?.desktopImageUrl : null}
        serverError={fieldErrors.desktopImage}
        optional={Boolean(ad) && !movedSlot}
      />

      {fmt.mobile ? (
        <details className="rounded-md border border-navy-700 p-3" open={Boolean(ad?.mobileImageUrl)}>
          <summary className="cursor-pointer text-sm font-medium">Versão para celular (opcional)</summary>
          <div className="mt-3 space-y-3">
            <BannerField id={`${idp}-mobile`} label="Banner de celular" spec={fmt.mobile} state={mobile} existingUrl={keepsMobile ? ad?.mobileImageUrl : null} serverError={fieldErrors.mobileImage} optional />
            {ad?.mobileImageUrl && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removeMobile} onChange={(e) => setRemoveMobile(e.target.checked)} /> Remover o banner de celular atual
              </label>
            )}
            <p className="text-xs text-slate-400">Sem versão de celular, o banner principal é reduzido para caber na tela.</p>
          </div>
        </details>
      ) : (
        <p className="text-sm text-slate-400">Este espaço aparece só em telas grandes; não há banner de celular.</p>
      )}

      <p className="alert alert-warn text-xs">
        Antes de publicar, confirme que o anúncio <strong>não é propaganda eleitoral</strong>: não aceite candidatos, partidos, coligações, campanhas nem conteúdo que peça voto (Termos de uso → Política de anúncios).
      </p>

      {!ad && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publicar assim que salvar <span className="text-slate-400">(se desmarcado, fica inativo)</span>
        </label>
      )}

      <details className="rounded-md border border-navy-700 p-3">
        <summary className="cursor-pointer text-sm font-medium">Opções avançadas (opcional)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Nome exibido ao público
            <input name="advertiser" maxLength={120} defaultValue={ad && ad.advertiser !== ad.campaignName ? ad.advertiser : ""} placeholder="Em branco: usa o nome do anúncio" className="field" />
            {err("advertiser")}
          </label>
          <label className="text-sm">
            Texto alternativo da imagem
            <input name="altText" maxLength={160} defaultValue={ad && ad.altText !== ad.campaignName ? ad.altText : ""} placeholder="Em branco: usa o nome do anúncio" className="field" />
            {err("altText")}
          </label>
          <label className="text-sm">
            Início (Brasília)
            <input name="startsAt" type="datetime-local" defaultValue={ad ? toBrtInput(ad.startsAt) : ""} className="field" />
            {err("startsAt")}
          </label>
          <label className="text-sm">
            Fim (Brasília)
            <input name="endsAt" type="datetime-local" defaultValue={ad ? toBrtInput(ad.endsAt) : ""} className="field" />
            {err("endsAt")}
          </label>
          <p className="text-xs text-slate-400 sm:col-span-2">Período em branco: o anúncio começa agora e dura 30 dias.</p>
        </div>
      </details>

      <div aria-live="polite" className="min-h-5">{notice && <p role={notice.kind === "error" ? "alert" : "status"} className={NOTICE_CLS[notice.kind]}>{notice.text}</p>}</div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="btn btn-primary">{busy ? "Salvando…" : ad ? "Salvar alterações" : "Cadastrar anúncio"}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn">Cancelar</button>}
      </div>
    </form>
  );
}

function StatusBadge({ ad }: { ad: AdRow }) {
  const active = isActive(ad.status);
  return (
    <>
      <span className={`rounded-full border px-2 py-0.5 text-xs ${active ? "border-signal/60 text-signal" : "border-navy-600 text-slate-300"}`}>{active ? "Ativo" : "Inativo"}</span>
      {ad.live ? (
        <span className="text-xs text-signal">No ar agora</span>
      ) : (
        <span className="text-xs text-slate-400">{active ? "Ativo, mas fora do período" : "Fora do ar"}</span>
      )}
    </>
  );
}

function AdItem({ ad, onNotice }: { ad: AdRow; onNotice: (n: Notice) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fields: Record<string, string>, okText: string) {
    setBusy(true);
    const r = await send(formWith(fields));
    setBusy(false);
    if (r.ok) {
      router.refresh();
      onNotice({ kind: "ok", text: okText });
    } else {
      onNotice({ kind: "error", text: r.body.message ?? "Não foi possível concluir a ação." });
    }
    return r.ok;
  }
  const active = isActive(ad.status);

  return (
    <li className="card space-y-3 text-sm">
      <div className="flex gap-3">
        <div className="w-28 shrink-0 sm:w-40">
          <AdFrame position={ad.position} ads={[ad]} className="rounded border border-navy-600 bg-navy-950">
            <AdCreative ad={ad} link={false} />
          </AdFrame>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="break-words">{ad.campaignName}</strong>
            <StatusBadge ad={ad} />
          </div>
          <p className="text-slate-300">{SLOT_FORMATS[ad.position].label}</p>
          <p className="text-xs text-slate-400">{fmtWhen(ad.startsAt)} → {fmtWhen(ad.endsAt)}</p>
          <p className="break-all text-xs text-slate-400">{ad.targetUrl}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className="btn" onClick={() => run({ action: "status", id: ad.id, status: active ? "pausado" : "ativo" }, active ? "Anúncio desativado." : "Anúncio ativado.")}>
          {active ? "Desativar" : "Ativar"}
        </button>
        <button type="button" className="btn" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>{editing ? "Fechar edição" : "Editar"}</button>
        <button type="button" className="btn" onClick={() => setViewing((v) => !v)} aria-expanded={viewing}>{viewing ? "Fechar visualização" : "Visualizar"}</button>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 rounded-md border border-red-500/60 px-2 py-1" role="group" aria-label="Confirmar remoção">
            <span className="text-red-200">Remover definitivamente?</span>
            <button type="button" disabled={busy} className="btn btn-danger py-1" onClick={async () => { if (!(await run({ action: "delete", id: ad.id }, "Anúncio removido."))) setConfirming(false); }}>Sim, remover</button>
            <button type="button" className="btn py-1" onClick={() => setConfirming(false)}>Cancelar</button>
          </span>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Remover</button>
        )}
      </div>

      {viewing && (
        <div className="grid gap-3 border-t border-navy-700 pt-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-slate-400">Como aparece no computador</p>
            <AdFrame position={ad.position} ads={[{ mobileImageUrl: null }]} className="rounded border border-navy-600 bg-navy-950"><AdCreative ad={{ ...ad, mobileImageUrl: null }} link={false} /></AdFrame>
          </div>
          {ad.mobileImageUrl && SLOT_FORMATS[ad.position].mobile && (
            <div>
              <p className="mb-1 text-xs text-slate-400">Como aparece no celular</p>
              <div className="max-w-80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ad.mobileImageUrl} alt={`Versão de celular: ${ad.altText}`} className="h-auto w-full rounded border border-navy-600 bg-navy-950" />
              </div>
            </div>
          )}
        </div>
      )}
      {editing && <AdForm ad={ad} onCancel={() => setEditing(false)} onSaved={(t) => { setEditing(false); onNotice({ kind: "ok", text: t }); }} />}
    </li>
  );
}

function SlotCard({ position, ads, saved, canWrite, onNotice }: { position: AdPosition; ads: AdRow[]; saved: number; canWrite: boolean; onNotice: (n: Notice) => void }) {
  const router = useRouter();
  const fmt = SLOT_FORMATS[position];
  const [draft, setDraft] = useState(String(saved));
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(String(saved)), [saved]);

  const ordered = useMemo(() => [...ads].sort(compareAds), [ads]);
  const live = ordered.filter((a) => a.live);
  const draftN = Number(draft);
  const valid = /^\d{1,3}$/.test(draft) && draftN >= MIN_ROTATION_SECONDS && draftN <= MAX_ROTATION_SECONDS;
  const previewSeconds = valid ? draftN : saved;

  async function act(fields: Record<string, string>, okText?: string) {
    setBusy(true);
    const r = await send(formWith(fields));
    setBusy(false);
    if (r.ok) {
      router.refresh();
      if (okText) onNotice({ kind: "ok", text: okText });
    } else {
      onNotice({ kind: "error", text: r.body.message ?? "Não foi possível concluir a ação." });
    }
  }

  return (
    <li className="card space-y-3">
      <div>
        <h4 className="font-medium">{fmt.label}</h4>
        <p className="text-xs text-slate-400">{fmt.where} · {fmtSpec(fmt.desktop)}</p>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-slate-300">Nenhum anúncio neste espaço. Enquanto estiver vazio, ele fica oculto no site.</p>
      ) : (
        <ol className="space-y-1.5" aria-label={`Ordem de exibição — ${fmt.label}`}>
          {ordered.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2 rounded-md border border-navy-700 bg-navy-900 px-2 py-1.5 text-sm">
              <span className="w-5 text-center text-xs text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{a.campaignName}</span>
              <span className={`text-xs ${a.live ? "text-signal" : "text-slate-400"}`}>{a.live ? "no ar" : isActive(a.status) ? "fora do período" : "inativo"}</span>
              <button type="button" className="btn h-8 w-8 p-0" disabled={busy || !canWrite || i === 0} aria-label={`Mover ${a.campaignName} para cima`} onClick={() => act({ action: "move", id: a.id, direction: "up" })}>↑</button>
              <button type="button" className="btn h-8 w-8 p-0" disabled={busy || !canWrite || i === ordered.length - 1} aria-label={`Mover ${a.campaignName} para baixo`} onClick={() => act({ action: "move", id: a.id, direction: "down" })}>↓</button>
            </li>
          ))}
        </ol>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); if (valid) void act({ action: "rotation", position, seconds: draft }, `Intervalo de “${fmt.label}” salvo: ${draft} s.`); }}
      >
        <label className="text-sm">
          Trocar de anúncio a cada (segundos)
          <input type="number" inputMode="numeric" min={MIN_ROTATION_SECONDS} max={MAX_ROTATION_SECONDS} step={1} value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={!valid} className="field w-28" />
        </label>
        <button className="btn" disabled={busy || !canWrite || !valid || Number(draft) === saved}>Salvar intervalo</button>
        <p className="w-full text-xs text-slate-400">De {MIN_ROTATION_SECONDS} a {MAX_ROTATION_SECONDS} segundos. {!valid && <span className="text-red-300">Valor fora do limite.</span>}</p>
      </form>

      <div>
        <p className="mb-1 text-xs text-slate-400">Prévia com os anúncios que estão no ar{valid && draftN !== saved ? ` (intervalo de teste: ${draftN} s, ainda não salvo)` : ""}</p>
        {live.length === 0 ? (
          <p className="text-sm text-slate-300">Nenhum anúncio no ar: o espaço fica oculto no site.</p>
        ) : live.length === 1 ? (
          <>
            <AdFrame position={position} ads={live} className="rounded border border-navy-600 bg-navy-950"><AdCreative ad={live[0]} link={false} /></AdFrame>
            <p className="mt-1 text-xs text-slate-400">Só um anúncio no ar: ele permanece fixo, sem rotação.</p>
          </>
        ) : (
          <AdRotator key={`${position}-${live.map((a) => a.id).join(",")}-${previewSeconds}`} position={position} ads={live} intervalSeconds={previewSeconds} preview />
        )}
      </div>
    </li>
  );
}

export function AdAdmin({ ads, settings, canWrite }: { ads: AdRow[]; settings: SlotSettingsMap; canWrite: boolean }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [formKey, setFormKey] = useState(0);
  const sorted = useMemo(() => [...ads].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [ads]);

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="min-h-5">{notice && <p role={notice.kind === "error" ? "alert" : "status"} className={NOTICE_CLS[notice.kind]}>{notice.text}</p>}</div>

      <section aria-labelledby="ads-novo" className="space-y-3">
        <h3 id="ads-novo" className="text-lg font-semibold">Novo anúncio</h3>
        {canWrite ? (
          <AdForm key={formKey} onSaved={(t) => { setNotice({ kind: "ok", text: t }); setFormKey((k) => k + 1); }} />
        ) : (
          <p className="alert alert-warn">Cadastro indisponível: configure o Supabase (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).</p>
        )}
      </section>

      <section aria-labelledby="ads-lista" className="space-y-3">
        <h3 id="ads-lista" className="text-lg font-semibold">Anúncios cadastrados ({ads.length})</h3>
        <ul className="space-y-3">
          {sorted.map((a) => <AdItem key={a.id} ad={a} onNotice={setNotice} />)}
          {ads.length === 0 && <li className="text-sm text-slate-300">Nenhum anúncio cadastrado. Enquanto não houver anúncio ativo, os espaços ficam ocultos no site.</li>}
        </ul>
      </section>

      <section aria-labelledby="ads-exibicao" className="space-y-3">
        <div>
          <h3 id="ads-exibicao" className="text-lg font-semibold">Exibição por espaço</h3>
          <p className="text-sm text-slate-400">Cada espaço alterna só os seus anúncios, na ordem abaixo. As mudanças aparecem no site em até alguns segundos.</p>
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          {AD_POSITIONS.map((p) => (
            <SlotCard key={p} position={p} ads={ads.filter((a) => a.position === p)} saved={settings[p].rotationSeconds} canWrite={canWrite} onNotice={setNotice} />
          ))}
        </ul>
      </section>
    </div>
  );
}
