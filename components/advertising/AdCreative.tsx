import type { AdView } from "@/lib/ads/types";

interface Props {
  ad: AdView;
  priority?: boolean;
  /** false: sem link (prévias do painel). */
  link?: boolean;
  /** Chamado se a imagem não carregar (o rotador remove o anúncio da vez). */
  onImageError?: () => void;
}

/** Banner (desktop + variante de celular) que preenche o AdFrame sem distorcer (object-fit: contain). */
export function AdCreative({ ad, priority = false, link = true, onImageError }: Props) {
  if (!ad.desktopImageUrl) return null;
  const picture = (
    <picture>
      {ad.mobileImageUrl ? <source media="(max-width: 767px)" srcSet={ad.mobileImageUrl} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ad.desktopImageUrl}
        alt={ad.altText}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={onImageError}
        className="h-full w-full object-contain"
      />
    </picture>
  );
  if (!link) return <div className="absolute inset-0">{picture}</div>;
  return (
    <a href={ad.targetUrl} target="_blank" rel="sponsored noopener noreferrer" className="absolute inset-0 block">
      {picture}
    </a>
  );
}
