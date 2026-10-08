import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { montarPedidoSeguro, PedidoInvalidoError, type PayloadCheckout, type ResolucaoCatalogo } from "./pedido.ts";
import { FRETE_RETIRADA_ID, type ItemCarrinho, type OpcaoFrete } from "../core/types.ts";

// Esta é a fronteira de segurança do checkout. Tudo que chega aqui veio do
// navegador e pode ter sido editado à mão. Os testes existem para garantir que
// nenhuma dessas edições vira cobrança errada.

const CATALOGO: Record<string, ItemCarrinho> = {
  "v-floc": { id: "v-floc", nome: "V-Floc 500ml", quantidade: 1, precoUnitario: 3140 },
  blend: { id: "blend", nome: "Blend Spray", quantidade: 1, precoUnitario: 5608 },
};

const SEDEX: OpcaoFrete = { id: "sedex", nome: "Sedex", preco: 2500, prazoDiasUteis: 3 };
const RETIRADA: OpcaoFrete = {
  id: FRETE_RETIRADA_ID,
  nome: "Retirar na loja",
  preco: 0,
  prazoDiasUteis: 1,
};

const catalogo: ResolucaoCatalogo = {
  resolverItens: async (ids) =>
    ids
      .map((i) => {
        const base = CATALOGO[i.id];
        return base ? { ...base, quantidade: i.quantidade } : null;
      })
      .filter((x): x is ItemCarrinho => x !== null),
  resolverFretes: async () => [SEDEX, RETIRADA],
};

function payload(over: Partial<PayloadCheckout> = {}): PayloadCheckout {
  return {
    referencia: "PED-1",
    itens: [{ id: "v-floc", quantidade: 1 }],
    cliente: {
      nome: "Nicolas",
      sobrenome: "Avila",
      email: "Nicolas@Exemplo.com",
      telefone: "(16) 99412-3923",
      documento: "529.982.247-25",
    },
    entrega: {
      cep: "14075-240",
      logradouro: "R. Holanda",
      numero: "1200",
      bairro: "Vila Mariana",
      cidade: "Ribeirão Preto",
      uf: "SP",
    },
    freteId: "sedex",
    meioPagamento: "pix",
    ...over,
  };
}

async function esperaRecusa(entrada: PayloadCheckout, codigo: string) {
  await assert.rejects(
    () => montarPedidoSeguro(entrada, catalogo),
    (erro: unknown) => {
      assert.ok(erro instanceof PedidoInvalidoError, "deveria ser PedidoInvalidoError");
      assert.equal(erro.codigo, codigo);
      return true;
    },
  );
}

describe("montarPedidoSeguro , o preço vem do catálogo", () => {
  it("cobra o preço do catálogo, não o que o navegador mandou", async () => {
    // O payload sequer tem campo de preço , este teste trava essa decisão de
    // desenho. Se um dia alguém adicionar `precoUnitario` ao payload e passar a
    // usá-lo, este teste continua verde mas o desenho quebrou; por isso ele
    // confere o VALOR final contra o catálogo.
    const { total } = await montarPedidoSeguro(payload(), catalogo);
    assert.equal(total, 3140 + 2500);
  });

  it("multiplica pela quantidade pedida", async () => {
    const { total } = await montarPedidoSeguro(
      payload({ itens: [{ id: "v-floc", quantidade: 3 }] }),
      catalogo,
    );
    assert.equal(total, 3140 * 3 + 2500);
  });

  it("normaliza quantidade fracionada ou zero para pelo menos 1", async () => {
    const { pedido } = await montarPedidoSeguro(
      payload({ itens: [{ id: "v-floc", quantidade: 0 }] }),
      catalogo,
    );
    assert.equal(pedido.itens[0]?.quantidade, 1);
  });

  it("recusa quando o total exibido diverge do recalculado", async () => {
    // Preço que mudou entre montar o carrinho e pagar. Cobrar assim mesmo é
    // cobrar valor que a pessoa não viu nem concordou.
    await esperaRecusa(payload({ totalExibido: 100 }), "total_divergente");
  });

  it("aceita quando o total exibido confere", async () => {
    const { total } = await montarPedidoSeguro(payload({ totalExibido: 5640 }), catalogo);
    assert.equal(total, 5640);
  });
});

