import assert from "node:assert/strict";
import test from "node:test";
import { categoriaGoogle, prateleirasDaLoja } from "./categoria-google";

test("não força uma categoria para abraçadeiras de uso não confirmado", () => {
  assert.equal(categoriaGoogle("Abraçadeiras"), undefined);
  assert.equal(categoriaGoogle("Abraçadeira"), undefined);
  assert.equal(categoriaGoogle("Acessórios"), undefined);
});

test("mapeia categorias com nome exato na taxonomia do Google", () => {
  assert.equal(categoriaGoogle("Alicates"), 1958);
  assert.equal(categoriaGoogle("Arruelas"), 2195);
  assert.equal(categoriaGoogle("Correntes"), 1492);
  assert.equal(categoriaGoogle("Estiletes"), 2198);
  assert.equal(categoriaGoogle("Ferragens"), 632);
  assert.equal(categoriaGoogle("Ferramentas"), 1167);
  assert.equal(categoriaGoogle("Tintas Spray"), 1361);
  assert.equal(categoriaGoogle("Tintas spray"), 1361);
  assert.equal(categoriaGoogle("Molas"), 499933);
  assert.equal(categoriaGoogle("Parafusos"), 2251);
  assert.equal(categoriaGoogle("Serras"), 1235);
  assert.equal(categoriaGoogle("Torneiras"), 2032);
  assert.equal(categoriaGoogle("Anéis"), undefined);
  assert.equal(categoriaGoogle("Discos"), undefined);
  assert.equal(categoriaGoogle("Conjuntos"), undefined);
});

test("classifica apenas fita adesiva para embalagem pela finalidade", () => {
  assert.equal(categoriaGoogle("Fita ades. p/emb 48mm"), 975);
  assert.equal(categoriaGoogle("Fitas dupla face"), undefined);
});

test("põe cada categoria da Brilhax na prateleira certa", () => {
  assert.equal(categoriaGoogle("Lavagem"), 2590);
  assert.equal(categoriaGoogle("Polimento"), 2590);
  assert.equal(categoriaGoogle("Vitrificação"), 2643);
  assert.equal(categoriaGoogle("Proteção"), 2643);
  assert.equal(categoriaGoogle("Kits Completos"), 2895);
});

test("reconhece o vocabulário do ramo, não só o nome exato", () => {
  assert.equal(categoriaGoogle("Shampoo automotivo"), 2590);
  assert.equal(categoriaGoogle("Boinas e espumas"), 2590);
  assert.equal(categoriaGoogle("Coating cerâmico"), 2643);
  assert.equal(categoriaGoogle("Panos de microfibra"), 2894);
});

test("categoria de outro ramo não recebe prateleira chutada", () => {
  assert.equal(categoriaGoogle("Retentores"), undefined);
  assert.equal(categoriaGoogle("Camisetas"), undefined);
});

test("não quebra com categoria ausente", () => {
  assert.equal(categoriaGoogle(null), undefined);
  assert.equal(categoriaGoogle(undefined), undefined);
  assert.equal(categoriaGoogle(""), undefined);
});

/** As sete categorias reais da Brilhax, como o lojista as nomeou. */
const BRILHAX = ["Lavagem", "Polimento", "Vitrificação", "Proteção", "Acessórios", "Kits Completos", "Produtos para Moto"];

test("nome genérico sozinho não recebe prateleira", () => {
  assert.equal(categoriaGoogle("Acessórios"), undefined);
  assert.equal(categoriaGoogle("Produtos para Moto"), undefined);
});

test("o ramo da loja resolve os nomes genéricos", () => {
  const prateleira = prateleirasDaLoja(BRILHAX);
  assert.equal(prateleira("Acessórios"), 2894);
  assert.equal(prateleira("Produtos para Moto"), 2895);
});

test("nenhuma das sete categorias da Brilhax fica sem prateleira", () => {
  const prateleira = prateleirasDaLoja(BRILHAX);
  for (const nome of BRILHAX) assert.notEqual(prateleira(nome), undefined, `sem prateleira: ${nome}`);
});

test("o ramo de uma loja não vaza para outra", () => {
  assert.equal(prateleirasDaLoja(["Rações", "Higiene", "Brinquedos", "Acessórios"])("Acessórios"), undefined);
  assert.equal(prateleirasDaLoja(["Cabelo", "Unhas", "Acessórios"])("Acessórios"), undefined);
  assert.equal(prateleirasDaLoja(["Bolos", "Kit festa", "Acessórios"])("Acessórios"), undefined);
});

test("o sinal do ramo não se confunde com palavra parecida", () => {
  const prateleira = prateleirasDaLoja(BRILHAX);
  assert.equal(prateleira("Óleo de motor"), undefined);
  assert.equal(prateleira("Motosserras"), undefined);
});

test("o resolvedor da loja preserva o que já decidia pelo nome", () => {
  const prateleira = prateleirasDaLoja(BRILHAX);
  for (const nome of ["Lavagem", "Polimento", "Vitrificação", "Proteção", "Kits Completos", "Boinas e espumas", "Retentores", "Camisetas"])
    assert.equal(prateleira(nome), categoriaGoogle(nome), nome);
  assert.equal(prateleira(null), undefined);
  assert.equal(prateleira(""), undefined);
});
