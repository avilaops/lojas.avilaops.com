import { randomUUID } from "node:crypto";
import type { Prisma, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { urlDaLoja } from "./tenant";

/**
 * Eventos da plataforma → n8n.
 *
 * Toda automação comercial vive no n8n (regra da casa): boas-vindas, carrinho
 * abandonado, aviso de pedido pago no WhatsApp, reposição de estoque. A
 * plataforma só avisa o que aconteceu; o que fazer com isso é fluxo, não código.
 *
 * Contrato (versão 1): todo evento sai num envelope
 *   { eventId, versao, ocorridoEm, origem, tipo, slug, ...dados }
 * com os dados achatados ao lado do envelope (o n8n lê `$json.body.campo`).
 *
 * - `eventId` é único por emissão. O n8n reivindica o evento em
 *   `POST /api/admin/automacoes/eventos/reivindicar` antes de qualquer efeito
 *   externo: se a entrega se repetir (webhook é at-least-once), a segunda cai
 *   como duplicado e para ali. A tabela `AutomacaoEvento` fecha o ciclo:
 *   EMITIDO → PROCESSANDO → PROCESSADO | FALHOU | IGNORADO.
 * - Dinheiro é sempre inteiro em centavos (`*Centavos`). Formatar em reais é
 *   trabalho de apresentação, feito no fim do fluxo, nunca no contrato.
 * - Listas de itens vão como array (`itens`) e como texto pronto
 *   (`itensTexto`) — o texto é só conveniência para WhatsApp/e-mail.
 *
 * Falha no n8n nunca derruba a operação: o evento é logado e a vida segue.
 */

export const VERSAO_CONTRATO = 1;

/** Dados do lojista que acompanham todo evento de pedido: o n8n avisa sem precisar consultar a API. */
export interface Lojista {
  lojaNome: string;
  lojaUrl: string;
  lojistaWhatsapp?: string | null;
  lojistaEmail?: string | null;
  /**
   * Remetente das notificações da loja. Só vem preenchido quando o domínio e
   * o e-mail foram provisionados pela plataforma (`pedidos@<apex>`); caso
   * contrário é null e o n8n usa o remetente da plataforma com Reply-To do
   * lojista. Nunca vem de entrada do usuário.
   */
  emailRemetente?: string | null;
}

export interface ItemEvento {
  nome: string;
  quantidade: number;
  precoCentavos: number;
}

export type EventoPlataforma =
  | { tipo: "loja.criada"; slug: string; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  /** DNS e e-mail configurados sem erro. */
  | { tipo: "loja.provisionada"; slug: string; passos: Record<string, string>; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  /** Algum passo do provisionamento falhou; `passos` diz qual. */
  | { tipo: "loja.provisionamento-falhou"; slug: string; passos: Record<string, string>; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  /** Emitido uma única vez, na virada PROVISIONANDO → ATIVA. É o gatilho de tudo que conta prazo "desde que a loja está no ar". */
  | { tipo: "loja.ativada"; slug: string; nome: string; url: string; emailContato?: string | null; whatsapp?: string | null }
  | { tipo: "loja.identidade-atualizada"; slug: string; nome: string; url: string; personalidade: string; direcaoFotografica: string; emailContato?: string | null; whatsapp?: string | null }
  | { tipo: "categoria.seo-pendente"; slug: string; nome: string; categoriaId: string; categoriaSlug: string; categoriaNome: string; url: string }
  | { tipo: "categoria.seo-publicado"; slug: string; nome: string; categoriaId: string; categoriaSlug: string; categoriaNome: string; url: string; origem: string }
  | ({ tipo: "pedido.criado"; slug: string; referencia: string; numero?: number; totalCentavos: number; meioPagamento: string; clienteNome: string; clienteEmail: string; clienteTelefone: string } & Lojista)
  /**
   * `canal` diz de onde veio a venda ("loja" quando ausente). O fluxo do n8n
   * precisa dele: em pedido do Mercado Livre não há e-mail nem telefone do
   * comprador — falar com ele acontece dentro do ML —, e disparar a
   * confirmação de sempre contra campo vazio só produz automação falhada.
   */
  | ({ tipo: "pedido.pago"; slug: string; referencia: string; numero?: number; totalCentavos: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: ItemEvento[]; itensTexto: string; canal?: string } & Lojista)
  | ({ tipo: "pedido.recusado"; slug: string; referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; motivo?: string } & Lojista)
  | { tipo: "lojista.recuperar-senha"; slug: string; nome: string; email: string; link: string }
  | { tipo: "loja.suspensa"; slug: string; nome: string; motivo: string; link: string; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.reativada"; slug: string; nome: string; url: string; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.mensalidade-paga"; slug: string; nome: string; centavos: number; emailContato: string | null; whatsapp: string | null }
  | { tipo: "loja.mensalidade-recusada"; slug: string; nome: string; tentativas: number; diasRestantes: number; link: string; emailContato: string | null; whatsapp: string | null }
  | ({ tipo: "carrinho.abandonado"; slug: string; referencia: string; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: ItemEvento[]; itensTexto: string; totalCentavos: number; linkCarrinho: string } & Lojista)
  | { tipo: "avaliacao.recebida"; slug: string; nome: string; produtoNome: string; nota: number; autor: string; emailContato: string | null; whatsapp: string | null }
  | ({ tipo: "pedido.enviado"; slug: string; referencia: string; numero: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; transportadora: string; rastreio: string | null; linkPedido: string } & Lojista)
  | { tipo: "loja.voltou-ao-estoque"; slug: string; nome: string; url: string; emailRemetente: string | null; emailContato: string | null; destinatario: string; telefone: string | null; produtoNome: string; precoCentavos: number }
  | { tipo: "loja.relatorio-semanal"; slug: string; nome: string; url: string; emailContato: string | null; whatsapp: string | null; periodo: string; pedidosPagos: number; receitaCentavos: number; ticketMedioCentavos: number; topProdutos: string; carrinhosAbandonados: number; novasAvaliacoes: number }
  | ({ tipo: "pedido.em-separacao"; slug: string; referencia: string; numero: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; linkPedido: string } & Lojista)
  | ({ tipo: "pedido.entregue"; slug: string; referencia: string; numero: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; linkPedido: string } & Lojista)
  /**
   * Pergunta de comprador num canal externo (hoje só o Mercado Livre). O
   * prefixo é `canal.` e não `mercadolivre.` de propósito: esse outro prefixo
   * é da fila de **entrada**, gravada pelo webhook, e um evento de saída com
   * ele seria reprocessado como se fosse aviso do ML.
   *
   * Não leva contato de quem perguntou: o canal não entrega, e a conversa
   * acontece lá dentro. O que o lojista precisa é saber que existe e abrir o
   * painel — responder rápido é o que converte no Mercado Livre.
   */
  | ({ tipo: "canal.pergunta-recebida"; slug: string; canal: string; perguntaId: string; produtoNome: string; texto: string; linkPainel: string } & Lojista)
  | ({ tipo: "pedido.cancelado"; slug: string; referencia: string; numero: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; totalCentavos: number; motivo: string; linkPedido: string } & Lojista);

export type TipoEvento = EventoPlataforma["tipo"];

/**
 * O que amarra os eventos de uma mesma história. Pedido tem referência; o
 * resto é a loja. O n8n devolve o mesmo valor, e a tela do painel agrupa
 * por ele ("tudo o que aconteceu com o pedido 1042").
 */
function correlacaoDe(evento: EventoPlataforma): string {
  return "referencia" in evento && typeof evento.referencia === "string" ? `pedido:${evento.referencia}` : `loja:${evento.slug}`;
}

/** Depois disto, reenviar é decisão de gente, não de máquina. */
export const REENVIOS_MAXIMOS = 3;

/** "2x Retentor XPTO, 1x Rolamento ABC" — o texto que vai em WhatsApp e e-mail. */
/**
 * Os dados do lojista que acompanham todo evento de pedido. Vive aqui, junto
 * do contrato `Lojista`, porque agora tem mais de um emissor: o checkout
 * próprio e o canal do Mercado Livre.
 */
export function lojista(t: Tenant): Lojista {
  return { lojaNome: t.nome, lojaUrl: urlDaLoja(t), lojistaWhatsapp: t.whatsapp, lojistaEmail: t.loginEmail ?? t.emailContato, emailRemetente: t.emailRemetente };
}

export function itensParaTexto(itens: ItemEvento[]): string {
  return itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ");
}

export function novoEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "")}`;
}

export async function emitir(evento: EventoPlataforma): Promise<void> {
  const eventId = novoEventId();
  const correlationId = correlacaoDe(evento);
  const envelope = { eventId, versao: VERSAO_CONTRATO, ocorridoEm: new Date().toISOString(), origem: "lojas.avilaops.com", correlationId, ...evento };

  // Registrar antes de enviar, com o corpo inteiro: se o n8n nunca reivindicar,
  // fica EMITIDO e dá para achar o que se perdeu; se falhar, dá para reenviar
  // o mesmo corpo. Se o banco falhar aqui, o evento ainda sai: a reivindicação
  // cria a linha na hora.
  try {
    await prisma.automacaoEvento.create({
      data: { eventId, tipo: evento.tipo, slug: evento.slug, versao: VERSAO_CONTRATO, correlationId, payload: envelope as unknown as Prisma.InputJsonValue },
    });
  } catch (erro) {
    console.error("[eventos] não registrou", eventId, erro);
  }

  await entregar(envelope, eventId, evento.tipo);
}

async function entregar(envelope: Record<string, unknown>, eventId: string, tipo: string): Promise<boolean> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.N8N_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok;
  } catch (erro) {
    console.error("[eventos] n8n indisponível:", tipo, eventId, erro);
    return false;
  }
}

export type ResultadoReenvio =
  | { ok: true; eventId: string; novoEventId: string }
  | { ok: false; motivo: "nao-encontrado" | "sem-payload" | "nao-falhou" | "limite" | "outra-loja" | "ja-reenviado" };

/**
 * Reenvia um evento que FALHOU, com o mesmo corpo e um eventId novo.
 *
 * eventId novo porque o antigo já está gasto na trava de idempotência do n8n
 * (`reivindicar` recusa repetido). O corpo é o mesmo, então o efeito é o
 * mesmo: nada é inventado na hora do reenvio. A linha antiga fica como
 * histórico; a nova nasce EMITIDO e segue o ciclo normal.
 *
 * `slug` é o da sessão: um lojista só reenvia o que é da loja dele.
 *
 * Cada FALHOU só reabre uma vez: depois do reenvio a linha original vira
 * REENVIADO e sai da fila. Se o novo também falhar, é o novo que se reenvia.
 * Sem isto, apertar o botão três vezes mandava três avisos iguais ao
 * comprador (provado em 12/09/2026); o teto de tentativas conta a cadeia.
 */
export async function reenviar(eventId: string, slug: string): Promise<ResultadoReenvio> {
  const e = await prisma.automacaoEvento.findUnique({ where: { eventId } });
  if (!e) return { ok: false, motivo: "nao-encontrado" };
  if (e.slug !== slug) return { ok: false, motivo: "outra-loja" };
  if (e.status === "REENVIADO") return { ok: false, motivo: "ja-reenviado" };
  if (e.status !== "FALHOU") return { ok: false, motivo: "nao-falhou" };
  if (!e.payload || typeof e.payload !== "object") return { ok: false, motivo: "sem-payload" };
  if (e.tentativas >= REENVIOS_MAXIMOS) return { ok: false, motivo: "limite" };

  const novo = novoEventId();
  const envelope = { ...(e.payload as Record<string, unknown>), eventId: novo, ocorridoEm: new Date().toISOString(), reenvioDe: eventId };

  // A virada FALHOU → REENVIADO é condicional: dois cliques ao mesmo tempo só
  // passam um. O segundo vê count 0 e sai como "já reenviado".
  const reaberto = await prisma.automacaoEvento.updateMany({
    where: { eventId, status: "FALHOU" },
    data: { status: "REENVIADO", detalhe: `${e.detalhe ?? ""} · reenviado como ${novo}`.trim(), concluidoEm: new Date() },
  });
  if (reaberto.count === 0) return { ok: false, motivo: "ja-reenviado" };

  await prisma.automacaoEvento.create({
    data: { eventId: novo, tipo: e.tipo, slug: e.slug, versao: e.versao, correlationId: e.correlationId, payload: envelope as unknown as Prisma.InputJsonValue, tentativas: e.tentativas + 1 },
  });
  await entregar(envelope, novo, e.tipo);
  return { ok: true, eventId, novoEventId: novo };
}
