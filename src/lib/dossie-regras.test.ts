import assert from "node:assert/strict";
import test from "node:test";
import { duvidaDeUnidadeDeVenda, fonteSoDeMarketplace, fotoPodeSerPropria, identificadoresPermitidos } from "../../scripts/lib/dossie-regras.mjs";

/** Os dois casos da revisão do PR #12 da Vedashow (07/10/2026). */
const caixaTekbond = {
  gtin: "7898472262711",
  duvidas: ["Três SKUs para a mesma fita: devem ser caixas com quantidades diferentes (catálogo indica caixa com 12). Confirmar unidade de venda de cada SKU antes de publicar o GTIN."],
};
const tesouraBomvink = {
  fotoExata: true,
  imagemOrigem: "propria",
  fontes: [{ tipo: "marketplace", url: "https://www.mercadolivre.com.br/tesoura-kit-3-pecas-bomvink/up/MLBU1" }, { tipo: "marketplace", url: "https://www.magazineluiza.com.br/marcas/bomvink/" }],
  paginaDasFotos: "https://www.mercadolivre.com.br/tesoura-kit-3-pecas-bomvink/up/MLBU1",
};

test("GTIN não entra quando o dossiê duvida da unidade de venda", () => {
  assert.equal(duvidaDeUnidadeDeVenda(caixaTekbond), true);
  assert.equal(identificadoresPermitidos(caixaTekbond), false);
  assert.equal(identificadoresPermitidos({ ...caixaTekbond, unidadeVendaConfirmada: true }), true);
});

test("'conferir na caixa se há sufixo' é leitura da embalagem, não dúvida de unidade", () => {
  const ntn = { mpn: "N307", duvidas: ["Conferir na caixa se há sufixo de gaiola/folga (ex.: N307ET2X, C3) e acrescentar ao mpn se houver."] };
  assert.equal(duvidaDeUnidadeDeVenda(ntn), false);
  assert.equal(identificadoresPermitidos(ntn), true);
});

test("foto só de marketplace não é própria, salvo licença declarada", () => {
  assert.equal(fonteSoDeMarketplace(tesouraBomvink), true);
  assert.equal(fotoPodeSerPropria(tesouraBomvink), false);
  assert.equal(fotoPodeSerPropria({ ...tesouraBomvink, imagemLicenciada: true }), true);
});

test("página de fotos em marketplace basta para barrar, mesmo com fonte de fabricante na lista", () => {
  const item = { fotoExata: true, fontes: [{ tipo: "fabricante", url: "https://www.bomvink.com.br/x" }], paginaDasFotos: "https://www.mercadolivre.com.br/x" };
  assert.equal(fotoPodeSerPropria(item), false);
});

test("foto do fabricante com foto exata continua própria; foto não exata nunca é", () => {
  assert.equal(fotoPodeSerPropria({ fotoExata: true, fontes: [{ tipo: "fabricante", url: "https://www.tekbond.com.br/p" }], paginaDasFotos: "https://www.tekbond.com.br/p" }), true);
  assert.equal(fotoPodeSerPropria({ fotoExata: false, fontes: [{ tipo: "fabricante" }] }), false);
  assert.equal(fotoPodeSerPropria({ imagemOrigem: "representativa", fontes: [{ tipo: "fabricante" }] }), false);
});
