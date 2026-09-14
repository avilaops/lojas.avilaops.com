import { tenantAtual, urlDaLoja } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { INCLUIR_CATALOGO } from "@/lib/catalogo-qualidade";
import { gerarFeedMerchant } from "@/lib/catalogo-merchant";

export const dynamic = "force-dynamic";

/** Exportar o feed não comprova envio nem aprovação do canal. */
export async function GET() {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return new Response("não", { status: 404 });
  const produtos = await prisma.produto.findMany({ where: { tenantId:t.id, ativo:true }, include:INCLUIR_CATALOGO, orderBy:{nome:"asc"} });
  return new Response(gerarFeedMerchant(t,urlDaLoja(t),produtos),{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"no-store"}});
}
