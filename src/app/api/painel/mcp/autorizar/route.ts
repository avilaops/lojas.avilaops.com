import { cookies } from "next/headers";
import { clientePorId, criarCodigo, tetoDoPapel } from "@/lib/mcp-conexoes";
import { abrirPedido, COOKIE_DO_PEDIDO, emissor, retornoRegistrado, urlDeRetorno } from "@/lib/mcp-oauth";
import { escoposDaAutorizacao, limitarAoTeto } from "@/lib/mcp-permissoes";
import { sessaoDoPainel } from "@/lib/sessao";

/**
 * A decisão do lojista na tela de autorização do conector.
 *
 * Qualquer pessoa da equipe conecta o próprio assistente, e ele pode no máximo
 * o que ela pode no painel (`tetoDoPapel`): o balcão só alcança pedidos. O
 * pedido vem do cookie assinado, nunca do corpo: a tela mostrou
 * um assistente e um retorno, e é para eles que o código vai.
 */
export async function POST(request: Request) {
  const s = await sessaoDoPainel();
  if (!s) return Response.json({ erro: "Sessão expirada." }, { status: 401 });

  const store = await cookies();
  const pedido = abrirPedido(store.get(COOKIE_DO_PEDIDO)?.value);
  if (!pedido) {
    return Response.json({ erro: "O pedido de conexão venceu. Volte ao assistente e conecte de novo." }, { status: 410 });
  }

  const cliente = await clientePorId(pedido.clienteId);
  if (!cliente || !retornoRegistrado(pedido.retorno, cliente.retornos)) {
    store.delete(COOKIE_DO_PEDIDO);
    return Response.json({ erro: "Este assistente não está mais registrado. Remova o conector e adicione de novo." }, { status: 410 });
  }

  const corpo = (await request.json().catch(() => null)) as { decisao?: unknown; nivel?: unknown; areas?: unknown } | null;
  if (corpo?.decisao === "negar") {
    store.delete(COOKIE_DO_PEDIDO);
    return Response.json({ ir: urlDeRetorno(pedido.retorno, { error: "access_denied", state: pedido.state, iss: emissor() }) });
  }
  if (corpo?.decisao !== "permitir") return Response.json({ erro: "Decisão inválida." }, { status: 400 });

  const loja = s.tenant;
  if (loja.plano !== "LOJA_PRO") {
    return Response.json(
      { erro: "O conector de IA é do plano Loja Pro. Faça o upgrade na aba Assinatura e conecte de novo.", upgradeNecessario: true },
      { status: 403 },
    );
  }
  if (loja.status !== "ATIVA") {
    return Response.json({ erro: "A loja precisa estar ativa para conectar um assistente." }, { status: 403 });
  }

  // O que a conexão vai poder é o que foi marcado nesta tela, cortado pelo que
  // a pessoa pode no painel, e fica gravado nela: o assistente não escolhe nem
  // amplia depois. O corte se repete a cada chamada, com o papel daquela hora.
  const marcados = escoposDaAutorizacao({ nivel: corpo.nivel, areas: corpo.areas });
  const escopos = marcados ? limitarAoTeto(marcados, tetoDoPapel(s.papel)) : [];
  if (!escopos.length) return Response.json({ erro: "Escolha ao menos uma área que o seu acesso ao painel alcance." }, { status: 400 });

  const codigo = await criarCodigo(loja.id, s.operador?.id ?? null, pedido, escopos);
  store.delete(COOKIE_DO_PEDIDO);
  return Response.json({ ir: urlDeRetorno(pedido.retorno, { code: codigo, state: pedido.state, iss: emissor() }) });
}
