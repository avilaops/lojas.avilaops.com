import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { cancelarAssinatura, mudarEstadoAssinatura, reajustarAssinatura } from "@/lib/assinatura";

/**
 * Ações sobre a mensalidade de uma loja, para o admin da Avila Ops
 * (app.avilaops.com → Financeiro → Mercado Pago).
 *
 * Existe para que o admin **não** fale direto com o Mercado Pago. Cancelar por
 * lá deixaria o nosso banco desatualizado até a varredura do dia seguinte — a
 * loja continuaria vendendo depois de cancelada, ou o contrário. Aqui os dois
 * lados mudam na mesma requisição, e o evento sai para o n8n avisar o lojista.
 */
const Entrada = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("cancelar") }),
  z.object({ acao: z.literal("pausar") }),
  z.object({ acao: z.literal("retomar") }),
  z.object({ acao: z.literal("valor"), centavos: z.number().int().min(100).max(1_000_000) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;

  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "ação inválida", detalhes: r.error.flatten() }, { status: 422 });

  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  if (!t.assinaturaId) return Response.json({ erro: "esta loja ainda não tem assinatura" }, { status: 409 });

  try {
    switch (r.data.acao) {
      case "cancelar":
        await cancelarAssinatura(t);
        break;
      case "pausar":
        await mudarEstadoAssinatura(t, "paused");
        break;
      case "retomar":
        await mudarEstadoAssinatura(t, "authorized");
        break;
      case "valor":
        await reajustarAssinatura(t, r.data.centavos);
        break;
    }
  } catch (erro) {
    return Response.json({ erro: erro instanceof Error ? erro.message : "falha no Mercado Pago" }, { status: 502 });
  }

  const depois = await prisma.tenant.findUniqueOrThrow({ where: { slug } });
  return Response.json({
    slug: depois.slug,
    status: depois.status,
    assinaturaStatus: depois.assinaturaStatus,
    assinaturaId: depois.assinaturaId,
  });
}
