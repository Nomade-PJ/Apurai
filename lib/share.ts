/** Utilitários de compartilhamento (puros e seguros para o cliente). Nenhum dado privado é incluído nos links. */

export function resolveShareUrl(opts: { path: string; configuredBase: string | null; origin: string; preferConfigured: boolean }): string {
  const base = opts.preferConfigured && opts.configuredBase ? opts.configuredBase : opts.origin;
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

export interface ShareTargets {
  whatsapp: string;
  facebook: string;
  x: string;
  telegram: string;
  linkedin: string;
}

export function shareTargets(url: string, text: string): ShareTargets {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  };
}
