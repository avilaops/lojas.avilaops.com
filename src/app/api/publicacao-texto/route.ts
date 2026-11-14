import type { NextRequest } from "next/server";
import { buscarTenantPorHost, noEnderecoOficial, urlDaLoja } from "@/lib/tenant";
import { visivelNaBusca } from "@/lib/descoberta";
import { responderTextoPublico, type ContextoPublicacao } from "@/lib/publicacao-texto";
import { caminhoTextoDaRequisicao } from "@/lib/publicacao-texto-rotas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolverHost(host: string): Promise<ContextoPublicacao | null> {
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === base) return { id: `plataforma:${base}`, urlBase: `https://${base}`, publicavel: true };
  const tenant = await buscarTenantPorHost(host);
  if (!tenant || !visivelNaBusca(tenant) || !noEnderecoOficial(tenant, host)) return null;
  return { id: tenant.id, urlBase: urlDaLoja(tenant), publicavel: true };
}

export async function GET(request: NextRequest) {
  const porta = process.env.PORT ?? "3080";
  const origemInterna = /^\d+$/.test(porta) && Number(porta) > 0 && Number(porta) <= 65535 ? `http://127.0.0.1:${Number(porta)}` : "";
  return responderTextoPublico({
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "",
    caminhoTexto: caminhoTextoDaRequisicao(request.nextUrl.pathname, request.nextUrl.searchParams.get("caminho")),
    ifNoneMatch: request.headers.get("if-none-match"),
  }, { origemInterna, resolverHost, buscarHtml: fetch });
}
