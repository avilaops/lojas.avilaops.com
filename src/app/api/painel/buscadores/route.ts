import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { avisarERegistrar, chaveIndexNow } from "@/lib/indexnow";
import { CONDICAO_PUBLICAVEL } from "@/lib/produto-regras";
import { urlDaLoja } from "@/lib/tenant";

/** GET — situação da indexação da loja (o que o painel mostra na aba Buscadores). */
export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const base = urlDaLoja(loja);
  const [produtos, categorias] = await Promise.all([
    // A mesma régua do sitemap: produto sem foto e sem preço não é página
    // publicada, e contá-lo aqui fazia a tela prometer mais do que o Google vê.
    prisma.produto.count({ where: { tenantId: loja.id, ...CONDICAO_PUBLICAVEL } }),
    prisma.categoria.count({ where: { tenantId: loja.id } }),
  ]);
  return Response.json({
    base,
    paginas: produtos + categorias + 6,
    indexadoEm: loja.indexadoEm?.toISOString() ?? null,
    chaveIndexNow: chaveIndexNow(loja.slug),
    verificacaoGoogle: loja.verificacaoGoogle,
    verificacaoBing: loja.verificacaoBing,
    recursos: {
      sitemap: `${base}/sitemap.xml`,
      robots: `${base}/robots.txt`,
      feedMerchant: `${base}/feed/merchant.xml`,
      llms: `${base}/llms.txt`,
      chave: `${base}/indexnow-key.txt`,
    },
  });
}

const Entrada = z.object({
  verificacaoGoogle: z.string().trim().max(120).nullable().optional(),
  verificacaoBing: z.string().trim().max(120).nullable().optional(),
});

/** PATCH — grava os códigos de verificação do Search Console / Bing Webmaster. */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Código inválido." }, { status: 422 });
  // Aceita a tag inteira colada do painel do buscador: extraímos o content.
  const limpar = (v?: string | null) => {
    if (v == null) return null;
    const m = v.match(/content=["']([^"']+)["']/i);
    return (m ? m[1] : v).trim() || null;
  };
  await prisma.tenant.update({
    where: { id: loja.id },
    data: {
      ...(r.data.verificacaoGoogle !== undefined ? { verificacaoGoogle: limpar(r.data.verificacaoGoogle) } : {}),
      ...(r.data.verificacaoBing !== undefined ? { verificacaoBing: limpar(r.data.verificacaoBing) } : {}),
    },
  });
  return Response.json({ ok: true });
}

/** POST — "avisar buscadores agora": manda tudo o que existe para o IndexNow. */
export async function POST() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;
  const [produtos, categorias] = await Promise.all([
    prisma.produto.findMany({ where: { tenantId: loja.id, ...CONDICAO_PUBLICAVEL }, select: { slug: true } }),
    prisma.categoria.findMany({ where: { tenantId: loja.id }, select: { slug: true } }),
  ]);
  const caminhos = [
    "/", "/produtos", "/sobre", "/contato", "/politicas/envio", "/politicas/devolucao", "/politicas/privacidade",
    ...categorias.map((c) => `/categoria/${c.slug}`),
    ...produtos.map((p) => `/produtos/${p.slug}`),
  ];
  const r = await avisarERegistrar(loja, caminhos);
  if (!r.enviado) return Response.json({ erro: "O aviso aos buscadores está desligado para esta loja." }, { status: 409 });
  if (r.aceitos === 0) return Response.json({ erro: "Os buscadores não aceitaram o aviso agora. Tente de novo em alguns minutos." }, { status: 502 });
  return Response.json({ ok: true, urls: r.urls });
}
