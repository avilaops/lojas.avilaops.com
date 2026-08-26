import { headers } from "next/headers";
import { tenantAtual, urlDaLoja, identidadeDa, enderecoCompleto } from "@/lib/tenant";
import { listarCategorias, listarProdutos, formatarBRL } from "@/lib/catalogo";

/**
 * llms.txt da LOJA — o mapa que assistentes de IA (ChatGPT, Perplexity, Gemini)
 * leem para responder sobre a loja com preço e link certos. Faz parte da
 * promessa de "indexação garantida": não é só Google, é também quem pergunta
 * para um assistente.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // O domínio-base é a plataforma, não uma loja.
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === baseDomain) {
    return new Response(
      `# Lojas Avila Ops

> Plataforma brasileira de comércio digital com identidade, checkout e automação.

- Site: https://${baseDomain}
- Criar loja: https://${baseDomain}/criar
- Conteúdo completo para agentes: https://${baseDomain}/llms-full.txt
`,
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return new Response("Loja nao encontrada.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const base = urlDaLoja(t);
  const identidade = identidadeDa(t);
  const [categorias, produtos] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id, { limite: 200 })]);
  const endereco = t.enderecoPublico ? enderecoCompleto(t) : "";

  const linhas = [
    `# ${t.nome}`,
    "",
    `> ${t.slogan ?? identidade.diferencial ?? `Loja virtual ${t.nome}`}`,
    "",
    "## Sobre",
    t.sobre ? t.sobre.split(/\n{2,}/)[0] : identidade.diferencial || `${t.nome} vende pela internet com pagamento seguro.`,
    "",
    "## Como comprar",
    `- Catálogo: ${base}/produtos`,
    t.plano === "SITE" ? `- Pedidos pelo WhatsApp` : `- Pagamento na própria loja: PIX, cartão e boleto`,
    t.retiradaNaLoja ? `- Retirada na loja disponível` : `- Entrega para todo o Brasil`,
    `- Envio em até ${t.despachoDiasUteis} dia(s) útil(eis) após o pagamento`,
    t.freteGratisAcima != null ? `- Frete grátis acima de ${formatarBRL(t.freteGratisAcima)}` : "",
    "",
    "## Contato",
    t.whatsapp ? `- WhatsApp: https://wa.me/${t.whatsapp}` : "",
    t.emailContato ? `- E-mail: ${t.emailContato}` : "",
    endereco ? `- Endereço: ${endereco}` : "",
    t.horario ? `- Horário: ${t.horario}` : "",
    "",
    "## Categorias",
    ...categorias.map((c) => `- [${c.nome}](${base}/categoria/${c.slug})`),
    "",
    "## Produtos",
    ...produtos.map((p) => `- [${p.nome}](${base}/produtos/${p.slug}) — ${formatarBRL(p.precoCentavos)}${p.disponibilidade === "out_of_stock" ? " (esgotado)" : ""}${p.descricaoCurta ? ` — ${p.descricaoCurta}` : ""}`),
    "",
    "## Políticas",
    `- [Envio e retirada](${base}/politicas/envio)`,
    `- [Trocas e devoluções](${base}/politicas/devolucao)`,
    `- [Privacidade](${base}/politicas/privacidade)`,
    "",
    "## Dados estruturados",
    `- Sitemap: ${base}/sitemap.xml`,
    `- Feed do Google Merchant: ${base}/feed/merchant.xml`,
  ];

  return new Response(linhas.filter((l) => l !== "").join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
