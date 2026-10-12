/**
 * O que o comprador vê quando o checkout respondeu `pagamento_a_confirmar`.
 *
 * Nesse desfecho não se sabe se a cobrança nasceu (tempo-limite do gateway) ou
 * ela nasceu e o pedido não foi gravado. Reabrir o formulário convida a pagar
 * de novo; o comprador vai para a página do pedido, que nesse intervalo ainda
 * não tem `Pedido` e se orienta pela tentativa (`TentativaCatalogo`). Quem
 * resolve a tentativa é a rotina `reservas.reconciliar`.
 */

import type { ResultadoPagamento } from "@avilaops/checkout";

export const CODIGO_A_CONFIRMAR = "pagamento_a_confirmar";

/** A referência que o servidor devolveu; sem ela, a que o navegador enviou. */
function referenciaDaResposta(corpo: unknown, referenciaEnviada: string): string {
  const c = (corpo ?? {}) as { referencia?: unknown };
  return typeof c.referencia === "string" && c.referencia ? c.referencia : referenciaEnviada;
}

/**
 * Para onde o navegador vai depois de uma resposta não-ok do `/api/checkout`,
 * ou `null` quando o erro é do formulário e a tela continua nele. A referência
 * é a que o servidor devolveu; sem ela, a que o navegador enviou.
 */
export function destinoAposFalhaDoCheckout(corpo: unknown, referenciaEnviada: string): string | null {
  const c = (corpo ?? {}) as { codigo?: unknown };
  if (c.codigo !== CODIGO_A_CONFIRMAR) return null;
  return `/pedido/${encodeURIComponent(referenciaDaResposta(corpo, referenciaEnviada))}`;
}

/**
 * O que a tela do checkout faz com a resposta do `/api/checkout`.
 *
 * `a_confirmar` cobre dois casos: o servidor disse `pagamento_a_confirmar`, ou
 * respondeu 200 com um corpo que não é um resultado de pagamento (sem JSON,
 * cortado no caminho). No segundo a cobrança foi feita e só a resposta se
 * perdeu: tratar como erro reabriria o formulário dizendo "nada foi cobrado".
 */
export type DesfechoDoCheckout =
  | { tipo: "resultado"; resultado: ResultadoPagamento }
  | { tipo: "a_confirmar"; referencia: string; destino: string }
  | { tipo: "erro"; mensagem: string; conclusivo: boolean };

export function desfechoDoCheckout(ok: boolean, corpo: unknown, referenciaEnviada: string): DesfechoDoCheckout {
  if (ok) {
    const c = (corpo ?? {}) as { id?: unknown; status?: unknown };
    if (typeof corpo === "object" && corpo !== null && typeof c.status === "string" && c.status && (typeof c.id === "string" || typeof c.id === "number")) {
      return { tipo: "resultado", resultado: corpo as ResultadoPagamento };
    }
    return { tipo: "a_confirmar", referencia: referenciaEnviada, destino: `/pedido/${encodeURIComponent(referenciaEnviada)}` };
  }
  const destino = destinoAposFalhaDoCheckout(corpo, referenciaEnviada);
  if (destino) return { tipo: "a_confirmar", referencia: referenciaDaResposta(corpo, referenciaEnviada), destino };
  const { erro, codigo } = (corpo ?? {}) as { erro?: unknown; codigo?: unknown };
  // Só o servidor da loja manda `codigo`: sem ele a resposta veio do caminho
  // (504 do proxy, página de erro) e não diz se a cobrança nasceu.
  return { tipo: "erro", mensagem: typeof erro === "string" && erro ? erro : "Não foi possível processar o pagamento.", conclusivo: typeof codigo === "string" && codigo !== "" };
}

/**
 * A pendência é guardada antes do `POST` e só sai quando a resposta é
 * conclusiva: um resultado de pagamento, ou erro em que o servidor da loja
 * disse o que houve. Resposta sem `codigo` e `fetch` que não voltou deixam a
 * pendência guardada: recarregar a página não abre o formulário com
 * referência nova enquanto a rota `/api/checkout/pendente` não disser `livre`.
 */
