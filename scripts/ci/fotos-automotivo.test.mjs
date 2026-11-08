import { test } from "node:test";
import assert from "node:assert/strict";
import { acabamentoDoNome, imagemKrmai, planejar } from "../catalogo/planejar-fotos-bereta.mjs";
import { mesmoPneu } from "../catalogo/fotos-pneus.mjs";

test("pneus não confundem família incompleta, geração, medida ou índice", () => {
  assert.equal(mesmoPneu("PNEU 195/60/15 PIRELLI P7 88H", "Pirelli", "PNEU PIRELLI 195/60R15 88H P7"), true);
  assert.equal(mesmoPneu("PNEU 295/30/18 CONTINENTAL CONTACT", "Continental", "PNEU CONTINENTAL 295/30R18 94Y CONTISPORTCONTACT 2"), false);
  assert.equal(mesmoPneu("PNEU 195/60/15 PIRELLI P7 88H", "Pirelli", "PNEU PIRELLI 195/60R15 88H P7 C2"), false);
  assert.equal(mesmoPneu("PNEU 195/60/15 PIRELLI P7 88H", "Pirelli", "PNEU PIRELLI 195/60R15 88V P7"), false);
});

test("acabamento não transforma prata comum em prata diamantada", () => {
  assert.equal(acabamentoDoNome("RODA KRMAI K16 PRATA"), null);
  assert.equal(acabamentoDoNome("RODA KRMAI K16 PRETA DIAMANTADA"), "BD");
  assert.equal(acabamentoDoNome("RODA KRMAI K16 GRAFITE DIAMANTADA"), "GD");
  assert.equal(acabamentoDoNome("RODA KRMAI S60 PRETA DIAMANTADA FUME (BDS)"), null);
  assert.equal(acabamentoDoNome("RODA KRMAI S60 PRETA DIAM. SMOKE"), null);
});
test("modelo tem fronteira e acabamento; banner e código parcial não são fotos", () => {
  const midia = titulo => ({ title: { rendered: titulo }, source_url: "https://kr-wheels.com/roda.png" });
  assert.equal(imagemKrmai(midia("Banner K16")), null);
  assert.equal(imagemKrmai(midia("K16")), null);
  assert.equal(imagemKrmai(midia("K160_BD_G")).modelo, "K160");
  assert.equal(imagemKrmai({ title: { rendered: "R10" }, source_url: "https://kr-wheels.com/wp-content/uploads/R10-G-SS.png" }).acabamento, "SS");
});
test("produto usado e acabamento diferente não recebem foto nova de outro item", () => {
  const produto = { id: "1", nome: "RODA 15 KRMAI K16 GD", marca: "KRMAI", imagens: [], categoria: { slug: "rodas" }, atributos: { modelo: "K16" } };
  const midias = [{ title: { rendered: "K16_BD_G" }, source_url: "https://kr-wheels.com/roda.png" }];
  assert.equal(planejar([produto], midias)[0].estado, "pendente-pesquisa");
  assert.equal(planejar([{ ...produto, nome: "RODA 15 KRMAI K16 BD USADA" }], midias)[0].estado, "foto-propria-necessaria");
  const boa = planejar([{ ...produto, nome: "RODA 15 KRMAI K16 BD" }], midias)[0];
  assert.equal(boa.imagemOrigem, "representativa");
  assert.equal(boa.estado, "correspondencia-de-serie");
});
