import { headers } from "next/headers";
import { normalizarHost, tenantAtual } from "./tenant";
import { respostaDescobertaPublica, type FormatoDescoberta } from "./descoberta-publica";

export async function responderDescobertaPublica(formato: FormatoDescoberta): Promise<Response> {
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host");
  const baseDomain = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
  const tenant = normalizarHost(host) === normalizarHost(baseDomain) ? null : await tenantAtual();
  return respostaDescobertaPublica({ host, tenant, baseDomain }, formato);
}
