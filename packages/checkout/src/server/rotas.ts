import type { PaymentProvider } from "../providers/types.ts";
import {
  montarPedidoSeguro,
  PedidoInvalidoError,
  type PayloadCheckout,
  type ResolucaoCatalogo,
} from "./pedido.ts";

/**
 * Handlers de checkout no formato Web `Request`/`Response`.
 *
 * Esse formato é o denominador comum: no Next.js App Router basta
 * `export const POST = criarRotaPagamento(...)`, e o mesmo handler roda em
 * Remix, Hono, Bun ou Cloudflare Workers sem adaptador.
 */

export interface OpcoesRotas {
  provider: PaymentProvider;
  catalogo: ResolucaoCatalogo;
  /** Chamado quando o pagamento é criado. Persista o pedido aqui. */
  aoCriarPagamento?: (dados: {
    referencia: string;
    pagamentoId: string;
    status: string;
    total: number;
  }) => Promise<void>;
  /** Chamado quando o webhook confirma mudança de status. */
  aoAtualizarStatus?: (dados: {
    pagamentoId: string;
    status: string;
  }) => Promise<void>;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** POST , cria a cobrança. */
export function criarRotaPagamento({
  provider,
  catalogo,
  aoCriarPagamento,
}: OpcoesRotas) {
  return async function POST(request: Request): Promise<Response> {
    let payload: PayloadCheckout;
    try {
      payload = (await request.json()) as PayloadCheckout;
    } catch {
      return json({ erro: "Requisição inválida." }, 400);
    }

    try {
      const { pedido, total } = await montarPedidoSeguro(payload, catalogo);
      const resultado = await provider.cobrar(pedido, total);

      await aoCriarPagamento?.({
        referencia: pedido.referencia,
        pagamentoId: resultado.id,
        status: resultado.status,
        total,
      });

      return json(resultado);
    } catch (erro) {
      // Erro de validação é problema do pedido e o cliente precisa saber qual ,
      // "revise o carrinho" sem dizer o quê não dá para consertar.
      if (erro instanceof PedidoInvalidoError) {
        return json({ erro: erro.message, codigo: erro.codigo }, 422);
      }

      // Falha do gateway ou nossa: a mensagem crua pode conter detalhe de
      // infraestrutura, então vai só para o log do servidor.
      console.error("[checkout] falha ao cobrar:", erro);
      return json(
        {
          erro: "Não foi possível processar o pagamento agora. Nada foi cobrado.",
          codigo: "falha_gateway",
        },
        502,
      );
    }
  };
}

/**
 * GET , status do pagamento, para a tela do PIX descobrir que foi pago.
 *
 * O status vem do gateway, não do nosso banco: entre o webhook e a gravação
 * existe uma janela, e é justamente nela que o cliente fica olhando o QR code
 * esperando a tela virar.
 */
export function criarRotaStatus({ provider }: Pick<OpcoesRotas, "provider">) {
  return async function GET(request: Request): Promise<Response> {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ erro: "Informe o id do pagamento." }, 400);

    try {
      return json(await provider.consultar(id));
    } catch (erro) {
      console.error("[checkout] falha ao consultar:", erro);
      return json({ erro: "Não foi possível consultar o pagamento." }, 502);
    }
  };
}

/**
 * POST , webhook do gateway.
 *
 * Duas regras que parecem detalhe e não são:
 *
 * 1. O corpo é lido como TEXTO. A assinatura é calculada sobre os bytes
 *    exatos que chegaram; `await request.json()` e re-serializar muda espaços
 *    e ordem de chaves, e a assinatura deixa de bater.
 *
 * 2. Responde 200 mesmo quando o processamento interno falha, desde que a
 *    assinatura seja válida. Gateway que recebe erro reenvia a notificação por
 *    horas; o que precisa ser recusado com 401 é assinatura inválida, não
 *    problema nosso de banco.
 */
export function criarRotaWebhook({ provider, aoAtualizarStatus }: OpcoesRotas) {
  return async function POST(request: Request): Promise<Response> {
    const corpoBruto = await request.text();

    const cabecalhos: Record<string, string | undefined> = {};
    request.headers.forEach((valor, chave) => {
      cabecalhos[chave.toLowerCase()] = valor;
    });

    const query = Object.fromEntries(new URL(request.url).searchParams.entries());

    let validado: { pagamentoId: string } | null;
    try {
      validado = await provider.validarWebhook({ corpoBruto, cabecalhos, query });
    } catch (erro) {
      console.error("[checkout] webhook mal configurado:", erro);
      return json({ erro: "Webhook não configurado." }, 500);
    }

    if (!validado) {
      return json({ erro: "Assinatura inválida." }, 401);
    }

    try {
      const resultado = await provider.consultar(validado.pagamentoId);
      await aoAtualizarStatus?.({
        pagamentoId: resultado.id,
        status: resultado.status,
      });
    } catch (erro) {
      console.error("[checkout] falha ao processar webhook:", erro);
    }

    return json({ recebido: true });
  };
}
