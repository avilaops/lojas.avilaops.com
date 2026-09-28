import { emailConfigurado, type EmailParaEnviar } from "./email";
import { emailDoEvento } from "./emails-do-evento";
import { whatsappConfigurado, type MensagemWhatsapp } from "./whatsapp";
import { whatsappDoEvento } from "./whatsapp-do-evento";

/**
 * O que cada evento faz, e por qual canal.
 *
 * Esta tabela é a única fonte da verdade sobre o que a plataforma executa por
 * conta própria. `emitir()` a consulta para decidir se o evento vai para o
 * webhook do n8n ou fica em casa, e o consumidor a consulta para saber quais
 * canais precisa cumprir antes de fechar o ciclo.
 *
 * **Um tipo só é nosso quando todos os canais dele estão configurados.** Sem
 * `WHATSAPP_TOKEN`, `pedido.pago` volta inteiro para o n8n — com e-mail e
 * WhatsApp —, porque executar metade faria o aviso do lojista sumir sem
 * ninguém notar.
 */
export type Canal = "email" | "whatsapp";

export const CANAIS_POR_TIPO = {
  // Só e-mail.
  "lojista.recuperar-senha": ["email"],
  "loja.voltou-ao-estoque": ["email"],
  "pedido.em-separacao": ["email"],
  "pedido.enviado": ["email"],
  "pedido.entregue": ["email"],
  "pedido.cancelado": ["email"],
  "loja.relatorio-semanal": ["email"],
  // E-mail ao comprador, WhatsApp a quem precisa agir.
  "pedido.pago": ["email", "whatsapp"],
  "pedido.recusado": ["email", "whatsapp"],
  "carrinho.abandonado": ["email", "whatsapp"],
  "loja.criada": ["email", "whatsapp"],
  "loja.provisionada": ["email", "whatsapp"],
  // Os dois que esperam: emitidos por rotina, não pelo checkout.
  "pedido.pix-pendente": ["email", "whatsapp"],
  "loja.indicacoes": ["email", "whatsapp"],
  // Não notificam ninguém: entram para encerrar o ciclo em casa, sem viagem.
  "categoria.seo-pendente": [],
  "categoria.seo-publicado": [],
} as const satisfies Record<string, readonly Canal[]>;

export type TipoExecutavel = keyof typeof CANAIS_POR_TIPO;

export const TIPOS_EXECUTAVEIS = Object.keys(CANAIS_POR_TIPO) as TipoExecutavel[];

export function ehTipoExecutavel(tipo: string): tipo is TipoExecutavel {
  return Object.prototype.hasOwnProperty.call(CANAIS_POR_TIPO, tipo);
}

/**
 * Os tipos que **este ambiente** consegue executar agora.
 *
 * Depende de configuração, não só de código: é o que faz esta mudança inteira
 * nascer desligada e voltar ao n8n quando alguém tira uma variável.
 */
export function tiposQueExecutamos(
  ambiente: { email: boolean; whatsapp: boolean } = { email: emailConfigurado(), whatsapp: whatsappConfigurado() },
): TipoExecutavel[] {
  return TIPOS_EXECUTAVEIS.filter((tipo) =>
    (CANAIS_POR_TIPO[tipo] as readonly Canal[]).every((canal) => ambiente[canal]),
  );
}

export function executamos(tipo: string, ambiente?: { email: boolean; whatsapp: boolean }): tipo is TipoExecutavel {
  return ehTipoExecutavel(tipo) && tiposQueExecutamos(ambiente).includes(tipo);
}

export interface AcoesDoEvento {
  email: EmailParaEnviar | null;
  whatsapp: MensagemWhatsapp | null;
}

/**
 * As mensagens que este evento produz, por canal.
 *
 * `null` num canal é resposta legítima: quer dizer que **este** evento não tem
 * para quem mandar por ali — pedido do Mercado Livre não traz e-mail do
 * comprador, loja sem WhatsApp cadastrado não recebe WhatsApp. Não é falha.
 */
export function acoesDoEvento(envelope: Record<string, unknown>): AcoesDoEvento {
  const tipo = typeof envelope.tipo === "string" ? envelope.tipo : "";
  const canais = ehTipoExecutavel(tipo) ? (CANAIS_POR_TIPO[tipo] as readonly Canal[]) : [];
  return {
    email: canais.includes("email") ? emailDoEvento(envelope) : null,
    whatsapp: canais.includes("whatsapp") ? whatsappDoEvento(envelope) : null,
  };
}
