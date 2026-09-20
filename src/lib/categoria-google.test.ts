import assert from "node:assert/strict";
import test from "node:test";
import { categoriaGoogle, categoriaGoogleProduto, prateleirasDaLoja } from "./categoria-google";

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

test("classifica produtos de categorias amplas quando o nome informa a finalidade", () => {
  assert.equal(categoriaGoogleProduto("BOM-1302 Fita dupla FACE 1.7 280CM", "Fitas"), undefined);
  assert.equal(categoriaGoogleProduto("Fita Crepe 24MMX50M Tapefix", "Fitas"), undefined);
  assert.equal(categoriaGoogleProduto("BOM-1318 Fita Espanta Passaros 4.8CM 45M", "Fitas"), 7137);
  assert.equal(categoriaGoogleProduto("Feltros Autoadesivos Quadrados BOM-1333", "Colas"), 7214);
  assert.equal(categoriaGoogleProduto("CAPA P/CHUVA PVC Forr.amar. G Nikol", "Outros"), 3066);
  assert.equal(categoriaGoogleProduto("JOGO Allen (plastico)", "Outros"), 1439);
  assert.equal(categoriaGoogleProduto("Suporte para Fita Lacradora Masterprint Mp-901", "Fitas"), 503746);
  assert.equal(categoriaGoogleProduto("KAOL P/POLIMENTO 200 ml", "Químicos"), 2590);
  assert.equal(categoriaGoogleProduto("ORBI CERA Polidora", "Outros"), 2643);
  assert.equal(categoriaGoogleProduto("ETANIZ Grafite Spray Etaniz 300ML180G", "Grafite"), 1753);
  assert.equal(categoriaGoogleProduto("Carga GAS P/MACAR/FOG Original 227G", "Elétrica"), 543575);
  assert.equal(categoriaGoogleProduto("KIT Anel Milimitro(azul)", "Anéis"), 111);
  assert.equal(categoriaGoogleProduto("Fita Guia LISA Teflon com Bronze 10x2.5", "Fitas"), 111);
  assert.equal(categoriaGoogleProduto("VONDER Macaco Garrafa 12TON", "Outros"), 503771);
  assert.equal(categoriaGoogleProduto("ORION Reparo Motor Danfoss OMS 160", "Outros"), 111);
  assert.equal(categoriaGoogleProduto("IBIRA Borracha Esponjosa 1021 16x8 20344", "Outros"), 503744);
  assert.equal(categoriaGoogleProduto("Assento Alumasa ROMA branco", "Outros"), 1865);
  assert.equal(categoriaGoogleProduto("Tampa Lavatorio EVA", "Hidráulica"), 1963);
  assert.equal(categoriaGoogleProduto("Tampa NBR 47x7", "Hidráulica"), 111);
  assert.equal(categoriaGoogleProduto("Cantoneira P/MOV OVER BIC.11/2 C/04", "Cantoneiras"), 632);
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
