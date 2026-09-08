import { POSTS } from "../src/lib/blog";
import sharp from "sharp";

/** Confere o HTML entregue aos robôs e o arquivo real de cada capa publicada. */
const base = process.env.BLOG_BASE_URL || "https://lojas.avilaops.com";
async function conferir() {
  for (const post of POSTS.filter((p) => p.publicadoEm <= new Date().toISOString().slice(0, 10))) {
    const resposta = await fetch(`${base}/blog/${post.slug}`, { headers: { "User-Agent": "facebookexternalhit/1.1" } });
    const html = await resposta.text();
    const imagem = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    const twitter = html.match(/<meta name="twitter:image" content="([^"]+)"/)?.[1];
    if (!resposta.ok || !imagem || imagem !== twitter || !imagem.endsWith(post.capa || "INEXISTENTE")) throw new Error(`Metadados inválidos: ${post.slug}`);
    const arquivo = await fetch(imagem);
    const dados = Buffer.from(await arquivo.arrayBuffer());
    const dimensoes = await sharp(dados).metadata();
    if (!arquivo.ok || !arquivo.headers.get("content-type")?.includes("image/jpeg") || dimensoes.width !== 1200 || dimensoes.height !== 630) throw new Error(`Capa inválida: ${post.slug}`);
    console.log(JSON.stringify({ slug: post.slug, status: resposta.status, imagem, largura: dimensoes.width, altura: dimensoes.height, bytes: dados.length }));
  }
}
conferir().catch((erro: unknown) => { console.error(erro); process.exitCode = 1; });
