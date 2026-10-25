import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  if (!base) return [];
  return ["", "/transparencia", "/anuncie", "/privacidade", "/termos"].map((p) => ({ url: `${base}${p}` }));
}
