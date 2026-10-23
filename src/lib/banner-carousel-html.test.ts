import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BannerCarousel from "@/components/home/BannerCarousel";

const campanhas = [
  { imagemUrl: "/desktop-1.webp", imagemMobileUrl: "/mobile-1.webp", link: "/a", alt: "Primeira" },
  { imagemUrl: "/desktop-2.webp", imagemMobileUrl: "/mobile-2.webp", link: "/b", alt: "Segunda" },
  { imagemUrl: "/desktop-3.webp", imagemMobileUrl: "/mobile-3.webp", link: "/c", alt: "Terceira" },
];

test("carrossel entrega somente a primeira arte no carregamento inicial", () => {
  const html = renderToStaticMarkup(createElement(BannerCarousel, { campanhas }));

  assert.match(html, /srcSet="\/mobile-1\.webp"/);
  assert.match(html, /src="\/desktop-1\.webp"/);
  assert.doesNotMatch(html, /src(?:Set)?="\/(?:mobile|desktop)-[23]\.webp"/);
  assert.equal((html.match(/data-carregada="true"/g) ?? []).length, 1);
  assert.equal((html.match(/data-carregada="false"/g) ?? []).length, 2);
});

test("swipe carrega a campanha que ficou visível", () => {
  const fonte = readFileSync("src/components/home/BannerCarousel.tsx", "utf8");
  assert.match(fonte, /onScroll=.*?[\s\S]*?carregar\(indice\);[\s\S]*?setAtiva\(indice\)/);
});
