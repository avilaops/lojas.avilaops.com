import { tenantAtual, urlDaLoja } from "@/lib/tenant";
import { prisma } from "@/lib/db";

/**
 * Feed de produtos para o Google Merchant Center (RSS 2.0 + namespace g:),
 * por loja: https://<loja>/feed/merchant.xml. O lojista cadastra essa URL
 * uma vez no Merchant Center e passa a aparecer no Google Shopping sem custo.
 * Produtos com variações viram um item por variação (item_group_id = produto).
 */
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const preco = (c: number) => `${(c / 100).toFixed(2)} BRL`;

export async function GET() {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return new Response("não", { status: 404 });
  const base = urlDaLoja(t);
  const produtos = await prisma.produto.findMany({ where: { tenantId: t.id, ativo: true }, include: { categoria: true, variantes: { where: { ativo: true } } }, orderBy: { nome: "asc" } });

  const itens: string[] = [];
  for (const p of produtos) {
    const comum = (id: string, titulo: string, precoCentavos: number, disponivel: boolean, imagem: string | undefined, extra = "") => `
    <item>
      <g:id>${esc(id)}</g:id>
      <g:title>${esc(titulo.slice(0, 150))}</g:title>
      <g:description>${esc((p.descricaoCurta ?? p.descricao ?? p.nome).slice(0, 5000))}</g:description>
      <g:link>${esc(`${base}/produtos/${p.slug}`)}</g:link>
      ${imagem ? `<g:image_link>${esc(imagem)}</g:image_link>` : ""}
      ${p.imagens.slice(1, 10).map((i) => `<g:additional_image_link>${esc(i)}</g:additional_image_link>`).join("")}
      <g:availability>${disponivel ? "in_stock" : p.disponibilidade === "backorder" ? "backorder" : "out_of_stock"}</g:availability>
      <g:price>${preco(p.precoDeCentavos && p.precoDeCentavos > precoCentavos ? p.precoDeCentavos : precoCentavos)}</g:price>
      ${p.precoDeCentavos && p.precoDeCentavos > precoCentavos ? `<g:sale_price>${preco(precoCentavos)}</g:sale_price>` : ""}
      <g:condition>new</g:condition>
      ${p.marca ? `<g:brand>${esc(p.marca)}</g:brand>` : ""}
      ${p.gtin ? `<g:gtin>${esc(p.gtin)}</g:gtin>` : ""}
      ${p.codigoOriginal ? `<g:mpn>${esc(p.codigoOriginal)}</g:mpn>` : ""}
      ${!p.gtin && !p.codigoOriginal ? "<g:identifier_exists>no</g:identifier_exists>" : ""}
      ${p.categoria ? `<g:product_type>${esc(p.categoria.nome)}</g:product_type>` : ""}
      ${p.pesoKg != null ? `<g:shipping_weight>${p.pesoKg} kg</g:shipping_weight>` : ""}
      ${extra}
    </item>`;

    if (p.opcoes.length && p.variantes.length) {
      for (const v of p.variantes) {
        const valores = v.valores as Record<string, string>;
        const extra = `<g:item_group_id>${esc(p.id)}</g:item_group_id>` + p.opcoes.map((o) => {
          const chave = /tamanho|size/i.test(o) ? "g:size" : /cor|color/i.test(o) ? "g:color" : /material/i.test(o) ? "g:material" : null;
          return chave && valores[o] ? `<${chave}>${esc(valores[o])}</${chave}>` : "";
        }).join("");
        itens.push(comum(`${p.id}:${v.id}`, `${p.nome} · ${v.nome}`, v.precoCentavos ?? p.precoCentavos, (v.estoque == null || v.estoque > 0) && p.disponibilidade !== "out_of_stock", v.imagem ?? p.imagens[0], extra));
      }
    } else {
      itens.push(comum(p.id, p.nome, p.precoCentavos, p.disponibilidade !== "out_of_stock" && (p.estoque == null || p.estoque > 0), p.imagens[0]));
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(t.nome)}</title>
    <link>${esc(base)}</link>
    <description>${esc(t.slogan ?? `Produtos da ${t.nome}`)}</description>${itens.join("")}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
