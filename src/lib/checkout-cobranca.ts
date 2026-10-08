import { z } from "zod";
import type { Tenant } from "@prisma/client";
import { FRETE_RETIRADA_ID, type ResultadoPagamento } from "@avilaops/checkout";
import {
  CobrancaRecusada,
  montarPedidoSeguro,
  PedidoInvalidoError,
  type PayloadCheckout,
  type PaymentProvider,
  type ResolucaoCatalogo,
} from "@avilaops/checkout/server";
import { resolverItensDoCatalogo } from "./catalogo";
import { ErroCatalogo } from "./catalogo-oferta";
import { liberarReservas, reservarEstoque } from "./catalogo-reservas";
import { buscarCupomValido, descontoDoCupom, normalizarCodigo } from "./cupons";
import { prisma } from "./db";
import { cotarFrete } from "./frete";
import { registrarPedido } from "./pedidos";

/**
 * A cobrança de um pedido, do corpo que chegou até o pagamento criado.
 *
 * Uma função só para as duas portas que vendem: o checkout da vitrine
 * (`/api/checkout`, loja pelo host) e a API para desenvolvedores
 * (`/api/v1/vitrine/checkout`, loja pela chave). Morava inteira dentro do
 * manipulador da rota, com o gateway criado ali mesmo, e por isso nunca teve
 * teste: aqui o `PaymentProvider` vem por parâmetro.
 *
 * A ordem é a que protege dinheiro e estoque:
 *   validar → montar pelo catálogo → reservar → cobrar → registrar.
 * O preço sai de `montarPedidoSeguro` com `resolverItensDoCatalogo`, nunca do
 * corpo. Ver docs/ISOLAMENTO-OPERACIONAL.md.
 */

const MEIOS = ["pix", "cartao", "boleto"] as const;
/** O mesmo teto do formulário de cartão (`MercadoPagoCardBrick`, `opcoesDeParcelamento`). */
export const PARCELAS_MAXIMAS = 12;
/** Carrinho maior que isto não é compra, é laço: cada item vira consulta e trava de estoque. */
const ITENS_MAXIMOS = 50;
const QUANTIDADE_MAXIMA = 999;

const texto = (max: number) => z.string().trim().min(1).max(max);
const opcional = (max: number) => z.string().trim().max(max).optional();

const Cartao = z.object({
  token: texto(200),
  parcelas: z.number().int().min(1).max(PARCELAS_MAXIMAS).optional(),
  bandeira: opcional(40),
});

/**
 * O corpo do checkout.
 *
 * O cartão é aceito nos dois formatos: aninhado em `cartao`, que é como a tela
 * manda, e solto na raiz (`cartaoToken`), que é como `PayloadCheckout` lê. A
 * rota passava o corpo adiante sem converter, e todo pagamento com cartão caía
 * em "cartão sem token".
 *
 * `entrega` aceita campo vazio aqui: quem retira na loja manda `null`, e quem
 * exige endereço completo é `criarCobranca`, que sabe qual frete foi escolhido.
 */
export const CorpoDoCheckout = z.object({
  referencia: z.string().trim().min(16, "referência curta demais").max(120),
  itens: z.array(z.object({ id: texto(80), quantidade: z.number().int().min(1).max(QUANTIDADE_MAXIMA) })).min(1).max(ITENS_MAXIMOS),
  cupom: opcional(40),
  cliente: z.object({ nome: texto(80), sobrenome: texto(80), email: texto(160), telefone: texto(30), documento: texto(30) }),
  entrega: z
    .object({
      cep: z.string().trim().max(12),
      logradouro: z.string().trim().max(160),
      numero: z.string().trim().max(20),
      complemento: opcional(80),
      bairro: z.string().trim().max(80),
      cidade: z.string().trim().max(80),
      uf: z.string().trim().max(2),
    })
    .nullable()
    .optional(),
  freteId: texto(80),
  meioPagamento: z.enum(MEIOS),
  cartao: Cartao.optional(),
  cartaoToken: opcional(200),
  parcelas: z.number().int().min(1).max(PARCELAS_MAXIMAS).optional(),
  bandeira: opcional(40),
  totalExibido: z.number().int().min(0).optional(),
});

