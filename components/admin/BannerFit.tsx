"use client";
import { useEffect, useState } from "react";
import { averageColorHex, computeFit, outputSize, type FitMode } from "@/lib/ads/fit";
import { MAX_IMAGE_BYTES, fmtSpec, type ImageSpec } from "@/lib/ads/formats";

const QUALITIES = [0.92, 0.82, 0.7, 0.55];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = url;
  });
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

/** Cor média dos 4 cantos da imagem (sugestão para completar as laterais no modo "Encaixar"). */
async function cornerColor(url: string): Promise<string> {
  const img = await loadImage(url);
  const w = 48;
  const h = Math.max(2, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  ctx.drawImage(img, 0, 0, w, h);
  const px = (x: number, y: number): [number, number, number] => {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  return averageColorHex([px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]);
}

/**
 * Ajuste automático: gera um banner no tamanho do espaço a partir da imagem escolhida (tudo no navegador, nada é enviado
 * antes de você confirmar). O arquivo gerado passa pelas mesmas validações de qualquer outro e é revalidado no servidor.
 */
export function BannerFit({ file, spec, idPrefix, onResult }: { file: File; spec: ImageSpec; idPrefix: string; onResult: (f: File) => void }) {
  const [mode, setMode] = useState<FitMode>("contain");
  const [color, setColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    cornerColor(url)
      .then((c) => { if (!cancelled) setColor(c); })
      .catch(() => {})
      .finally(() => URL.revokeObjectURL(url));
    return () => { cancelled = true; };
  }, [file]);

  async function apply() {
    setBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const src = { width: img.naturalWidth, height: img.naturalHeight };
      for (const allowDouble of [true, false]) {
        const out = outputSize(src, spec, allowDouble);
        const canvas = document.createElement("canvas");
        canvas.width = out.width;
        canvas.height = out.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.imageSmoothingQuality = "high";
        const r = computeFit(src, out, mode);
        ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        for (const q of QUALITIES) {
          const blob = await toBlob(canvas, "image/webp", q);
          if (blob && blob.size <= MAX_IMAGE_BYTES) {
            const ext = blob.type === "image/webp" ? "webp" : "png"; // navegadores sem WEBP devolvem PNG
            const base = file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "banner";
            onResult(new File([blob], `${base}-ajustado.${ext}`, { type: blob.type }));
            return;
          }
          if (blob && blob.type !== "image/webp") break; // PNG ignora qualidade: passa para o tamanho menor
        }
        if (!allowDouble) break;
      }
      setError(`Não consegui reduzir a imagem para menos de ${Math.round(MAX_IMAGE_BYTES / 1024)} KB. Tente uma imagem mais simples.`);
    } catch {
      setError("Não foi possível ler a imagem para ajustá-la.");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-navy-600 bg-navy-900 p-3 text-sm" role="group" aria-label="Ajustar automaticamente">
      <p className="font-medium">Ajustar automaticamente para {fmtSpec(spec)}</p>
      <p className="mt-1 text-xs text-slate-400">Gera o banner no tamanho certo a partir desta imagem. Você vê a prévia antes de salvar.</p>
      <fieldset className="mt-2 space-y-1">
        <legend className="sr-only">Modo de ajuste</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name={`${idPrefix}-fit`} checked={mode === "contain"} onChange={() => setMode("contain")} className="mt-1" />
          <span><strong>Encaixar</strong> <span className="text-slate-400">— mantém a imagem inteira e completa as laterais com uma cor (bom para logos)</span></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name={`${idPrefix}-fit`} checked={mode === "cover"} onChange={() => setMode("cover")} className="mt-1" />
          <span><strong>Preencher</strong> <span className="text-slate-400">— ocupa todo o espaço e recorta o excesso (bom para fotos largas)</span></span>
        </label>
      </fieldset>
      {mode === "contain" && (
        <label className="mt-2 flex items-center gap-2">
          Cor das laterais
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-navy-600 bg-navy-800 p-0.5" aria-label="Cor das laterais" />
          <span className="text-xs text-slate-400">{color} (sugerida pelos cantos da imagem)</span>
        </label>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={apply} disabled={busy} className="btn btn-primary">{busy ? "Ajustando…" : "Ajustar automaticamente"}</button>
      </div>
      <div className="min-h-5" aria-live="polite">{error && <p role="alert" className="mt-2 text-red-300">{error}</p>}</div>
    </div>
  );
}
