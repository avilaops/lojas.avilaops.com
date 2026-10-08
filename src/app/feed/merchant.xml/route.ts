import { lojaVende, tenantAtual, urlDaLoja } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { INCLUIR_CATALOGO } from "@/lib/catalogo-qualidade";
import { gerarFeedMerchant } from "@/lib/catalogo-merchant";
import { freteGratisGarantido } from "@/lib/envio-declarado";

export const dynamic = "force-dynamic";

/** Exportar o feed não comprova envio nem aprovação do canal. */
export async function GET() {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return new Response("não", { status: 404 });
  // O Merchant só aceita oferta que se compra na página de destino. Loja sem
  // checkout (plano Site ou sem pagamento conectado) publica o feed vazio, em
  // vez de anunciar produto que termina num pedido por telefone.
  const produtos = !lojaVende(t) ? [] : await prisma.produto.findMany({ where: { tenantId:t.id, ativo:true }, include:INCLUIR_CATALOGO, orderBy:{nome:"asc"} });
  return new Response(gerarFeedMerchant(t,urlDaLoja(t),produtos,(preco)=>freteGratisGarantido(t,preco)),{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"no-store"}});
}
