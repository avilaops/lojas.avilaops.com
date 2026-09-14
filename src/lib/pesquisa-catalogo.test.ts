import test from "node:test";
import assert from "node:assert/strict";
import { impedimentoPromocao, PromoverImagemPesquisaSchema } from "./pesquisa-catalogo";

const candidata = {
  estado: "APROVADA",
  direitoUso: "PERMITIDO",
  correspondenciaExata: true,
  urlArmazenada: "https://lojas.avilaops.com/uploads/vedashow/anel.webp",
  correspondencia: { confirmada: true, confianca: "alta" },
};

test("só promove imagem armazenada, autorizada e ligada ao produto exato", () => {
  assert.equal(impedimentoPromocao(candidata), null);
  assert.match(impedimentoPromocao({ ...candidata, correspondenciaExata: false })!, /produto exato/);
  assert.match(impedimentoPromocao({ ...candidata, direitoUso: "DESCONHECIDO" })!, /autorizado/);
  assert.match(impedimentoPromocao({ ...candidata, urlArmazenada: null })!, /armazenada/);
  assert.match(impedimentoPromocao({ ...candidata, estado: "PENDENTE" })!, /não aprovada/);
});

test("entrada da promoção exige identificador e aceita versão otimista", () => {
  assert.equal(PromoverImagemPesquisaSchema.safeParse({ imagemCandidataId: "img_1", versaoCatalogo: 2 }).success, true);
  assert.equal(PromoverImagemPesquisaSchema.safeParse({ imagemCandidataId: "", versaoCatalogo: 0 }).success, false);
});