export function encerraPendencia(desfecho: DesfechoDoCheckout): boolean {
  return desfecho.tipo === "resultado" || (desfecho.tipo === "erro" && desfecho.conclusivo);
}

export type TelaSemPedido = "confirmando" | "pago_sem_pedido" | "nao_concluido";

/**
 * A tela da página do pedido quando a referência tem tentativa e não tem
 * pedido. `null` é 404: referência que a loja não conhece, ou tentativa que
 * nunca chegou à cobrança (`RESERVADA`) nem deveria estar sem pedido
 * (`CONFIRMADA`).
 *
 * `PAGA_SEM_PEDIDO` tem tela própria: o dinheiro entrou e ninguém cria o
 * `Pedido` sozinho (a reconciliação só abre o alerta `pagamento.sem-pedido`),
 * então "volte em alguns minutos" seria promessa sem quem cumpra.
 */
export function telaSemPedido(estadoDaTentativa: string | null | undefined): TelaSemPedido | null {
  switch (estadoDaTentativa) {
    case "INCERTA":
    case "COBRANCA_CRIADA":
      return "confirmando";
    case "PAGA_SEM_PEDIDO":
      return "pago_sem_pedido";
    case "LIBERADA":
      return "nao_concluido";
    default:
      return null;
  }
}

/** Título e texto de cada tela sem pedido. Texto fixo: nada da tentativa nem do comprador. */
export const TEXTO_SEM_PEDIDO: Record<TelaSemPedido, { titulo: string; texto: string }> = {
  confirmando: {
    titulo: "Estamos confirmando o pagamento",
    texto: "Não pague de novo. A resposta do pagamento ainda não chegou; assim que ela chegar, esta página mostra o resultado. Guarde este endereço e volte em alguns minutos. Se continuar assim por mais de uma hora, fale com a loja.",
  },
  pago_sem_pedido: {
    titulo: "Pagamento recebido",
    texto: "Recebemos o seu pagamento. Não pague de novo. O pedido ainda não foi registrado: a loja foi avisada e vai confirmar o pedido com você. Para agilizar, fale com a loja e informe o código acima.",
  },
  nao_concluido: {
    titulo: "Pagamento não concluído",
    texto: "Este pagamento não foi concluído e nenhum pedido foi gerado. Seu carrinho continua guardado para você tentar de novo.",
  },
};

/**
 * O que o `/checkout` faz com a referência que ficou pendente no navegador.
 *
 *   - `pendente`: a cobrança pode ter nascido (ou nasceu) e não há pedido — o
 *     formulário não abre, a tela aponta para a página do pedido. Inclui a
 *     tentativa `RESERVADA`: o navegador só pergunta por referência que ele
 *     enviou ao checkout, então reserva sem desfecho é cobrança em curso, ou
 *     tentativa que não conseguiu ser marcada `INCERTA`. Quem solta esse caso
 *     é o prazo da pendência no navegador (`PENDENCIA_VALE_MS`);
 *   - `pedido`: a compra virou pedido — a tela avisa antes de deixar comprar
 *     de novo com o mesmo carrinho;
 *   - `livre`: não há cobrança em aberto para essa referência (reserva solta,
 *     pedido cancelado ou estornado, referência que a loja não conhece).
 */
export type SituacaoDaReferencia = "pendente" | "pedido" | "livre";

export function situacaoDaReferencia(statusDoPedido: string | null | undefined, estadoDaTentativa: string | null | undefined): SituacaoDaReferencia {
  if (statusDoPedido) return statusDoPedido === "CANCELADO" || statusDoPedido === "ESTORNADO" ? "livre" : "pedido";
  if (estadoDaTentativa === "RESERVADA") return "pendente";
  const tela = telaSemPedido(estadoDaTentativa);
  return tela === "confirmando" || tela === "pago_sem_pedido" ? "pendente" : "livre";
}

