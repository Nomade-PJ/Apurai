import test from "node:test";
import assert from "node:assert/strict";
import { averageColorHex, computeFit, outputSize } from "../lib/ads/fit";
import { SLOT_FORMATS } from "../lib/ads/formats";
import { evaluateBannerDimensions } from "../lib/ads/banner-rules";

const ifood = { width: 1440, height: 756 }; // imagem da web, 1,9:1
const topo = SLOT_FORMATS.topo.desktop; // 970×90

test("encaixar (contain): imagem inteira, centralizada e sem distorção", () => {
  const r = computeFit(ifood, topo, "contain");
  assert.equal(r.dh, 90);
  assert.ok(Math.abs(r.dw / r.dh - ifood.width / ifood.height) < 0.02); // mesma proporção da origem
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [0, 0, 1440, 756]);
  assert.ok(r.dx >= 0 && r.dx + r.dw <= topo.width);
  assert.ok(Math.abs(r.dx - (topo.width - (r.dx + r.dw))) <= 1); // laterais simétricas
});

test("preencher (cover): ocupa todo o quadro e recorta o centro, sem distorção", () => {
  const r = computeFit(ifood, topo, "cover");
  assert.deepEqual([r.dx, r.dy, r.dw, r.dh], [0, 0, 970, 90]);
  assert.ok(Math.abs(r.sw / r.sh - topo.width / topo.height) < 0.001); // recorte com a proporção do quadro
  assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.sw <= ifood.width + 1e-9 && r.sy + r.sh <= ifood.height + 1e-9);
  assert.ok(Math.abs(r.sy - (ifood.height - (r.sy + r.sh))) < 1e-6); // recorte centralizado na vertical
});

test("o resultado de qualquer ajuste é sempre aceito pela regra de banner (todos os espaços e imagens de vários formatos)", () => {
  const sources = [ifood, { width: 100, height: 100 }, { width: 4000, height: 300 }, { width: 600, height: 2000 }, { width: 970, height: 90 }];
  for (const p of ["topo", "patrocinador", "lateral", "rodape"] as const) {
    for (const spec of [SLOT_FORMATS[p].desktop, SLOT_FORMATS[p].mobile].filter((x): x is NonNullable<typeof x> => Boolean(x))) {
      for (const src of sources) {
        for (const dbl of [true, false]) {
          const out = outputSize(src, spec, dbl);
          assert.ok(evaluateBannerDimensions(out, spec).ok, `${p} ${src.width}x${src.height} dbl=${dbl}`);
        }
      }
    }
  }
});

test("saída 2× só quando a origem tem pixels suficientes", () => {
  assert.deepEqual(outputSize({ width: 1440, height: 756 }, topo), { width: 970, height: 90 });
  assert.deepEqual(outputSize({ width: 2000, height: 900 }, topo), { width: 1940, height: 180 });
  assert.deepEqual(outputSize({ width: 2000, height: 900 }, topo, false), { width: 970, height: 90 });
  assert.deepEqual(outputSize({ width: 1440, height: 756 }, SLOT_FORMATS.topo.mobile!), { width: 640, height: 200 });
});

test("cor média dos cantos em hexadecimal", () => {
  assert.equal(averageColorHex([[234, 29, 44], [234, 29, 44]]), "#ea1d2c");
  assert.equal(averageColorHex([[0, 0, 0], [255, 255, 255]]), "#808080");
  assert.equal(averageColorHex([]), "#ffffff");
});
