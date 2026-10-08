import { randomUUID } from "node:crypto";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl } from "./mercadolivre";
import { baixarEstoqueDoPedido } from "./estoque";
import { emitir, itensParaTexto, lojista } from "./eventos";
import type { PedidoStatus } from "@prisma/client";

/**
 * Venda no Mercado Livre vira pedido da loja.
 *
 * Até aqui o ML era via de mão única: a plataforma publicava anúncio e
 * empurrava preço e estoque. O que voltava — a venda — não chegava a lugar
 * nenhum. Na prática a mesma peça podia ser vendida duas vezes, porque a loja
 * só descobria o estoque a menos na próxima sincronização, e o faturamento do
 * canal não aparecia em relatório nenhum.
 *
 * O pedido do ML entra pela mesma porta dos outros: `Pedido` com
 * `canal = "mercadolivre"`, itens casados com o catálogo pelo `mlbId` do
 * anúncio, e a baixa de estoque pelo mesmo caminho do checkout
 * (`baixarEstoqueDoPedido`), que já sabe abater sem reserva prévia.
 *
 * O que **não** se inventa aqui: e-mail, telefone e documento do comprador. O
 * ML deixou de entregar dado pessoal do comprador na ordem (e o que entrega é
 * apelido e, às vezes, um e-mail de proxy). Campo sem dado fica vazio, e o
 * evento sai com `canal` para o n8n não tentar falar com quem comprou no ML
 * por fora do ML — conversa com esse comprador acontece lá dentro.
 *
 * O que também não se inventa: a referência. Ela é a chave da página pública
 * do pedido, então é sorteada, nunca derivada do id da ordem no ML.
 */

/** O recorte de `GET /orders/{id}` que a plataforma usa. */
export interface OrdemMl {
  id: number | string;
  status?: string;
  status_detail?: string | null;
  date_created?: string;
  currency_id?: string;
  total_amount?: number;
  paid_amount?: number;
  order_items?: Array<{
    item?: {
      id?: string;
      title?: string;
      seller_sku?: string | null;
      seller_custom_field?: string | null;
      variation_id?: number | string | null;
      /** O que o comprador escolheu: [{ name: "Cor", value_name: "Azul" }]. */
      variation_attributes?: Array<{ id?: string; name?: string; value_name?: string | null }> | null;
    };
    quantity?: number;
    unit_price?: number;
  }>;
  payments?: Array<{ id?: number | string; status?: string; payment_type?: string; shipping_cost?: number; transaction_amount?: number }>;
  shipping?: { id?: number | string | null };
  buyer?: { id?: number | string; nickname?: string; first_name?: string; last_name?: string; email?: string | null };
  cancel_detail?: { description?: string } | null;
}

export type StatusPedido = "AGUARDANDO_PAGAMENTO" | "PAGO" | "CANCELADO";

export interface ItemMapeado {
  mlbId: string;
  produtoId: string | null;
  /**
   * A apresentação que realmente saiu do estoque.
   *
   * Nulo em produto sem variação — e nulo também quando o anúncio vendeu uma
   * variação que não conseguimos reconhecer, que é caso de parar, não de
   * chutar: ver `resolverVariante`.
   */
  varianteId: string | null;
  varianteNome: string | null;
  nome: string;
  sku: string | null;
  quantidade: number;
  precoUnitarioCentavos: number;
}

/** O que a loja sabe do produto casado com o anúncio. */
export interface ProdutoCasado {
  produtoId: string;
  sku: string | null;
  variantes: Array<{
    id: string;
    nome: string;
    sku: string | null;
    padrao: boolean;
    /** { "Tamanho": "P", "Cor": "Azul" } — ver Variante.valores. */
    valores: Record<string, string>;
  }>;
}

export interface PedidoMlMapeado {
  canalPedidoId: string;
  status: StatusPedido;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  clienteDocumento: string;
  freteNome: string;
  freteCentavos: number;
  subtotalCentavos: number;
  totalCentavos: number;
  meioPagamento: string;
  pagamentoId: string | null;
  pagamentoStatus: string | null;
  itens: ItemMapeado[];
  /** O que o lojista precisa saber e o código não resolve sozinho. */
  avisos: string[];
}