/** Só o que a rota `/api/checkout/pendente` pode responder; qualquer outra coisa é falha de consulta. */
export function lerSituacao(corpo: unknown): SituacaoDaReferencia | null {
  const s = (corpo as { situacao?: unknown } | null)?.situacao;
  return s === "pendente" || s === "pedido" || s === "livre" ? s : null;
}

/**
 * O que a tela faz depois de consultar a pendência. Consulta que falhou é
 * `sem_resposta`, e não `pendente`: o formulário continua fechado (na dúvida
 * não se cobra de novo), mas a tela não afirma que há pagamento em
 * confirmação, porque a primeira tentativa pode já ter sido liberada.
 */
export type SituacaoAposConsulta = SituacaoDaReferencia | "sem_resposta";

export function situacaoAposConsulta(corpo: unknown): SituacaoAposConsulta {
  return lerSituacao(corpo) ?? "sem_resposta";
}

/** Título, texto e botão das duas telas do `/checkout` que seguram o formulário. Texto fixo. */
export const TEXTO_PENDENCIA_NO_CHECKOUT: Record<"pendente" | "sem_resposta", { titulo: string; texto: string; conferir: string }> = {
  pendente: {
    titulo: "Você tem um pagamento em confirmação",
    texto: "Não pague de novo. Seu pagamento anterior ainda não foi resolvido; finalizar outra compra agora poderia cobrar duas vezes. Seu carrinho continua guardado.",
    conferir: "Conferir de novo",
  },
  sem_resposta: {
    titulo: "Não conseguimos conferir agora",
    texto: "Um pagamento anterior seu ficou a confirmar e a consulta não respondeu. Tente de novo em instantes. Até a consulta responder, não pague de novo; seu carrinho continua guardado.",
    conferir: "Tentar de novo",
  },
};

/**
 * A referência pendente fica no navegador, ao lado do carrinho.
 *
 * `localStorage`, e não `sessionStorage`, porque o carrinho mora em
 * `localStorage`: outra aba abre o mesmo carrinho e, sem a pendência, abriria
 * também o formulário com referência nova. O prazo existe para um
 * `PAGA_SEM_PEDIDO` que ninguém resolveu não trancar o checkout daquele
 * navegador para sempre, e para a referência (que abre a página do pedido) não
 * ficar guardada além do necessário.
 */
export const PENDENCIA_VALE_MS = 48 * 60 * 60 * 1000;

export interface GuardaDoNavegador {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** O `localStorage`, ou `null` quando o navegador recusa até o acesso (modo restrito). Só no navegador. */
export function guardaDoNavegador(): GuardaDoNavegador | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function chaveDaPendencia(slug: string) {
  return `loja:${slug}:pagamento-pendente`;
}

/** Storage bloqueado não derruba o checkout: a pendência só deixa de valer entre visitas. */
export function guardarPendencia(guarda: GuardaDoNavegador | null, slug: string, referencia: string, agora = Date.now()): void {
  try {
    guarda?.setItem(chaveDaPendencia(slug), JSON.stringify({ referencia, em: agora }));
  } catch {
    /* idem ao carrinho */
  }
}

export function esquecerPendencia(guarda: GuardaDoNavegador | null, slug: string): void {
  try {
    guarda?.removeItem(chaveDaPendencia(slug));
  } catch {
    /* idem */
  }
}

/** A referência pendente desta loja, ou `null`. Valor vencido ou ilegível é apagado. */
export function lerPendencia(guarda: GuardaDoNavegador | null, slug: string, agora = Date.now()): string | null {
  try {
    const bruto = guarda?.getItem(chaveDaPendencia(slug));
    if (!bruto) return null;
    const v = JSON.parse(bruto) as { referencia?: unknown; em?: unknown } | null;
    if (v && typeof v.referencia === "string" && v.referencia && typeof v.em === "number" && agora - v.em >= 0 && agora - v.em < PENDENCIA_VALE_MS) return v.referencia;
    esquecerPendencia(guarda, slug);
    return null;
  } catch {
    esquecerPendencia(guarda, slug);
    return null;
  }
}
