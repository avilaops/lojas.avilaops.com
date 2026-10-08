import { headers } from "next/headers";
import { tenantAtual, urlDaLoja, identidadeDa, enderecoCompleto, lojaVende, prazoDeDespacho, retiradaPublicaDisponivel } from "@/lib/tenant";
import { listarCategorias, listarProdutos, formatarBRL } from "@/lib/catalogo";
import { descricaoDaLoja } from "@/lib/textos-loja";

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
  // Categorias em ordem de tamanho (é como `listarCategorias` devolve) e só as
  // principais: 73 links de categoria já é lista, não orientação.
  // Destaques são o que o lojista marcou, com teto. Produto não entra em
  // massa: isto descreve a loja; o catálogo é do sitemap e das categorias.
  const [categorias, destaques] = await Promise.all([
    listarCategorias(t.id),
    listarProdutos(t.id, { destaque: true, limite: 12 }),
  ]);
  const endereco = t.enderecoPublico ? enderecoCompleto(t) : "";
  const vende = lojaVende(t);

  const linhas = [
    `# ${t.nome}`,
    "",
    // `??` deixava passar diferencial em branco: a PK Vedações publicava "> "
    // vazio. A mesma frase da meta description, pela mesma regra.
    `> ${descricaoDaLoja(t, identidade.diferencial)}`,
    "",
    "## Sobre",
    t.sobre ? t.sobre.split(/\n{2,}/)[0] : identidade.diferencial || `${t.nome} vende pela internet.`,
    "",
    `- [Sobre a loja](${base}/sobre)`,
    `- [Contato](${base}/contato)`,
    "",
    "## Como comprar",
    `- [Catálogo completo](${base}/produtos): busca por nome, código, medida ou marca; filtros por categoria, preço e medida`,
    // Só o que é verdade hoje: loja sem gateway ligado não "aceita PIX".
    vende
      ? `- Pagamento na própria loja: ${t.meiosPagamento.length ? t.meiosPagamento.join(", ") : "PIX, cartão e boleto"}`
      : t.whatsapp
        ? `- Pedidos e orçamentos pelo WhatsApp`
        : "",
    retiradaPublicaDisponivel(t) ? `- Retirada na loja disponível` : `- Entrega para todo o Brasil`,
    vende ? `- Envio ${prazoDeDespacho(t.despachoDiasUteis)} após o pagamento` : "",
    vende && t.freteGratisAcima != null ? `- Frete grátis acima de ${formatarBRL(t.freteGratisAcima)}` : "",
    "",
    "## Contato",
    t.whatsapp ? `- WhatsApp: https://wa.me/${t.whatsapp}` : "",
    t.telefone ? `- Telefone: ${t.telefone}` : "",
    t.emailContato ? `- E-mail: ${t.emailContato}` : "",
    endereco ? `- Endereço: ${endereco}` : "",
    t.horario ? `- Horário: ${t.horario}` : "",
    t.razaoSocial ? `- Razão social: ${t.razaoSocial}` : "",
    "",
    "## Categorias principais",
    ...categorias.slice(0, 30).map((c) => `- [${c.nome}](${base}/categoria/${c.slug})${c.seoDescription ?? c.descricao ? `: ${(c.seoDescription ?? c.descricao ?? "").slice(0, 120)}` : ""}`),
    ...(destaques.length
      ? ["", "## Destaques", ...destaques.map((p) => `- [${p.nome}](${base}/produtos/${p.slug})${p.precoCentavos > 0 ? `: ${formatarBRL(p.precoCentavos)}` : ": preço sob consulta"}`)]
      : []),
    "",
    "## Políticas",
    `- [Envio e retirada](${base}/politicas/envio)`,
    `- [Trocas e devoluções](${base}/politicas/devolucao)`,
    `- [Privacidade](${base}/politicas/privacidade)`,
    `- [Termos de uso](${base}/politicas/termos)`,
    "",
    "## Optional",
    `- [Sitemap](${base}/sitemap.xml): todas as páginas públicas`,
    `- [Catálogo completo em texto](${base}/llms-full.txt): todos os produtos publicados, com preço`,
    vende ? `- [Feed do Google Merchant](${base}/feed/merchant.xml)` : "",
  ];

  return new Response(linhas.filter((l) => l !== "").join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
