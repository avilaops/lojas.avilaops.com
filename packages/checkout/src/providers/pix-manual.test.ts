import assert from "node:assert/strict";
import test from "node:test";
import { montarBrCodePix } from "../core/pix-brcode.ts";
import type { PedidoCheckout, ResultadoPagamento } from "../core/types.ts";
import { CobrancaRecusada } from "./erros.ts";
import { definicaoPixManual } from "./pix-manual-definicao.ts";
import { PixManualProvider } from "./pix-manual.ts";
import type { EstadoPixManual } from "./types.ts";

const CHAVE = "loja@exemplo.com";
const NOME = "Loja Exemplo";

function pedido(referencia = "PEDIDO1234567890AB"): PedidoCheckout {
  return {
    referencia,
    itens: [{ id: "p1", nome: "Sabonete", quantidade: 1, precoUnitario: 1000 }],
    cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
    frete: { id: "retirada-na-loja", nome: "Retirada", preco: 0, prazoDiasUteis: 0 },
    meioPagamento: "pix",
  };
}

function porta(): EstadoPixManual & { cobrancas: ResultadoPagamento[] } {
  const cobrancas: ResultadoPagamento[] = [];
  const ocupados: number[] = [];
  return {
    cobrancas,
    async reservar({ referencia, totalCentavos, txid, expiraEm, montar }) {
      const ja = cobrancas.find((c) => c.pix && c.id.endsWith(referencia));
      if (ja?.pix) return { id: ja.id, valorCentavos: ja.valor, copiaECola: ja.pix.copiaECola };
      let valor = totalCentavos;
      while (ocupados.includes(valor)) valor += 1;
      ocupados.push(valor);
      const copiaECola = montar(valor);
      const id = `pix-${referencia}`;
      cobrancas.push({
        id,
        status: "aguardando_confirmacao",
        meioPagamento: "pix",
        valor,
        pix: { copiaECola, expiraEm: expiraEm.toISOString() },
      });
      assert.equal(copiaECola.includes(txid), true);
      return { id, valorCentavos: valor, copiaECola };
    },
    async consultar(id) {
      return cobrancas.find((c) => c.id === id) ?? null;
    },
    async buscarPorReferencia(referencia) {
      return cobrancas.find((c) => c.id === `pix-${referencia}`) ?? null;
    },
  };
}

test("capacidades: Pix, sem webhook, sem confirmação automática e sem estorno", () => {
  assert.equal(definicaoPixManual.id, "pix_manual");
  assert.equal(definicaoPixManual.tipoConexao, "pix_direto");
  assert.deepEqual(definicaoPixManual.capacidades, {
    pix: true,
    cartao: false,
    boleto: false,
    estorno: false,
    estornoParcial: false,
    webhook: false,
    confirmacaoAutomatica: false,
  });
  assert.deepEqual(definicaoPixManual.campos.map((c) => c.chave), ["chavePix", "nomeRecebedor"]);
  assert.equal(definicaoPixManual.campos.every((c) => c.segredo === false), true);
});

test("testar conexão só confere a chave e o nome, em português", async () => {
  const vazio = await definicaoPixManual.testarConexao({ segredos: {}, publicos: {} });
  assert.equal(vazio.ok, false);
  assert.match(vazio.ok ? "" : vazio.mensagem, /chave Pix/i);

  const nome = await definicaoPixManual.testarConexao({ segredos: {}, publicos: { chavePix: CHAVE } });
  assert.equal(nome.ok, false);
  assert.match(nome.ok ? "" : nome.mensagem, /nome de quem recebe/);

  const ok = await definicaoPixManual.testarConexao({ segredos: {}, publicos: { chavePix: " Loja@Exemplo.com ", nomeRecebedor: NOME } });
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.conta, NOME);
  assert.ok(ok.avisos.some((a) => /confirmação automática/i.test(a)));
});

test("cobrança nasce aguardando confirmação, com a referência no txid e sem dado de quem paga", async () => {
  const p = new PixManualProvider({
    chave: CHAVE,
    nomeRecebedor: NOME,
    cidade: "BRASILIA",
    expiraEmMinutos: 60,
    porta: porta(),
    gerarQr: async () => "QUFB",
  });
  const r = await p.cobrar(pedido(), 1000);
  assert.equal(r.status, "aguardando_confirmacao");
  assert.equal(r.valor, 1000);
  assert.equal(r.pix?.qrCodeBase64, "QUFB");
  const esperado = montarBrCodePix({ chave: CHAVE, nome: NOME, cidade: "BRASILIA", valorCentavos: 1000, txid: "PEDIDO1234567890AB" });
  assert.equal(r.pix?.copiaECola, esperado);
  const payload = r.pix?.copiaECola ?? "";
  assert.equal(payload.includes("maria@example.test"), false);
  assert.equal(payload.includes("52998224725"), false);
  assert.equal(payload.includes("Maria"), false);
  assert.equal(payload.includes("11999999999"), false);

  const deNovo = await p.cobrar(pedido(), 1000);
  assert.equal(deNovo.pix?.copiaECola, payload);
});

test("dois pedidos do mesmo valor ficam com centavos diferentes", async () => {
  const estado = porta();
  const p = new PixManualProvider({ chave: CHAVE, nomeRecebedor: NOME, cidade: "BRASILIA", expiraEmMinutos: 60, porta: estado });
  const a = await p.cobrar(pedido("PEDIDOA1234567890"), 2500);
  const b = await p.cobrar(pedido("PEDIDOB1234567890"), 2500);
  assert.equal(a.valor, 2500);
  assert.equal(b.valor, 2501);
  assert.notEqual(a.pix?.copiaECola, b.pix?.copiaECola);
});

test("webhook não confirma nada e estorno explica que é na mão", async () => {
  const p = new PixManualProvider({ chave: CHAVE, nomeRecebedor: NOME, cidade: "BRASILIA", expiraEmMinutos: 60, porta: porta() });
  assert.equal(await p.validarWebhook({ corpoBruto: '{"status":"aprovado"}', cabecalhos: { "x-signature": "qualquer" } }), null);
  await assert.rejects(() => p.estornar("pix-1"), (erro: unknown) => {
    assert.ok(erro instanceof CobrancaRecusada);
    assert.match(erro.message, /estorno automático/);
    return true;
  });
  await assert.rejects(() => p.cobrar({ ...pedido(), meioPagamento: "cartao", cartao: { token: "t", parcelas: 1 } }, 1000), /só aceita Pix/);
});

test("criar pela definição exige chave, nome e o registro da loja", () => {
  const base = { segredos: {}, publicos: { chavePix: CHAVE, nomeRecebedor: NOME, cidade: "SAO PAULO" }, pixManual: porta() };
  const p = definicaoPixManual.criar(base);
  assert.ok(p instanceof PixManualProvider);
  assert.throws(() => definicaoPixManual.criar({ ...base, pixManual: undefined }), /registro da loja/);
  assert.throws(() => definicaoPixManual.criar({ ...base, publicos: { nomeRecebedor: NOME } }), /chave Pix/i);
});