export type CorpoValidado = z.infer<typeof CorpoDoCheckout>;

/** O corpo no formato que o pacote de checkout lê, com o cartão no lugar certo. */
export function paraPayload(c: CorpoValidado): PayloadCheckout {
  const token = c.cartao?.token ?? c.cartaoToken;
  return {
    referencia: c.referencia,
    itens: c.itens,
    cliente: c.cliente,
    entrega: c.entrega ?? null,
    freteId: c.freteId,
    meioPagamento: c.meioPagamento,
    ...(token ? { cartaoToken: token, parcelas: c.cartao?.parcelas ?? c.parcelas ?? 1 } : {}),
    ...(c.cartao?.bandeira ?? c.bandeira ? { bandeira: c.cartao?.bandeira ?? c.bandeira } : {}),
    ...(c.totalExibido != null ? { totalExibido: c.totalExibido } : {}),
  };
}

export type ResultadoDaCobranca =
  | { tipo: "ok"; referencia: string; pagamento: ResultadoPagamento }
  /** O pedido não pode ser feito como veio. Nada foi reservado nem cobrado. */
  | { tipo: "invalido"; status: number; codigo: string; mensagem: string }
  /** O gateway respondeu que não. Nada foi cobrado, e a reserva foi solta. */
  | { tipo: "recusado"; referencia: string }
  /** Não se sabe se a cobrança nasceu. A reserva fica; a rotina `reservas.reconciliar` resolve. */
  | { tipo: "incerto"; referencia: string };

export interface OpcoesDaCobranca {
  provider: PaymentProvider;
  compradorId?: string | null;
}

/** Lê o corpo cru. `null` no lugar do corpo dá o mesmo erro de corpo inválido. */
export function lerCorpoDoCheckout(bruto: unknown): { corpo: CorpoValidado } | { tipo: "invalido"; status: 422; codigo: "corpo_invalido"; mensagem: string } {
  const lido = CorpoDoCheckout.safeParse(bruto);
  if (lido.success) return { corpo: lido.data };
  const problema = lido.error.issues[0];
  const campo = problema?.path.join(".");
  return { tipo: "invalido", status: 422, codigo: "corpo_invalido", mensagem: campo ? `Confira o campo ${campo}.` : "Dados do pedido inválidos." };
}

