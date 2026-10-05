import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";

/**
 * Revogar uma chave da API.
 *
 * Revogar não apaga: a linha fica para o painel mostrar quando foi revogada e
 * para a API responder `chave_revogada` em vez de `chave_invalida` — o
 * desenvolvedor do outro lado precisa saber que foi decisão da loja, não erro
 * de digitação. O `tenantId` da sessão entra no filtro para uma loja não
 * revogar a chave de outra.
 */
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const { id } = await params;

  const r = await prisma.chaveApi.updateMany({
    where: { id, tenantId: s.tenant.id, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
  if (r.count === 0) return Response.json({ erro: "Chave não encontrada ou já revogada." }, { status: 404 });
  return Response.json({ sucesso: true });
}
