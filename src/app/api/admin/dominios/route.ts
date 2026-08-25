import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

/**
 * GET — hosts próprios das lojas ativas (sem os <slug>.<base>, que o curinga
 * do Caddy já cobre). Consumido por /opt/lojas/caddy-sync.sh no host, que
 * mantém /etc/caddy/lojas.d/dominios.caddy: bloco explícito por host, para o
 * domínio próprio da loja não cair no `https://` pega-tudo do Comandeiro.
 *
 * Texto puro, um host por linha: é o que um script de shell lê sem jq.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const lojas = await prisma.tenant.findMany({ where: { status: { in: ["ATIVA", "PROVISIONANDO", "SUSPENSA"] } }, select: { dominios: true } });
  const hosts = new Set<string>();
  for (const l of lojas) for (const d of l.dominios) {
    const h = d.toLowerCase();
    if (h && h !== BASE && !h.endsWith(`.${BASE}`) && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) hosts.add(h);
  }
  return new Response(Array.from(hosts).sort().join("\n") + (hosts.size ? "\n" : ""), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
