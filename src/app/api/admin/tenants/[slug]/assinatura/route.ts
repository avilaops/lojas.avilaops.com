import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { cancelarAssinatura, iniciarAssinatura, mudarEstadoAssinatura, reajustarAssinatura } from "@/lib/assinatura";

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
  // Criar a mensalidade de uma loja que não tem (ou reaproveitar a pendente) e
  // devolver o link em que o lojista cadastra o cartão. Antes só o lojista
  // começava, pelo painel da loja; o admin via "Sem assinatura" e não tinha o
  // que fazer.
  z.object({ acao: z.literal("iniciar") }),
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
  let initPoint: string | null = null;
  if (r.data.acao === "iniciar") {
    // Loja isenta é cobrada por fora da plataforma (ou é da casa): criar a
    // mensalidade aqui faria o cliente pagar duas vezes. Quem quer cobrar por
    // aqui tira a isenção primeiro, que é uma decisão à parte.
    if (t.cobrancaIsenta) {
      return Response.json({ erro: "esta loja é isenta de mensalidade na plataforma; tire a isenção antes de criar a cobrança" }, { status: 409 });
    }
    if (t.status === "CANCELADA") {
      return Response.json({ erro: "loja cancelada não recebe mensalidade nova" }, { status: 409 });
    }
  } else if (!t.assinaturaId) {
    return Response.json({ erro: "esta loja ainda não tem assinatura" }, { status: 409 });
  }

  try {
    switch (r.data.acao) {
      case "iniciar":
        initPoint = (await iniciarAssinatura(t)).initPoint;
        break;
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
    // Só vem preenchido na ação "iniciar" com assinatura pendente: é o link
    // que o admin manda ao lojista.
    initPoint: initPoint ?? (r.data.acao === "iniciar" ? depois.assinaturaInitPoint : null),
  });
}
