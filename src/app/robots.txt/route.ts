import { headers } from "next/headers";
import { tenantAtual } from "@/lib/tenant";
import { regrasRobots } from "@/lib/descoberta";
import { sinaisConteudoLoja, textoRobotsComSinais } from "@/lib/robots-content-signals";

export const dynamic = "force-dynamic";

/** Mesmas regras por host, com Content Signals vinculados à política da loja. */
export async function GET() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  let texto: string;
  if (host === baseDomain) {
    texto = textoRobotsComSinais({
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/painel", "/entrar", "/recuperar", "/redefinir"] },
      sitemap: [`https://${baseDomain}/sitemap.xml`, `https://${baseDomain}/sitemap-lojas.xml`],
    }, { busca: true, entradaIa: true, treinamento: true });
  } else {
    const t = await tenantAtual();
    texto = t ? textoRobotsComSinais(regrasRobots(t), sinaisConteudoLoja(t))
      : textoRobotsComSinais({ rules: { userAgent: "*", disallow: "/" } }, { busca: false, entradaIa: false, treinamento: false });
  }
  return new Response(texto, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
