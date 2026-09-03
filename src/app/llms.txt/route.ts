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
    // Formato do llmstxt.org: H1, resumo em citação e **links em markdown**
    // sob cabeçalhos H2. A versão anterior listava URL crua ("- Site:
    // https://…"), e o verificador do Lighthouse reprovava com "o arquivo não
    // parece conter links" — o que vale para o leitor humano não vale para o
    // agente, que procura `[texto](url)`.
    return new Response(
      `# Lojas Avila Ops

> Plataforma brasileira para criar loja virtual com vitrine, carrinho, Pix, frete por CEP e domínio próprio. O lojista cria e administra sozinho, pelo navegador.

## Começar

- [Criar uma loja](https://${baseDomain}/criar): cadastro em minutos, sem instalar nada
- [Planos e preços](https://${baseDomain}/#planos): Site, Loja e Loja Pro
- [Entrar no painel](https://${baseDomain}/entrar): para quem já tem loja

## Como funciona

- [Página inicial](https://${baseDomain}): o que a plataforma faz, com exemplos
- [Perguntas frequentes](https://${baseDomain}/#faq): prazo, pagamento, domínio e cancelamento
- [Blog](https://${baseDomain}/blog): textos curtos sobre vender pela internet, um por dia

## Para agentes

- [Conteúdo completo](https://${baseDomain}/llms-full.txt): planos, recursos e respostas em um arquivo só
- [Sitemap](https://${baseDomain}/sitemap.xml): todas as páginas publicadas

## Observação

Cada loja criada tem o próprio \`llms.txt\`, com o catálogo, os preços e as
políticas dela. Este arquivo descreve a plataforma, não uma loja.
`,
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" } },
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
    ...produtos.map((p) => `- [${p.nome}](${base}/produtos/${p.slug}): ${formatarBRL(p.precoCentavos)}${p.disponibilidade === "out_of_stock" ? " (esgotado)" : ""}${p.descricaoCurta ? ` · ${p.descricaoCurta}` : ""}`),
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
