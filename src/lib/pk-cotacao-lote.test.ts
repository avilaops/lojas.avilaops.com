import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCotacao, lerListaCotacao, mensagemCotacao, resolverCotacao, validarItensCotacao, type ProdutoCotacao } from "./pk-cotacao-lote";
import referencias from "../content/pkvedacoes/referencias-agel.json";

const produto: ProdutoCotacao = { slug: "peca", nome: "Peça", sku: "001-A", codigoOriginal: "OEM", codigosEquivalentes: ["EQ"], atributos: { referencia: "REF", codigoFabricante: "FAB" }, ativo: true, precoCentavos: 1250, disponibilidade: "in_stock", estoque: 3 };
test("CSV aceita BOM, cabeçalho, separadores e códigos entre aspas sem apagar zeros", () => {
  assert.deepEqual(lerListaCotacao('\uFEFFcódigo;quantidade\r\n"001-A";2\n"A;B";3'), [{ codigo: "001-A", quantidade: 2 }, { codigo: "A;B", quantidade: 3 }]);
  assert.deepEqual(lerListaCotacao('"A,B",5'), [{ codigo: "A,B", quantidade: 5 }]);
  assert.deepEqual(lerListaCotacao('"A""B";1'), [{ codigo: 'A"B', quantidade: 1 }]);
});
test("lista recusa erros e excessos sem descartar linhas silenciosamente", () => {
  for (const texto of ["", "A;0", "A;-2", "A;1.5", "A;10001", "A;2;extra", '"A;1', "A;1\nB;invalid", "A".repeat(32769), Array(101).fill("A;1").join("\n")]) assert.throws(() => lerListaCotacao(texto));
  assert.throws(() => validarItensCotacao([{ codigo: "A", quantidade: "2" }]));
  assert.throws(() => validarItensCotacao([{ codigo: "A\nB", quantidade: 2 }]));
});
test("resolução exata usa códigos cadastrados, mantém duplicatas e quantidades", () => {
  const itens = ["001-a", "OEM", "eq", "REF", "FAB", "001", "inventado"].map(codigo => ({ codigo, quantidade: 5 }));
  const resultado = resolverCotacao(itens, [produto], false);
  assert.deepEqual(resultado.map(r => r.estado), ["encontrado", "encontrado", "encontrado", "encontrado", "encontrado", "nao-encontrado", "nao-encontrado"]);
  assert.equal(resultado[0].quantidade, 5);
  assert.equal(resultado[0].quantidadeAConfirmar, true);
  assert.equal(resolverCotacao([itens[0], itens[0]], [produto], false).length, 2);
});
test("não escolhe primeiro resultado nem consulta produto inativo", () => {
  const [ambiguo] = resolverCotacao([{ codigo: "OEM", quantidade: 1 }], [produto, { ...produto, slug: "outra" }], false);
  assert.equal(ambiguo.estado, "ambiguo"); assert.equal(ambiguo.produtos.length, 2);
  assert.equal(resolverCotacao([{ codigo: "OEM", quantidade: 1 }], [{ ...produto, ativo: false }], false)[0].estado, "nao-encontrado");
});
test("estado de venda preserva precedência e preço atual", () => {
  const consultar = (alteracoes: Partial<ProdutoCotacao>) => resolverCotacao([{ codigo: "OEM", quantidade: 1 }], [{ ...produto, ...alteracoes }], true)[0];
  assert.equal(consultar({ precoCentavos: 0 }).estado, "consulta-preco");
  assert.equal(consultar({ precoCentavos: 0 }).produtos[0].precoCentavos, null);
  assert.equal(consultar({ precoCentavos: 0, estoque: 0 }).estado, "esgotado");
  assert.equal(consultar({ disponibilidade: "out_of_stock" }).estado, "esgotado");
  assert.equal(consultar({}).produtos[0].precoCentavos, 1250);
});
test("exportação neutraliza fórmulas e mensagem conserva pendências", () => {
  const itens = resolverCotacao([{ codigo: "=SUM(A1)", quantidade: 4 }, { codigo: "OEM", quantidade: 5 }], [produto], false);
  assert.ok(csvCotacao(itens).includes('"\'=SUM(A1)"'));
  assert.ok(mensagemCotacao(itens).includes("Quantidade: 4 | Não encontrado"));
  assert.ok(mensagemCotacao(itens).includes("Confirmar quantidade disponível"));
});
test("referência relacionada só resolve enquanto o cadastro confere com a documentação", () => {
  const referencia = referencias.referencias[0];
  const atributos = { material: "Nylon com fibra de vidro", referencia: referencia.referenciaPk, diametroInternoMm: referencia.diametroInternoMm, diametroExternoMm: referencia.diametroExternoMm, secaoMm: referencia.secaoMm, alturaMm: referencia.alturaMm };
  const cadastrado = { ...produto, slug: referencia.slug, atributos };
  const itens = [{ codigo: `AGEL ${referencia.codigoAgel}`, quantidade: 2 }];
  assert.equal(resolverCotacao(itens, [cadastrado], false)[0].estado, "encontrado");
  assert.equal(resolverCotacao(itens, [{ ...cadastrado, atributos: { ...atributos, material: "Outro" } }], false)[0].estado, "nao-encontrado");
  assert.equal(resolverCotacao(itens, [{ ...cadastrado, atributos: { ...atributos, alturaMm: 999 } }], false)[0].estado, "nao-encontrado");
});