/** Reais do ML → centavos inteiros, a moeda da casa (AGENTS.md). */
function centavos(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Status do ML → status do pedido.
 *
 * `paid` é o único que baixa estoque. `confirmed` e `payment_in_process` ainda
 * podem não virar venda, e tratá-los como pagos tiraria do ar um item que
 * continua disponível.
 */
/** Quanto o pedido já andou. O que não está aqui (cancelado, estornado) é fim de linha. */
const ANDAMENTO: Partial<Record<PedidoStatus, number>> = { AGUARDANDO_PAGAMENTO: 0, PAGO: 1, EM_SEPARACAO: 2, ENVIADO: 3, ENTREGUE: 4 };

/**
 * O status que fica quando chega um aviso do canal para um pedido que já existe.
 *
 * O aviso só sabe o que o canal sabe: pago ou cancelado. O que a loja fez
 * depois (separou, enviou) é nosso, e o aviso não desfaz. Cancelamento no canal
 * vale sempre; pedido já encerrado aqui não ressuscita.
 */
export function statusDepoisDoAviso(atual: PedidoStatus, doAviso: PedidoStatus): PedidoStatus {
  const a = ANDAMENTO[atual];
  const n = ANDAMENTO[doAviso];
  if (a === undefined) return atual;
  if (n === undefined) return doAviso;
  return n > a ? doAviso : atual;
}

export function statusDoPedidoMl(status: string | undefined): StatusPedido {
  if (status === "paid") return "PAGO";
  if (status === "cancelled" || status === "invalid") return "CANCELADO";
  return "AGUARDANDO_PAGAMENTO";
}

/** Forma de pagamento do ML no vocabulário da casa; o que não se reconhece vai cru. */
export function meioDePagamentoMl(tipo: string | undefined): string {
  if (!tipo) return "mercadolivre";
  if (tipo === "credit_card" || tipo === "debit_card") return "cartao";
  if (tipo === "ticket") return "boleto";
  if (tipo === "pix" || tipo === "bank_transfer") return "pix";
  if (tipo === "account_money") return "saldo-ml";
  return tipo;
}

/** Para comparar rótulo e valor sem depender de acento, caixa ou espaço. */
function chave(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Resultado da tentativa de descobrir QUAL apresentação foi vendida. */
export interface VarianteResolvida {
  varianteId: string | null;
  varianteNome: string | null;
  /** Como se chegou nela — vai para o aviso do pedido quando não é óbvio. */
  por: "sku" | "atributos" | "unica" | "nao-identificada" | "sem-produto";
}

/**
 * Qual variante do catálogo o Mercado Livre vendeu.
 *
 * É a peça que faltava para o canal não estragar estoque. O ML manda
 * `variation_id`, que é um número do catálogo **dele** e não diz nada sobre o
 * nosso; até aqui o pedido nascia sem variante e quem baixava o estoque caía
 * na apresentação **padrão** do produto (ver `confirmarEstoqueDoPedido`).
 * Numa loja de camiseta, vender o G tirava o P do estoque: o P some enquanto
 * está na prateleira, o G continua à venda depois de acabar, e a segunda venda
 * do G vira cancelamento — que no Mercado Livre custa reputação.
 *
 * A escada tem três degraus reais e um fim honesto, nesta ordem:
 *
 * 1. **SKU.** `Variante.sku` é único por loja, então bate é bate. É também o
 *    degrau que funciona em anúncio criado à mão no próprio ML, que é como a
 *    maioria das variações existe hoje.
 * 2. **Atributos.** O ML manda o que o comprador escolheu
 *    (`variation_attributes`), e `Variante.valores` guarda exatamente isso.
 *    Compara sem acento nem caixa, e só aceita quando **uma** variante casa em
 *    todos os atributos — duas casando é ambiguidade, não resposta.
 * 3. **Variante única.** Produto simples tem uma só: não há o que escolher.
 * 4. **Não identificada.** Devolve nulo, de propósito. Chutar a padrão é o bug
 *    que esta função existe para matar, e errar aqui corrompe **duas**
 *    apresentações de uma vez — a que saiu a mais e a que saiu a menos.
 */
export function resolverVariante(
  linha: { seller_sku?: string | null; seller_custom_field?: string | null; variation_attributes?: Array<{ name?: string; value_name?: string | null }> | null },
  produto: ProdutoCasado | undefined,
): VarianteResolvida {
  if (!produto) return { varianteId: null, varianteNome: null, por: "sem-produto" };
  const variantes = produto.variantes;
  if (!variantes.length) return { varianteId: null, varianteNome: null, por: "nao-identificada" };

  const achada = (v: ProdutoCasado["variantes"][number], por: VarianteResolvida["por"]): VarianteResolvida =>
    ({ varianteId: v.id, varianteNome: v.nome, por });

  // 1. SKU da linha (o do ML vem da variação, quando é variação).
  const skuDaLinha = (linha.seller_sku ?? linha.seller_custom_field ?? "").trim();
  if (skuDaLinha) {
    const porSku = variantes.filter((v) => v.sku && chave(v.sku) === chave(skuDaLinha));
    if (porSku.length === 1) return achada(porSku[0], "sku");
  }

  // 2. Atributos escolhidos pelo comprador.
  const escolhidos = (linha.variation_attributes ?? []).filter((a) => a.name && a.value_name);
  if (escolhidos.length) {
    const casam = variantes.filter((v) =>
      escolhidos.every((a) => {
        const nosso = Object.entries(v.valores).find(([rotulo]) => chave(rotulo) === chave(a.name!));
        return nosso ? chave(String(nosso[1])) === chave(String(a.value_name)) : false;
      }),
    );
    if (casam.length === 1) return achada(casam[0], "atributos");
  }

  // 3. Produto de uma apresentação só.
  if (variantes.length === 1) return achada(variantes[0], "unica");

  return { varianteId: null, varianteNome: null, por: "nao-identificada" };
}

/**
 * Traduz a ordem do ML para o pedido da loja.
 *
 * Função pura: recebe a ordem e um casamento de MLB → produto, e não toca em
 * rede nem banco. É onde mora a aritmética de dinheiro, que é o que não pode
 * errar.
 */
export function mapearPedidoMl(
  ordem: OrdemMl,
  casar: (mlbId: string) => ProdutoCasado | undefined,
): PedidoMlMapeado {
  const avisos: string[] = [];
  const itens: ItemMapeado[] = [];

  for (const linha of ordem.order_items ?? []) {
    const mlbId = String(linha.item?.id ?? "").trim();
    const quantidade = Math.trunc(Number(linha.quantity ?? 0));
    if (!mlbId || quantidade < 1) {
      avisos.push("A ordem trouxe uma linha sem anúncio ou sem quantidade; ela ficou de fora do pedido.");
      continue;
    }
    const casado = casar(mlbId);
    if (!casado) {
      avisos.push(`O anúncio ${mlbId} não está ligado a nenhum produto desta loja: o item entrou no pedido sem baixar estoque.`);
    }
    const variante = resolverVariante(linha.item ?? {}, casado);
    if (casado && variante.por === "nao-identificada") {
      // Aviso específico, e não "confira qual apresentação sair": o lojista
      // precisa saber o que fazer para isto não se repetir na próxima venda.
      avisos.push(
        `O anúncio ${mlbId} vendeu uma variação que não bate com nenhuma apresentação cadastrada. ` +
          `O estoque NÃO foi baixado — tirar da apresentação errada estragaria duas de uma vez. ` +
          `Informe o SKU da variação no anúncio do Mercado Livre, igual ao SKU da variante na loja, e o próximo pedido se resolve sozinho.`,
      );
    }
    itens.push({
      mlbId,
      produtoId: casado?.produtoId ?? null,
      varianteId: variante.varianteId,
      varianteNome: variante.varianteNome,
      nome: String(linha.item?.title ?? mlbId).slice(0, 200),
      sku: linha.item?.seller_sku ?? linha.item?.seller_custom_field ?? casado?.sku ?? null,
      quantidade,
      precoUnitarioCentavos: centavos(linha.unit_price),
    });
  }

  const pago = (ordem.payments ?? []).find((p) => p.status === "approved") ?? (ordem.payments ?? [])[0];
  const frete = centavos(pago?.shipping_cost ?? 0);
  const subtotal = itens.reduce((soma, i) => soma + i.precoUnitarioCentavos * i.quantidade, 0);
  // `total_amount` do ML é a soma dos itens, sem frete. O total da casa inclui
  // o frete, como em qualquer outro pedido — senão o relatório do canal fica
  // menor do que a venda foi.
  const total = centavos(ordem.total_amount ?? 0) + frete;
  if (total !== subtotal + frete) {
    avisos.push("A soma dos itens não bate com o total informado pelo Mercado Livre; confira antes de faturar.");
  }

  const comprador = ordem.buyer ?? {};
  const nome = [comprador.first_name, comprador.last_name].filter(Boolean).join(" ").trim();
  const status = statusDoPedidoMl(ordem.status);
  if (status === "CANCELADO" && ordem.cancel_detail?.description) {
    avisos.push(`Cancelado no Mercado Livre: ${ordem.cancel_detail.description}`);
  }

  return {
    canalPedidoId: String(ordem.id),
    status,
    clienteNome: nome || comprador.nickname || "Comprador do Mercado Livre",
    // Sem inventar: o ML não entrega mais contato do comprador na ordem.
    clienteEmail: comprador.email ?? "",
    clienteTelefone: "",
    clienteDocumento: "",
    freteNome: ordem.shipping?.id ? "Mercado Envios" : "Combinado no Mercado Livre",
    freteCentavos: frete,
    subtotalCentavos: subtotal,
    totalCentavos: total,
    meioPagamento: meioDePagamentoMl(pago?.payment_type),
    pagamentoId: pago?.id != null ? String(pago.id) : null,
    pagamentoStatus: pago?.status ?? null,
    itens,
    avisos,
  };
}

/**
 * Busca a ordem no ML e grava o pedido, uma vez só.
 *
 * A notificação do ML diz "a ordem X mudou", nunca o que mudou: por isso o
 * recurso é sempre relido da API antes de qualquer efeito.
 */
export async function registrarPedidoMl(loja: Tenant, ordemId: string) {
  const ordem = await chamarMl<OrdemMl>(loja, `/orders/${encodeURIComponent(ordemId)}`);
  const mlbIds = [...new Set((ordem.order_items ?? []).map((i) => String(i.item?.id ?? "")).filter(Boolean))];
  const anuncios = mlbIds.length
    ? await prisma.anuncioMercadoLivre.findMany({
        where: { tenantId: loja.id, mlbId: { in: mlbIds } },
        select: {
          mlbId: true,
          produtoId: true,
          produto: {
            select: {
              sku: true,
              // As variantes vêm junto porque é com elas que se descobre qual
              // apresentação o Mercado Livre vendeu. Sem isto o pedido nasce
              // sem variante e o estoque sai da padrão, seja qual for.
              variantes: {
                where: { ativo: true },
                select: { id: true, nome: true, sku: true, padrao: true, valores: true },
                orderBy: { ordem: "asc" },
              },
            },
          },
        },
      })
    : [];
  const porMlb = new Map<string, ProdutoCasado>(
    anuncios.map((a) => [
      a.mlbId!,
      {
        produtoId: a.produtoId,
        sku: a.produto.sku,
        variantes: a.produto.variantes.map((v) => ({
          id: v.id,
          nome: v.nome,
          sku: v.sku,
          padrao: v.padrao,
          valores: (v.valores ?? {}) as Record<string, string>,
        })),
      },
    ]),
  );
  const mapeado = mapearPedidoMl(ordem, (mlb) => porMlb.get(mlb));

  const existente = await prisma.pedido.findUnique({
    where: { tenantId_canal_canalPedidoId: { tenantId: loja.id, canal: "mercadolivre", canalPedidoId: mapeado.canalPedidoId } },
    select: { id: true, status: true, estoqueBaixado: true, numero: true, referencia: true },
  });

  const pedido = existente
    ? await prisma.pedido.update({
        where: { id: existente.id },
        // O ML manda `orders_v2` várias vezes na vida da ordem. Gravando o
        // status do aviso sem olhar o atual, o pedido que a loja já tinha
        // enviado voltava a "pago" a cada aviso.
        data: { status: statusDepoisDoAviso(existente.status, mapeado.status), pagamentoStatus: mapeado.pagamentoStatus, pagamentoId: mapeado.pagamentoId },
        select: { id: true, numero: true, referencia: true, estoqueBaixado: true },
      })
    : await prisma.pedido.create({
        data: {
          tenantId: loja.id,
          canal: "mercadolivre",
          canalPedidoId: mapeado.canalPedidoId,
          // `/pedido/[referencia]` mostra nome, e-mail, itens e rastreio sem
          // pedir sessão: a referência é o segredo que separa o comprador de
          // um estranho. O id do pedido no ML é um número sequencial que o
          // comprador conhece e que se enumera — ele fica em `canalPedidoId`,
          // que ninguém alcança pela web, e a referência nasce sorteada como
          // a do checkout próprio.
          referencia: randomUUID(),
          status: mapeado.status,
          clienteNome: mapeado.clienteNome,
          clienteEmail: mapeado.clienteEmail,
          clienteTelefone: mapeado.clienteTelefone,
          clienteDocumento: mapeado.clienteDocumento,
          freteNome: mapeado.freteNome,
          freteCentavos: mapeado.freteCentavos,
          subtotalCentavos: mapeado.subtotalCentavos,
          totalCentavos: mapeado.totalCentavos,
          meioPagamento: mapeado.meioPagamento,
          gateway: "mercadolivre",
          pagamentoId: mapeado.pagamentoId,
          pagamentoStatus: mapeado.pagamentoStatus,
          itens: {
            create: mapeado.itens.map((i) => ({
              produtoId: i.produtoId,
              varianteId: i.varianteId,
              varianteNome: i.varianteNome,
              nome: i.nome,
              sku: i.sku,
              quantidade: i.quantidade,
              precoUnitarioCentavos: i.precoUnitarioCentavos,
            })),
          },
        },
        select: { id: true, numero: true, referencia: true, estoqueBaixado: true },
      });

  // Estoque só sai quando o ML confirma o pagamento, e uma vez só: o próprio
  // `baixarEstoqueDoPedido` desiste quando já baixou.
  let estoqueBaixado = pedido.estoqueBaixado;
  if (mapeado.status === "PAGO" && !pedido.estoqueBaixado) {
    await baixarEstoqueDoPedido(pedido.id);
    estoqueBaixado = true;
    const itens = mapeado.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade, precoCentavos: i.precoUnitarioCentavos }));
    await emitir({
      tipo: "pedido.pago",
      slug: loja.slug,
      referencia: pedido.referencia,
      numero: pedido.numero,
      totalCentavos: mapeado.totalCentavos,
      clienteNome: mapeado.clienteNome,
      clienteEmail: mapeado.clienteEmail,
      clienteTelefone: mapeado.clienteTelefone,
      itens,
      itensTexto: itensParaTexto(itens),
      // Sem isto o n8n trataria a venda do ML como venda da loja e tentaria
      // enviar a confirmação para um e-mail que não existe.
      canal: "mercadolivre",
      ...lojista(loja),
    }, { chave: `pago:${pedido.referencia}` });
  }

  return { pedidoId: pedido.id, referencia: pedido.referencia, novo: !existente, status: mapeado.status, estoqueBaixado, avisos: mapeado.avisos };
}
