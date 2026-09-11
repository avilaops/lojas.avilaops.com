import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { reenviar } from "@/lib/eventos";

const POR_PAGINA = 30;

/**
 * GET — as automações desta loja: o que a plataforma emitiu e o que o n8n
 * fez com cada uma, na língua do lojista.
 *
 * Lê só o outbox da própria loja (`slug` da sessão). O que devolve é estado,
 * nunca o corpo do evento: o corpo tem e-mail e telefone de comprador, e a
 * tela não precisa dele para dizer "o aviso de pedido pago saiu às 14h".
 */
export async function GET(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "").trim();
  const pagina = Math.max(1, Math.trunc(Number(url.searchParams.get("pagina") ?? 1)) || 1);
  const where = {
    slug: s.tenant.slug,
    ...(["EMITIDO", "PROCESSANDO", "PROCESSADO", "FALHOU", "IGNORADO"].includes(status) ? { status: status as never } : {}),
  };

  const [total, itens, porStatus] = await Promise.all([
    prisma.automacaoEvento.count({ where }),
    prisma.automacaoEvento.findMany({
      where,
      select: { eventId: true, tipo: true, status: true, detalhe: true, emitidoEm: true, concluidoEm: true, correlationId: true, tentativas: true },
      orderBy: { emitidoEm: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.automacaoEvento.groupBy({ by: ["status"], where: { slug: s.tenant.slug }, _count: { _all: true } }),
  ]);

  return Response.json({
    total,
    pagina,
    porPagina: POR_PAGINA,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    resumo: Object.fromEntries(porStatus.map((g) => [g.status, g._count._all])),
    itens,
  });
}

const Reenvio = z.object({ eventId: z.string().min(8).max(80) });

/**
 * POST — reenvia um evento que falhou. O lojista aperta; a plataforma reabre
 * o mesmo corpo com um eventId novo (ver `reenviar`). Idempotente pelo teto de
 * tentativas: apertar quatro vezes não manda quatro.
 */
export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const r = Reenvio.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });

  const resultado = await reenviar(r.data.eventId, s.tenant.slug);
  if (!resultado.ok) {
    const msg: Record<typeof resultado.motivo, string> = {
      "nao-encontrado": "Este aviso não existe.",
      "outra-loja": "Este aviso não é desta loja.",
      "nao-falhou": "Só o que falhou pode ser reenviado.",
      "sem-payload": "Este aviso é antigo e não guardou o conteúdo; não dá para reenviar.",
      "limite": "Este aviso já foi reenviado três vezes. Fale com o suporte.",
    };
    return Response.json({ erro: msg[resultado.motivo] }, { status: 409 });
  }
  return Response.json(resultado);
}
