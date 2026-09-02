import { prisma } from "@/lib/db";

/**
 * POST /ml/notifications — o Mercado Livre avisa que algo mudou.
 *
 * O ML manda notificação de pedido, pergunta, anúncio e envio, e **espera 200
 * em poucos segundos**: quem demora entra numa fila de retentativa e, se
 * insistir, tem a notificação desligada. Por isso aqui só se grava e responde;
 * o processamento fica para quem lê a fila.
 *
 * A notificação não é confiável por si: ela diz "o recurso X mudou", não o que
 * mudou. Quem for processar precisa buscar o recurso na API antes de agir.
 */
export const dynamic = "force-dynamic";

type Aviso = {
  resource?: string;
  user_id?: number;
  topic?: string;
  application_id?: number;
  attempts?: number;
  sent?: string;
};

export async function POST(request: Request) {
  const aviso = (await request.json().catch(() => null)) as Aviso | null;
  if (!aviso?.resource || !aviso.topic) return new Response("ok");

  const loja = aviso.user_id
    ? await prisma.tenant.findFirst({
        where: { mlUserId: String(aviso.user_id) },
        select: { id: true, slug: true },
      })
    : null;

  // Loja desconhecida ainda responde 200: negar faz o ML retentar por horas
  // e, no limite, desligar a notificação do aplicativo inteiro.
  if (!loja) return new Response("ok");

  await prisma.automacaoEvento
    .create({
      data: {
        eventId: `ml:${aviso.topic}:${aviso.resource}:${aviso.sent ?? Date.now()}`,
        tipo: `mercadolivre.${aviso.topic}`,
        slug: loja.slug,
        versao: 1,
      },
    })
    .catch(() => {
      /* repetida: o ML reenvia o mesmo aviso, e o unique do eventId barra. */
    });

  return new Response("ok");
}

/** O ML valida a URL com GET antes de ativar as notificações. */
export function GET() {
  return new Response("ok");
}
