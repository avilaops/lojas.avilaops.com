import test from "node:test";
import assert from "node:assert/strict";
import { selecionarVitrineDomiRio, mensagemCotacaoDomiRio, fonteOficialDomiRio, categoriasDoArtigoDomiRio } from "./domirio-comercial";

test("vitrine distribui categorias e famílias antes de repetir apresentações", () => {
  const produto = (id: string, categoriaId: string, familia: string, estoque = 10) => ({ id, categoriaId, atributos: { familia }, ativo: true, imagens: ["/foto.webp"], precoCentavos: 100, estoque, disponibilidade: "in_stock" });
  const entrada = [produto("a1", "odores", "Hora 2"), produto("a2", "odores", "Hora 2"), produto("a3", "odores", "Sanepec"), produto("b1", "pragas", "Termitox"), produto("b2", "pragas", "Pirazol"), produto("c1", "roedores", "Roetox"), produto("x", "outro", "Sem saldo", 0)];
  const resultado = selecionarVitrineDomiRio(entrada, 5);
  assert.deepEqual(resultado.map(p => p.id), ["a1", "b1", "c1", "a3", "b2"]);
  assert.equal(entrada[1].id, "a2");
  assert.equal(selecionarVitrineDomiRio(entrada, 20).length, 6);
  assert.equal(selecionarVitrineDomiRio([{ ...entrada[0], imagens: [] }], 12).length, 0);
});

test("cotação preserva código, apresentação, quantidade e URL da variante", () => {
  const mensagem = mensagemCotacaoDomiRio({ nome: "Cypertryne", sku: "ISO015", slug: "cypertryne-100", apresentacao: "1 L", varianteId: "v-1" }, "https://domiriodistribuidora.com.br/", 12);
  assert.match(mensagem, /Código: ISO015/);
  assert.match(mensagem, /Apresentação: 1 L/);
  assert.match(mensagem, /Quantidade: 12 unidades/);
  assert.match(mensagem, /\/produtos\/cypertryne-100\?variante=v-1/);
  assert.throws(() => mensagemCotacaoDomiRio({ nome: "A", slug: "a", sku: null }, "https://loja.com", 0));
  assert.throws(() => mensagemCotacaoDomiRio({ nome: "A", slug: "a", sku: null }, "https://loja.com", 1.5));
});

test("home preserva Glifosato 21 mL e kit mesmo pertencendo à mesma família", () => {
  const p = (slug: string, familia: string, estoque = 10) => ({ id: slug, slug, categoriaId: familia, atributos: { familia }, ativo: true, imagens: ["/foto.webp"], precoCentavos: 100, estoque, disponibilidade: "in_stock" });
  const catalogo = [...Array.from({ length: 20 }, (_, i) => p(`outro-${i}`, `fam-${i}`)), p("glifosato-kit10-4un-x-21ml", "Glifosato"), p("glifosato-21ml", "Glifosato"), p("cypertryne-100", "Cypertryne")];
  const home = selecionarVitrineDomiRio(catalogo);
  assert.equal(home.length, 12);
  for (const slug of ["cypertryne-100", "glifosato-21ml", "glifosato-kit10-4un-x-21ml"]) assert.ok(home.some(p => p.slug === slug));
  assert.equal(selecionarVitrineDomiRio(catalogo.map(p => p.slug === "glifosato-21ml" ? { ...p, estoque: 0 } : p)).some(p => p.slug === "glifosato-21ml"), false);
});

test("documentação aceita somente HTTPS do fabricante confirmado", () => {
  assert.equal(fonteOficialDomiRio({ _fonteTecnicaVerificada: "https://isorgan.com.br/produtos/cypertryne" }), "https://isorgan.com.br/produtos/cypertryne");
  for (const url of ["javascript:alert(1)", "https://isorgan.com.br.evil.test/a", "http://isorgan.com.br/a", "https://evil.test/", "https://user:secret@isorgan.com.br/a"]) {
    assert.equal(fonteOficialDomiRio({ _fonteTecnicaVerificada: url }), null);
  }
});

test("conteúdo agrícola mantém distinção do catálogo saneante", () => {
  assert.deepEqual(categoriasDoArtigoDomiRio(3), ["herbicidas"]);
  assert.deepEqual(categoriasDoArtigoDomiRio(2), ["controle-de-pragas", "inseticida"]);
  assert.deepEqual(categoriasDoArtigoDomiRio(7), []);
});
