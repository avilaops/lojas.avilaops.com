import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TemaSchema, lerTema } from "./tema";

const IMG = "https://lojas.avilaops.com/uploads/loja/foto.webp";

test("loja que não preencheu nada continua sem o bloco automotivo", () => {
  assert.equal(lerTema({ layout: "automotivo" }).automotivo, undefined);
});

test("imagens e campanhas preenchidas atravessam o schema sem perder campo", () => {
  const automotivo = {
    bannerMobileUrl: IMG,
    etapasImagens: { lavar: IMG, corrigir: IMG, proteger: IMG },
    campanhas: [{ imagem: IMG, selo: "Oferta da semana", titulo: "Kit completo", texto: "Tudo para a lavagem.", botao: "Ver kits", link: "/categoria/kits-completos" }],
  };
  assert.deepEqual(TemaSchema.parse({ layout: "automotivo", automotivo }).automotivo, automotivo);
});

test("imagem e destino de campanha rejeitam execução, injeção e saída da loja", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,foo", "//externo.com/foto", '/foto"><script>']) {
    assert.equal(TemaSchema.safeParse({ automotivo: { bannerMobileUrl: url } }).success, false, url);
    assert.equal(TemaSchema.safeParse({ automotivo: { etapasImagens: { lavar: url } } }).success, false, url);
  }
  for (const link of ["https://externo.com", "//externo.com", "javascript:alert(1)", "/a b", "produtos"]) {
    assert.equal(TemaSchema.safeParse({ automotivo: { campanhas: [{ imagem: IMG, titulo: "T", link }] } }).success, false, link);
  }
});

test("campanha pela metade não entra, e o tema aceita no máximo duas", () => {
  assert.equal(TemaSchema.safeParse({ automotivo: { campanhas: [{ imagem: IMG, titulo: "", link: "/produtos" }] } }).success, false);
  const c = { imagem: IMG, titulo: "T", link: "/produtos" };
  assert.equal(TemaSchema.safeParse({ automotivo: { campanhas: [c, c, c] } }).success, false);
});

test("o layout não escreve loja nem categoria na mão", () => {
  const s = readFileSync("src/components/home/Automotivo.tsx", "utf8");
  assert.equal(/brilhax|\/categoria\/[a-z]/i.test(s), false);
});
