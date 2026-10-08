import { createHash, randomBytes } from "node:crypto";
import type { ChaveApi, Tenant } from "@prisma/client";
import { z } from "zod";
import { cupomRecusado, exigirTentativaDeCupom, registrarCupomRecusado } from "./api-cupom";
import { cobrancaDaVitrine } from "./api-recursos";
import { ErroApi } from "./api-resposta";
import { CorpoDoCheckout, CUPOM_INVALIDO, criarCobranca } from "./checkout-cobranca";
import { prisma } from "./db";
import { GatewayNaoConfigurado, providerDaLoja } from "./gateway";
import { lojaVende, urlDaLoja } from "./tenant";

/**
 * A compra pela API para desenvolvedores: o site ou o app do lojista fecha o
 * pedido com a chave publicável.
 *
 * Quem cobra é `criarCobranca`, a mesma função do checkout da vitrine; este
 * arquivo só cuida do que muda quando a porta é uma chave que qualquer
 * visitante vê:
 *
 * - **A referência nasce aqui**, com 128 bits. Ela é o segredo da página do
 *   pedido e a chave de idempotência no gateway; um front de terceiro não
 *   garante que a que ele inventasse tivesse entropia.
 * - **Cupom que não vale recusa a compra**, com uma resposta só e contando no
 *   limite de erros de `api-cupom.ts`: o checkout seria o mesmo oráculo da
 *   rota de cupom, só mais caro.
 * - **Sem preço.** Como em toda rota que cobra, o corpo diz o que comprar, não
 *   quanto custa.
 *
 * Ver docs/API.md, "Compra pela chave publicável".
 */

/** O corpo da compra. Campo desconhecido é erro: `preco` ignorado em silêncio é o front achando que mandou o preço. */
export const CorpoDaCompra = CorpoDoCheckout.pick({ entrega: true, freteId: true, meioPagamento: true, cartao: true, cupom: true })
  .extend({
    // Estritos também por dentro: `precoUnitario` dentro de um item é o mesmo
    // engano de `preco` na raiz.
    itens: z.array(CorpoDoCheckout.shape.itens.element.strict()).min(1).max(50),
    cliente: CorpoDoCheckout.shape.cliente.strict(),
    totalCentavos: CorpoDoCheckout.shape.totalExibido,
  })
  .strict();

const CHAVE_DE_IDEMPOTENCIA = /^[\w.:-]{16,120}$/;

/**
 * A referência do pedido.
 *
 * Com `Idempotency-Key`, sai da chave do cliente (e da chave da API, para duas
 * lojas com o mesmo valor não colidirem): repetir a requisição dá a mesma
 * referência, e a trava de tentativa única do estoque faz o resto. Sem ela, é
 * sorteada.
 */
export function referenciaDaCompra(chaveId: string, idempotencia: string | null): string {
  if (!idempotencia) return `api-${randomBytes(16).toString("hex")}`;
  return `api-${createHash("sha256").update(JSON.stringify([chaveId, idempotencia])).digest("hex").slice(0, 32)}`;
}

export function lerIdempotencia(request: Request): string | null {
  const valor = request.headers.get("idempotency-key")?.trim();
  if (!valor) return null;
  if (!CHAVE_DE_IDEMPOTENCIA.test(valor)) {
    throw new ErroApi("parametro_invalido", "`Idempotency-Key`: de 16 a 120 caracteres, só letras, números, ponto, dois-pontos, hífen e sublinhado.");
  }
  return valor;
}

export async function comprarPelaApi(tenant: Tenant, chave: Pick<ChaveApi, "id">, request: Request, bruto: unknown) {
  // A chave autentica com a loja suspensa (a vitrine continua no ar); vender, não.
  if (!lojaVende(tenant)) throw new ErroApi("loja_nao_vende", "Esta loja não está recebendo pedidos no momento.");
  let provider;
  try {
    provider = providerDaLoja(tenant);
  } catch (erro) {
    if (erro instanceof GatewayNaoConfigurado) throw new ErroApi("loja_nao_vende", "A loja ainda não configurou o recebimento.");
    throw erro;
  }

  const lido = CorpoDaCompra.safeParse(bruto);
  if (!lido.success) {
    const problema = lido.error.issues[0];
    const campo = problema?.path.join(".");
    throw new ErroApi("parametro_invalido", campo ? `\`${campo}\`: ${problema.message}` : (problema?.message ?? "Corpo inválido."));
  }
  const { totalCentavos, ...corpo } = lido.data;

  const idempotencia = lerIdempotencia(request);
  const referencia = referenciaDaCompra(chave.id, idempotencia);
  const url = urlDaLoja(tenant);

  if (idempotencia) {
    // Repetição de uma compra já feita: devolve a mesma cobrança, consultada de
    // novo no gateway para o Pix copia e cola voltar junto. Nada é cobrado.
    const feito = await prisma.pedido.findFirst({ where: { tenantId: tenant.id, referencia }, select: { pagamentoId: true } });
    if (feito?.pagamentoId) {
      return { ...cobrancaDaVitrine(referencia, await provider.consultar(feito.pagamentoId), url), repetida: true };
    }
    if (await prisma.tentativaCatalogo.findFirst({ where: { tenantId: tenant.id, referencia }, select: { id: true } })) {
      throw new ErroApi("pagamento_a_confirmar", "Esta compra já foi recebida e o pagamento está sendo confirmado. Consulte o pedido.", {}, referencia);
    }
  }

  if (corpo.cupom) exigirTentativaDeCupom(chave.id, request);

  const r = await criarCobranca(tenant, { ...corpo, referencia, ...(totalCentavos != null ? { totalExibido: totalCentavos } : {}) }, { provider, cupomEstrito: true });
  switch (r.tipo) {
    case "ok":
      // De onde veio: o painel e o suporte precisam saber qual integração criou.
      await prisma.pedido.updateMany({ where: { tenantId: tenant.id, referencia }, data: { origem: `api:${chave.id}` } }).catch(() => {});
      return { ...cobrancaDaVitrine(referencia, r.pagamento, url), repetida: false };
    case "invalido":
      if (r.codigo === CUPOM_INVALIDO) {
        registrarCupomRecusado(chave.id, request);
        throw cupomRecusado();
      }
      throw new ErroApi(r.status === 409 ? "conflito" : "pedido_invalido", r.mensagem, {}, r.codigo);
    case "recusado":
      throw new ErroApi("gateway_recusou", "Não foi possível processar o pagamento. Nada foi cobrado.");
    case "incerto":
      throw new ErroApi("pagamento_a_confirmar", "Estamos confirmando o pagamento. Consulte o pedido antes de tentar de novo.", {}, r.referencia);
  }
}
