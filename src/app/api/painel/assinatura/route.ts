import { lojistaAtual } from "@/lib/sessao";
import { cancelarAssinatura, iniciarAssinatura } from "@/lib/assinatura";
import { MercadoPagoIndisponivel } from "@/lib/mercadopago-assinatura";

/** POST — cria (ou reaproveita) a assinatura e devolve o link para cadastrar o cartão. */
export async function POST() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  try {
    return Response.json(await iniciarAssinatura(loja));
  } catch (erro) {
    if (erro instanceof MercadoPagoIndisponivel) return Response.json({ erro: erro.message }, { status: 503 });
    console.error("[assinatura]", erro);
    return Response.json({ erro: "Não foi possível iniciar a assinatura agora." }, { status: 502 });
  }
}

/** DELETE — cancela a assinatura (a loja segue até o fim do período pago; depois é suspensa). */
export async function DELETE() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  await cancelarAssinatura(loja);
  return Response.json({ ok: true });
}
