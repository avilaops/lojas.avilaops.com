import { randomUUID } from "node:crypto";
import { prisma } from "./db";

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
  | ({ tipo: "pedido.pago"; slug: string; referencia: string; numero?: number; totalCentavos: number; clienteNome: string; clienteEmail: string; clienteTelefone: string; itens: ItemEvento[]; itensTexto: string } & Lojista)
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
  | { tipo: "loja.relatorio-semanal"; slug: string; nome: string; url: string; emailContato: string | null; whatsapp: string | null; periodo: string; pedidosPagos: number; receitaCentavos: number; ticketMedioCentavos: number; topProdutos: string; carrinhosAbandonados: number; novasAvaliacoes: number };

export type TipoEvento = EventoPlataforma["tipo"];

/** "2x Retentor XPTO, 1x Rolamento ABC" — o texto que vai em WhatsApp e e-mail. */
export function itensParaTexto(itens: ItemEvento[]): string {
  return itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ");
}

export function novoEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "")}`;
}

export async function emitir(evento: EventoPlataforma): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  const eventId = novoEventId();
  const envelope = { eventId, versao: VERSAO_CONTRATO, ocorridoEm: new Date().toISOString(), origem: "lojas.avilaops.com", ...evento };

  // Registrar antes de enviar: se o n8n nunca reivindicar, fica EMITIDO e dá
  // para achar o que se perdeu. Se o banco falhar aqui, o evento ainda sai —
  // a reivindicação cria a linha na hora.
  try {
    await prisma.automacaoEvento.create({ data: { eventId, tipo: evento.tipo, slug: evento.slug, versao: VERSAO_CONTRATO } });
  } catch (erro) {
    console.error("[eventos] não registrou", eventId, erro);
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.N8N_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(5000),
    });
  } catch (erro) {
    console.error("[eventos] n8n indisponível:", evento.tipo, eventId, erro);
  }
}
