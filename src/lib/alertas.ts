import { emitir } from "./eventos";

/**
 * Alerta de operação: o que quebrou numa loja e o que fazer a respeito.
 *
 * Falha de pagamento, de webhook ou de rotina morria em `console.error`, que
 * ninguém lê. O alerta sai como evento (`operacao.alerta`) e vai para o n8n,
 * que o transforma em tarefa. **O texto vem daqui, não do fluxo**: quem abre a
 * tarefa lê a loja, o que aconteceu e o próximo passo sem precisar abrir o
 * código para saber o que o código quis dizer.
 *
 * Um alerta por fato: a chave (`codigo` + `recurso`) impede que o Mercado Pago
 * reenviando a mesma notificação abra dez tarefas iguais.
 */
export const ALERTAS = {
  "pagamento.divergencia": {
    oQueQuebrou: "O valor pago é diferente do total do pedido. O pedido NÃO foi confirmado.",
    oQueFazer: "Conferir o pagamento no gateway. Se o valor recebido estiver certo, confirmar o pedido à mão; se não, estornar e avisar o comprador.",
  },
  "pagamento.sem-estoque": {
    oQueQuebrou: "O pagamento foi aprovado, mas a baixa de estoque falhou (reserva já liberada, saldo insuficiente ou quantidade divergente). O dinheiro entrou e o pedido não pode ser separado como está.",
    oQueFazer: "Conferir o saldo do produto. Havendo estoque, ajustar e confirmar o pedido; não havendo, estornar o pagamento e avisar o comprador.",
  },
  "pagamento.sem-pedido": {
    oQueQuebrou: "Um pagamento foi aprovado no gateway e não existe pedido para ele: a cobrança foi criada, mas o registro do pedido falhou. O estoque segue reservado.",
    oQueFazer: "Conferir o pagamento no gateway pela referência. Se a venda vale, registrar o pedido à mão e separar; se não, estornar o pagamento. Depois, soltar a reserva.",
  },
  "mensalidade.webhook-falhou": {
    oQueQuebrou: "Uma notificação de mensalidade do Mercado Pago chegou e não pôde ser processada. O Mercado Pago não reenvia.",
    oQueFazer: "Rodar a verificação diária de cobrança (POST /api/admin/cobranca/verificar), que relê as cobranças no Mercado Pago, e conferir a aba Assinatura da loja.",
  },
  "canal.aviso-falhou": {
    oQueQuebrou: "Um aviso do Mercado Livre (pedido, pergunta, anúncio ou envio) não pôde ser processado.",
    oQueFazer: "Abrir Painel, Configurações, Canais e conferir o pedido ou a pergunta no Mercado Livre. O aviso fica na fila como FALHOU e pode ser reenviado.",
  },
  "rotina.falhando": {
    oQueQuebrou: "Uma rotina da plataforma falhou três vezes seguidas.",
    oQueFazer: "Ver o erro em GET /api/admin/rotinas e, corrigida a causa, forçar a rotina em POST /api/admin/rotinas/<nome>.",
  },
} as const;

export type CodigoDeAlerta = keyof typeof ALERTAS;

export interface Alerta {
  codigo: CodigoDeAlerta;
  /** Slug da loja; `plataforma` quando o problema não é de loja nenhuma. */
  slug: string;
  lojaNome?: string | null;
  /** O que foi atingido: referência do pedido, id do pagamento, nome da rotina. */
  recurso: string;
  /** Complemento curto: a mensagem do erro, os valores divergentes. */
  detalhe?: string;
  /** Onde resolver, quando existe uma tela. */
  link?: string | null;
  /**
   * Separa ocorrências que merecem alertas distintos do mesmo recurso. A rotina
   * que quebra hoje e quebra de novo no mês que vem são dois alertas.
   */
  ocorrencia?: string;
}

/**
 * Nunca lança: o alerta é consequência de uma falha, e não pode virar a segunda
 * falha que esconde a primeira.
 */
export async function alertar(a: Alerta): Promise<void> {
  try {
    const texto = ALERTAS[a.codigo];
    await emitir(
      {
        tipo: "operacao.alerta",
        slug: a.slug,
        lojaNome: a.lojaNome ?? a.slug,
        codigo: a.codigo,
        recurso: a.recurso.slice(0, 200),
        oQueQuebrou: texto.oQueQuebrou,
        oQueFazer: texto.oQueFazer,
        detalhe: (a.detalhe ?? "").slice(0, 500),
        link: a.link ?? null,
      },
      { chave: `${a.codigo}:${a.recurso}:${a.ocorrencia ?? ""}` },
    );
  } catch (erro) {
    console.error("[alertas] não emitiu", a.codigo, a.slug, erro instanceof Error ? erro.message : erro);
  }
}
