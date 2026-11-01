import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import type { TenantPublico } from "./tenant";
import Header, { PRINCIPAIS } from "@/components/Header";

const roteador: AppRouterInstance = {
  back() {}, forward() {}, refresh() {},
  push() {}, replace() {}, prefetch() {},
};

const loja = {
  slug: "catalogo",
  nome: "Catálogo",
  plano: "SITE",
  status: "ATIVA",
  whatsapp: null,
  mpPublicKey: null,
  meiosPagamento: [],
  pixNaConta: false,
  retiradaNaLoja: true,
  despachoDiasUteis: 1,
  estoqueBaixoEm: 3,
  freteGratisAcima: null,
  pedidoMinimoCentavos: null,
  avisoTopo: null,
  segmento: "geral",
  configuradorSobMedida: false,
  vende: false,
} satisfies TenantPublico;

function renderizar(quantidade: number) {
  const categorias = Array.from({ length: quantidade }, (_, indice) => ({
    slug: `categoria-${indice + 1}`,
    nome: `Categoria ${indice + 1}`,
  }));
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: roteador },
      createElement(PathnameContext.Provider, { value: "/produtos" },
        createElement(Header, { loja, logoUrl: null, categorias }),
      ),
    ),
  );
}

test("faixa de categorias tem nome acessível e continuação explícita", () => {
  const html = renderizar(PRINCIPAIS + 2);
  const faixa = html.match(/<nav class="nav-loja[\s\S]*?<\/nav>/)?.[0] ?? "";

  assert.match(faixa, /aria-label="Categorias de produtos"/);
  assert.equal((faixa.match(/href="\/categoria\//g) ?? []).length, PRINCIPAIS);
  assert.match(faixa, />Ver todas<\/a>/);
});

test("menu móvel conserva acesso a todas as categorias", () => {
  const quantidade = PRINCIPAIS + 2;
  const html = renderizar(quantidade);
  const menu = html.match(/<dialog[\s\S]*?<\/dialog>/)?.[0] ?? "";

  assert.equal((menu.match(/href="\/categoria\//g) ?? []).length, quantidade);
  assert.match(menu, />Categoria 10<\/a>/);
});

test("loja habilitada oferece o projeto sob medida no menu", () => {
  const html = renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: roteador },
      createElement(PathnameContext.Provider, { value: "/" },
        createElement(Header, { loja: { ...loja, configuradorSobMedida: true }, logoUrl: null, categorias: [] }),
      ),
    ),
  );
  assert.match(html, /href="\/configurador"/);
  assert.match(html, />Projeto sob medida<\/a>/);
});
