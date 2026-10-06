import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { esquecerTenantEmCache } from "@/lib/tenant";
import { cancelarAssinatura, iniciarAssinatura } from "@/lib/assinatura";
import { MercadoPagoIndisponivel } from "@/lib/mercadopago-assinatura";

/** POST — cria (ou reaproveita) a assinatura e devolve o link para cadastrar o cartão. */
export async function POST() {
  const { s, erro } = await exigir("cobranca");
  if (erro) return erro;
  const loja = s.tenant;
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
  const { s, erro } = await exigir("cobranca");
  if (erro) return erro;
  const loja = s.tenant;
  await cancelarAssinatura(loja);
  return Response.json({ ok: true });
}

/**
 * PATCH { plano } — escolhe o plano enquanto não existe assinatura no Mercado
 * Pago. Com assinatura criada, o valor mora lá também e trocar só aqui faria a
 * loja mostrar um preço e o cartão pagar outro: aí é com o suporte.
 */
const TrocaDePlano = z.object({ plano: z.enum(["SITE", "LOJA", "LOJA_PRO"]) });

export async function PATCH(request: Request) {
  const { s, erro } = await exigir("cobranca");
  if (erro) return erro;
  const r = TrocaDePlano.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Escolha um plano." }, { status: 400 });
  if (s.tenant.assinaturaId) {
    return Response.json({ erro: "A assinatura já foi criada no Mercado Pago. Para trocar de plano, fale com o suporte." }, { status: 409 });
  }
  await prisma.tenant.update({ where: { id: s.tenant.id }, data: { plano: r.data.plano } });
  esquecerTenantEmCache(s.tenant.slug);
  return Response.json({ ok: true, plano: r.data.plano });
}
