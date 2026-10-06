import { headers } from "next/headers";
import { identidadeDa, tenantAtual, urlDaLoja } from "@/lib/tenant";
import { listarCategorias, listarProdutos } from "@/lib/catalogo";
import { emEstoque, publicavel } from "@/lib/produto-regras";

export const dynamic = "force-dynamic";

function resposta(texto: string, status = 200) {
  return new Response(texto, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

export async function GET() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === baseDomain) {
    return resposta(`# Lojas Avila Ops

## Resumo

Lojas Avila Ops é uma plataforma brasileira para criar e operar lojas virtuais com identidade própria. Reúne domínio, hospedagem, SSL, e-mail profissional, catálogo, checkout, frete e automações em uma jornada única.

## Público

Pequenas empresas e operações comerciais que precisam vender online sem montar e manter várias ferramentas separadas.

## Planos

- Site, R$ 110/mês: vitrine, catálogo, contato, pedidos pelo WhatsApp, domínio, SSL, hospedagem e e-mail profissional.
- Loja, R$ 269/mês (o mais escolhido): tudo do Site + carrinho, Pix na hora, cartão e boleto no próprio checkout, frete por CEP e retirada, cupons, variações, estoque, feed do Google Shopping, carrinho abandonado, avaliações e relatório semanal. Sem comissão sobre venda.
- Loja Pro, R$ 497/mês: tudo da Loja + domínio próprio, chave de API e assistente de IA, cotação B2B pelo WhatsApp e prioridade de suporte.
- Setup único: R$ 497. 7 dias de teste, sem cartão. Mensalidade começa quando o lojista ativa a cobrança.

## Pagamentos

Pagamento pelo Mercado Pago (Pix, cartão e boleto) na conta da própria empresa: o dinheiro não passa pela Avila Ops e não há comissão sobre venda.

## Tecnologia e operação

- Aplicação multi-tenant em Next.js e TypeScript.
- DNS, SSL e proteção com Cloudflare e infraestrutura própria.
- Eventos operacionais conectados a fluxos n8n.
- WhatsApp integrado às jornadas de venda e relacionamento.
- Diagnóstico de marca com direção visual, voz e fotografia persistentes.
- Temas profissionais responsivos: Clássico, Vitrine, Editorial e Minimal.

## Rotas públicas

- Página principal: https://${baseDomain}
- Criar uma loja: https://${baseDomain}/criar
- Loja de demonstração: https://demo.${baseDomain}
- Sitemap: https://${baseDomain}/sitemap.xml

## Contato institucional

Avila Ops: https://avilaops.com
`);
  }

  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return resposta("Loja não encontrada.\n", 404);
  const base = urlDaLoja(t);
  const identidade = identidadeDa(t);
  // É o "full" da especificação: o catálogo inteiro em texto. Mas só o que é
  // publicável (foto ou preço): cadastro de referência não descreve a loja.
  const [categorias, todos] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id)]);
  const produtos = todos.filter(publicavel);
  const linhasCategorias = categorias.length
    ? categorias.map((c) => `- [${c.nome}](${base}/categoria/${c.slug})${c.seoDescription ?? c.descricao ? `: ${c.seoDescription ?? c.descricao}` : ""}`).join("\n")
    : "- Nenhuma categoria publicada.";
  const linhasProdutos = produtos.length
    ? produtos.map((p) => `- [${p.nome}](${base}/produtos/${p.slug}): ${p.precoCentavos > 0 ? `R$ ${(p.precoCentavos / 100).toFixed(2).replace(".", ",")}` : "preço sob consulta"}${!emEstoque(p) ? " (esgotado)" : ""}${p.marca ? ` · ${p.marca}` : ""}`).join("\n")
    : "- Nenhum produto publicado.";

  return resposta(`# ${t.nome}

> ${t.slogan ?? `Loja virtual ${t.nome}`}

## Sobre

${t.sobre || identidade.diferencial || "Catálogo e canais de atendimento da loja."}

## Identidade da marca

- Segmento: ${identidade.segmento}
- Personalidade: ${identidade.personalidade.join(", ")}
- Tom de voz: ${identidade.tomDeVoz}
- Público: ${identidade.publico || "Não informado"}
- Direção fotográfica: ${identidade.direcaoFotografica || "Não informada"}

## Categorias

${linhasCategorias}

## Produtos

${linhasProdutos}

## Páginas e políticas

- [Catálogo completo](${base}/produtos)
- [Sobre a loja](${base}/sobre)
- [Contato](${base}/contato)
- [Envio e retirada](${base}/politicas/envio)
- [Trocas e devoluções](${base}/politicas/devolucao)
- [Privacidade](${base}/politicas/privacidade)
`);
}