export async function criarCobranca(t: Tenant, corpo: CorpoValidado, opcoes: OpcoesDaCobranca): Promise<ResultadoDaCobranca> {
  // Antes de qualquer consulta ou reserva: o meio pedido é um que a loja aceita?
  // A tela já escondia os outros, mas o servidor aceitava qualquer coisa, e um
  // valor inválido reservava estoque para falhar só dentro do gateway.
  if (!t.meiosPagamento.includes(corpo.meioPagamento)) {
    return { tipo: "invalido", status: 422, codigo: "meio_indisponivel", mensagem: "Esta loja não aceita este meio de pagamento." };
  }
  const e = corpo.entrega;
  if (corpo.freteId !== FRETE_RETIRADA_ID && (!e || !e.cep || !e.logradouro || !e.numero || !e.cidade || e.uf.length !== 2)) {
    return { tipo: "invalido", status: 422, codigo: "endereco_obrigatorio", mensagem: "Informe o endereço de entrega completo." };
  }

  // O cupom é resolvido uma vez por pedido: frete grátis e desconto leem o mesmo.
  const codigoCupom = corpo.cupom ? normalizarCodigo(corpo.cupom) : null;
  let cupomResolvido: Awaited<ReturnType<typeof buscarCupomValido>> | null = null;
  async function cupom(itens: Parameters<typeof descontoDoCupom>[1]) {
    if (!codigoCupom) return null;
    if (!cupomResolvido) {
      const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
      cupomResolvido = await buscarCupomValido(t.id, codigoCupom, subtotal);
    }
    return "cupom" in cupomResolvido ? cupomResolvido.cupom : null;
  }

  const catalogo: ResolucaoCatalogo = {
    resolverItens: (ids) => resolverItensDoCatalogo(t.id, ids),
    // Pedido mínimo é dado da loja; quem recusa é o montarPedidoSeguro.
    pedidoMinimo: t.pedidoMinimoCentavos,
    resolverFretes: async ({ itens, cep }) => cotarFrete(t, cep, itens, { freteGratisCupom: (await cupom(itens))?.tipo === "FRETE_GRATIS" }),
    resolverDesconto: async ({ itens }) => {
      const c = await cupom(itens);
      return c ? descontoDoCupom(c, itens) : 0;
    },
  };

  const payload = paraPayload(corpo);
  const referencia = payload.referencia;

  // 1. Montar e reservar. Falha aqui é do pedido: nada foi cobrado, e a reserva
  // é uma transação só, que não deixa metade para trás.
  let montado: Awaited<ReturnType<typeof montarPedidoSeguro>>;
  try {
    montado = await montarPedidoSeguro(payload, catalogo);
    await reservarEstoque(t.id, referencia, montado.pedido.itens);
  } catch (erro) {
    if (erro instanceof PedidoInvalidoError) return { tipo: "invalido", status: 422, codigo: erro.codigo, mensagem: erro.message };
    if (erro instanceof ErroCatalogo) return { tipo: "invalido", status: erro.status, codigo: "catalogo", mensagem: erro.message };
    throw erro;
  }

  // 2. Cobrar. Daqui em diante, o que falha pode ter deixado cobrança criada.
  let pagamento: ResultadoPagamento;
  try {
    pagamento = await opcoes.provider.cobrar(montado.pedido, montado.total);
  } catch (erro) {
    if (erro instanceof CobrancaRecusada) {
      // O gateway respondeu que não: é conclusivo, e o estoque volta à vitrine.
      console.error("[checkout] gateway recusou", referencia, erro.message);
      await liberarReservas(t.id, referencia);
      return { tipo: "recusado", referencia };
    }
    // Tempo-limite ou conexão caída não dizem se a cobrança nasceu. Não liberar
    // estoque nem prometer que nada foi cobrado.
    await marcarIncerta(t.id, referencia);
    console.error("[checkout] cobrança a reconciliar", referencia, erro);
    return { tipo: "incerto", referencia };
  }

  // 3. Registrar. A cobrança existe; se isto falhar, o id dela já ficou na
  // tentativa e a rotina de reconciliação acha o pagamento sem pedido.
  try {
    await prisma.tentativaCatalogo.update({ where: { tenantId_referencia: { tenantId: t.id, referencia } }, data: { estado: "COBRANCA_CRIADA", pagamentoId: pagamento.id } });
    const c = await cupom([]);
    await registrarPedido(t, {
      referencia, pagamentoId: pagamento.id, status: pagamento.status, total: montado.total, payload, catalogo,
      pedidoResolvido: montado.pedido, cupomCodigo: c?.codigo, compradorId: opcoes.compradorId ?? null,
    });
  } catch (erro) {
    await marcarIncerta(t.id, referencia);
    console.error("[checkout] cobrança criada e pedido não registrado", referencia, erro);
    return { tipo: "incerto", referencia };
  }

  return { tipo: "ok", referencia, pagamento };
}

async function marcarIncerta(tenantId: string, referencia: string) {
  await prisma.tentativaCatalogo
    .updateMany({ where: { tenantId, referencia, estado: { notIn: ["CONFIRMADA", "LIBERADA"] } }, data: { estado: "INCERTA" } })
    .catch((erro) => console.error("[checkout] não marcou a tentativa como incerta", referencia, erro));
}
