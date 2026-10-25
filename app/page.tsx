import { AdSlot } from "@/components/advertising/AdSlot";
import { ContextNotice } from "@/components/election/ContextNotice";
import { OfficialPanel } from "@/components/election/OfficialPanel";
import { ShareButton } from "@/components/ui/ShareButton";
import { pickAds } from "@/lib/ads/schedule";
import { getLiveAds, getSlotRotation } from "@/lib/db/ads";
import { getOfficialStateServer } from "@/lib/election-data/server";
import { isProd, siteUrl } from "@/lib/env";

// HTML regenerado a cada 30 s e compartilhado entre visitantes (o provedor ainda mantém cache próprio).
export const revalidate = 30;

export default async function Home() {
  const now = new Date();
  const [official, ads, slots] = await Promise.all([getOfficialStateServer(), getLiveAds(now), getSlotRotation()]);
  const topo = pickAds(ads, "topo", now);
  const patrocinador = pickAds(ads, "patrocinador", now);
  const lateral = pickAds(ads, "lateral", now);
  const rodape = pickAds(ads, "rodape", now);

  return (
    <>
      <ContextNotice />
      <AdSlot position="topo" ads={topo} intervalSeconds={slots.topo.rotationSeconds} priority className="mb-5" />
      <div className={lateral.length ? "grid gap-5 lg:grid-cols-[1fr_300px]" : undefined}>
        <div className="min-w-0 space-y-5">
          <OfficialPanel state={official} />
          <AdSlot position="patrocinador" ads={patrocinador} intervalSeconds={slots.patrocinador.rotationSeconds} />
          <ShareButton path="/" title="Apuraí — apuração oficial" text="Acompanhe a apuração oficial no Apuraí" configuredBase={siteUrl()} preferConfigured={isProd()} />
        </div>
        {lateral.length > 0 && (
          <div className="hidden lg:block">
            <div className="sticky top-4"><AdSlot position="lateral" ads={lateral} intervalSeconds={slots.lateral.rotationSeconds} /></div>
          </div>
        )}
      </div>
      <AdSlot position="rodape" ads={rodape} intervalSeconds={slots.rodape.rotationSeconds} className="mt-5" />
    </>
  );
}
