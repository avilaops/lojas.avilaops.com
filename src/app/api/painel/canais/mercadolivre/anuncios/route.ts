import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";

const Entrada = z.object({
  produtoIds: z.array(z.string().min(1)).min(1).max(100),
});

/** A aprovação é humana. O n8n só publica produtos que passaram por esta porta. */
export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "selecione produtos válidos" }, { status: 422 });

  const resultado = await prisma.anuncioMercadoLivre.updateMany({
    where: {
      tenantId: s.tenant.id,
      produtoId: { in: entrada.data.produtoIds },
      preparoEstado: "PRONTO",
      mlbId: null,
      estado: { in: ["rascunho", "recusado"] },
    },
    data: { estado: "aprovado", motivoErro: null },
  });
  return Response.json({ aprovados: resultado.count });
}
