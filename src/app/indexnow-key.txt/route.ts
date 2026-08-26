import { tenantAtual } from "@/lib/tenant";
import { chaveIndexNow } from "@/lib/indexnow";

/**
 * Arquivo de verificação do IndexNow. Cada loja serve a própria chave no
 * próprio domínio — é assim que Bing/Yandex confirmam que quem pediu a
 * indexação controla o site.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const t = await tenantAtual();
  if (!t) return new Response("não", { status: 404 });
  return new Response(chaveIndexNow(t.slug), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