describe("montarPedidoSeguro , recusas", () => {
  it("recusa carrinho vazio", async () => {
    await esperaRecusa(payload({ itens: [] }), "carrinho_vazio");
  });

  it("recusa quando um item sumiu do catálogo", async () => {
    // Ignorar em silêncio faria o cliente pagar por um pedido diferente do que
    // montou.
    await esperaRecusa(
      payload({ itens: [{ id: "v-floc", quantidade: 1 }, { id: "produto-morto", quantidade: 1 }] }),
      "item_indisponivel",
    );
  });

  it("recusa CPF com dígito verificador errado", async () => {
    await esperaRecusa(
      payload({ cliente: { ...payload().cliente, documento: "111.111.111-11" } }),
      "cliente_invalido",
    );
  });

  it("recusa celular inválido", async () => {
    await esperaRecusa(
      payload({ cliente: { ...payload().cliente, telefone: "1633" } }),
      "cliente_invalido",
    );
  });

  it("recusa e-mail inválido", async () => {
    await esperaRecusa(
      payload({ cliente: { ...payload().cliente, email: "nicolas@" } }),
      "cliente_invalido",
    );
  });

  it("recusa frete que não foi cotado no servidor", async () => {
    // O cliente poderia mandar um id de frete grátis inventado.
    await esperaRecusa(payload({ freteId: "frete-gratis-invented" }), "frete_invalido");
  });

  it("recusa entrega sem endereço quando o frete não é retirada", async () => {
    await esperaRecusa(payload({ entrega: null }), "endereco_obrigatorio");
  });

  it("recusa cartão sem token do navegador", async () => {
    await esperaRecusa(payload({ meioPagamento: "cartao" }), "cartao_sem_token");
  });
});

describe("montarPedidoSeguro , retirada e normalização", () => {
  it("aceita retirada na loja sem endereço, e sem cobrar frete", async () => {
    const { pedido, total } = await montarPedidoSeguro(
      payload({ freteId: FRETE_RETIRADA_ID, entrega: null }),
      catalogo,
    );
    assert.equal(pedido.entrega, undefined);
    assert.equal(total, 3140, "retirada não soma frete");
  });

  it("normaliza documento e telefone para só dígitos, e e-mail para minúsculo", async () => {
    // O gateway recebe estes campos direto; máscara de tela vira dado sujo na
    // cobrança e na nota fiscal.
    const { pedido } = await montarPedidoSeguro(payload(), catalogo);
    assert.equal(pedido.cliente.documento, "52998224725");
    assert.equal(pedido.cliente.telefone, "16994123923");
    assert.equal(pedido.cliente.email, "nicolas@exemplo.com");
  });

  it("preserva a referência do pedido, que é a chave de idempotência", async () => {
    const { pedido } = await montarPedidoSeguro(payload({ referencia: "PED-XYZ" }), catalogo);
    assert.equal(pedido.referencia, "PED-XYZ");
  });
});

describe("montarPedidoSeguro , pedido mínimo da loja", () => {
  // v-floc custa 3140. O mínimo é dado da loja; estes valores são só do teste.
  const comMinimo = (pedidoMinimo: number | null): ResolucaoCatalogo => ({ ...catalogo, pedidoMinimo });

  it("recusa abaixo do mínimo e diz quanto falta", async () => {
    await assert.rejects(
      () => montarPedidoSeguro(payload(), comMinimo(5000)),
      (erro: unknown) => {
        assert.ok(erro instanceof PedidoInvalidoError);
        assert.equal(erro.codigo, "pedido_minimo");
        assert.match(erro.message.replace(/\s/g, " "), /Pedido mínimo de R\$ 50,00 em produtos\. Faltam R\$ 18,60\./);
        return true;
      },
    );
  });

  it("frete não conta para o mínimo", async () => {
    // 3140 de produto + 2500 de Sedex passa de 5000, e mesmo assim é recusado.
    await assert.rejects(
      () => montarPedidoSeguro(payload(), comMinimo(5000)),
      (erro: unknown) => erro instanceof PedidoInvalidoError && erro.codigo === "pedido_minimo",
    );
  });

  it("aceita exatamente no mínimo e acima dele", async () => {
    const noLimite = await montarPedidoSeguro(payload(), comMinimo(3140));
    assert.equal(noLimite.total, 3140 + 2500);
    const acima = await montarPedidoSeguro(payload({ itens: [{ id: "v-floc", quantidade: 2 }] }), comMinimo(5000));
    assert.equal(acima.total, 3140 * 2 + 2500);
  });

  it("cupom não tira o pedido do mínimo: vale o subtotal antes do desconto", async () => {
    const { total } = await montarPedidoSeguro(payload(), { ...comMinimo(3140), resolverDesconto: async () => 1000 });
    assert.equal(total, 3140 + 2500 - 1000);
  });

  it("loja sem mínimo (nulo ou zero) aceita qualquer valor", async () => {
    assert.equal((await montarPedidoSeguro(payload(), comMinimo(null))).total, 5640);
    assert.equal((await montarPedidoSeguro(payload(), comMinimo(0))).total, 5640);
  });

  it("o mínimo é conferido antes de cotar frete", async () => {
    let cotou = false;
    const espiao: ResolucaoCatalogo = { ...comMinimo(5000), resolverFretes: async () => { cotou = true; return [SEDEX]; } };
    await assert.rejects(() => montarPedidoSeguro(payload(), espiao));
    assert.equal(cotou, false);
  });
});
