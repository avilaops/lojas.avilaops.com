import assert from "node:assert/strict";
import test from "node:test";
import { agruparParaBaixa, type ProdutoParaBaixa } from "./catalogo-reservas";
import { ErroCatalogo } from "./catalogo-oferta";

/**
 * Quanto sai de cada apresentação quando o pedido é pago.
 *
 * É a decisão mais cara de errar do sistema: estoque que desce da apresentação
 * errada não dá erro nenhum — dá cancelamento duas semanas depois, e no
 * Mercado Livre isso custa reputação. Por isso ela é função pura e tem teste,
 * em vez de viver dentro da transação confiando em leitura atenta.
 */

const SIMPLES: ProdutoParaBaixa = {
  id: "p-simples",
  variantes: [{ id: "v-unica", padrao: true, ativo: true }],
};

const CAMISETA: ProdutoParaBaixa = {
  id: "p-camiseta",
  variantes: [
    { id: "v-p", padrao: true, ativo: true },
    { id: "v-g", padrao: false, ativo: true },
  ],
};

test("produto simples baixa da única apresentação, com ou sem variante na linha", () => {
  const { grupos, naoBaixados } = agruparParaBaixa(
    [{ produtoId: "p-simples", varianteId: null, quantidade: 2 }],
    [SIMPLES],
  );
  assert.equal(grupos.get("v-unica"), 2);
  assert.deepEqual(naoBaixados, []);
});

test("a variante da linha manda, e não a padrão", () => {
  const { grupos } = agruparParaBaixa(
    [{ produtoId: "p-camiseta", varianteId: "v-g", quantidade: 3 }],
    [CAMISETA],
  );
  assert.equal(grupos.get("v-g"), 3);
  assert.equal(grupos.get("v-p"), undefined, "o P não pode ser tocado numa venda do G");
});

test("linha sem variante em produto com várias NÃO vira a padrão", () => {
  // O bug que isto fecha: vender o G tirava o P, errando duas apresentações de
  // uma vez — o P some da prateleira estando lá, o G segue à venda tendo
  // acabado.
  const { grupos, naoBaixados } = agruparParaBaixa(
    [{ produtoId: "p-camiseta", varianteId: null, quantidade: 1 }],
    [CAMISETA],
  );
  assert.equal(grupos.size, 0);
  assert.equal(naoBaixados.length, 1);
});

test("variante inativa não conta para decidir se há ambiguidade", () => {
  // Restou uma ativa: não há o que escolher, e a venda baixa normalmente.
  const comInativa: ProdutoParaBaixa = {
    id: "p-camiseta",
    variantes: [{ id: "v-p", padrao: true, ativo: true }, { id: "v-g", padrao: false, ativo: false }],
  };
  const { grupos } = agruparParaBaixa([{ produtoId: "p-camiseta", varianteId: null, quantidade: 1 }], [comInativa]);
  assert.equal(grupos.get("v-p"), 1);
});

test("linha sem produto é pulada, e não derruba as outras do mesmo pedido", () => {
  // Venda de canal com anúncio não vinculado: não há estoque nosso a mexer.
  // Antes isto lançava e a baixa do pedido inteiro falhava.
  const { grupos, naoBaixados } = agruparParaBaixa(
    [
      { produtoId: null, varianteId: null, quantidade: 5 },
      { produtoId: "p-simples", varianteId: null, quantidade: 1 },
    ],
    [SIMPLES],
  );
  assert.equal(grupos.get("v-unica"), 1, "a linha que casou continua baixando");
  assert.equal(naoBaixados.length, 1);
});

test("duas linhas da mesma apresentação somam", () => {
  const { grupos } = agruparParaBaixa(
    [
      { produtoId: "p-camiseta", varianteId: "v-g", quantidade: 2 },
      { produtoId: "p-camiseta", varianteId: "v-g", quantidade: 3 },
    ],
    [CAMISETA],
  );
  assert.equal(grupos.get("v-g"), 5);
});

test("variante que não existe no produto é inconsistência, e lança", () => {
  // Diferente de "não sei qual": aqui a linha afirma uma apresentação que o
  // produto não tem. Seguir em silêncio esconderia corrupção de dado.
  assert.throws(
    () => agruparParaBaixa([{ produtoId: "p-camiseta", varianteId: "v-fantasma", quantidade: 1 }], [CAMISETA]),
    ErroCatalogo,
  );
});

test("produto que não veio travado é inconsistência, e lança", () => {
  assert.throws(
    () => agruparParaBaixa([{ produtoId: "p-ausente", varianteId: "v", quantidade: 1 }], [CAMISETA]),
    ErroCatalogo,
  );
});
