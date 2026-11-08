import { test } from "node:test";
import assert from "node:assert/strict";
import { ImportacaoFotosSchema } from "./importacao-fotos";

const item = { produtoId: "1", sku: "12", nome: "Roda", versaoCatalogo: 1, imagemUrl: "https://kr-wheels.com/wp-content/uploads/2026/roda.png", pagina: "https://kr-wheels.com/rodas/s62/", familia: "KRMAI S62 BD", criterio: "Modelo e acabamento conferidos, foto de série." };
test("foto não aceita preço, protocolo inseguro, host semelhante ou SVG", () => {
  assert.equal(ImportacaoFotosSchema.safeParse(item).success, true);
  for (const imagemUrl of ["não é URL", "http://kr-wheels.com/wp-content/uploads/roda.png", "https://kr-wheels.com.outro.test/wp-content/uploads/roda.png", "https://kr-wheels.com/wp-content/uploads/roda.svg", "https://user:senha@kr-wheels.com/wp-content/uploads/roda.png", "https://cdn.pneufree.com.br/CMS/logo.jpg", "https://cdn.allopneus.com/produit/icone.svg"]) {
    assert.equal(ImportacaoFotosSchema.safeParse({ ...item, imagemUrl }).success, false);
  }
  assert.equal(ImportacaoFotosSchema.safeParse({ ...item, precoCentavos: 1 }).success, false);
});
