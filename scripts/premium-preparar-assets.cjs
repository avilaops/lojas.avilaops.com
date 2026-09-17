/**
 * Converte as artes de uma loja para o formato que o template Automotivo
 * Premium serve (WebP, largura máxima por peça), em `public/media/automotivo-premium`.
 *
 *   PREMIUM_ORIGEM=../Websites/brilhax.com/public \
 *   PREMIUM_EDITORIAL=/caminho/para/editorial.png \
 *   node scripts/premium-preparar-assets.cjs
 *
 * A primeira versão tinha a pasta da Brilhax e um PNG do
 * `C:/Users/nicol/...` escritos no meio do código: só rodava na máquina de
 * quem montou a primeira loja premium. Os caminhos agora entram por variável
 * de ambiente, e o que falta o script diz em vez de estourar.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const DESTINO = path.resolve('public/media/automotivo-premium');

/** Nome de saída → [caminho dentro da origem, largura máxima]. */
const PECAS = {
  'hero-v1.webp': ['images/hero-studio-v2.png', 1800],
  'simbolo-claro-v1.webp': ['brand/logo-light.jpg', 128],
  'simbolo-escuro-v1.webp': ['brand/logo-dark.jpg', 128],
  ...Object.fromEntries(['lavagem', 'polimento', 'vitrificacao', 'protecao', 'acessorios', 'kits', 'moto']
    .map((c) => [`categoria-${c}-v1.webp`, [`images/categorias/${c}.jpg`, 640]])),
};

async function converter(entrada, saida, largura, qualidade) {
  if (fs.existsSync(saida)) return;
  if (!fs.existsSync(entrada)) { console.warn('faltando:', entrada); return; }
  await sharp(entrada).resize({ width: largura, withoutEnlargement: true }).webp({ quality: qualidade }).toFile(saida);
  console.log(path.basename(saida), fs.statSync(saida).size);
}

async function main() {
  const origem = process.env.PREMIUM_ORIGEM;
  if (!origem) throw new Error('Defina PREMIUM_ORIGEM com a pasta public/ da loja de origem.');
  fs.mkdirSync(DESTINO, { recursive: true });

  for (const [nome, [src, largura]] of Object.entries(PECAS)) {
    await converter(path.resolve(origem, src), path.join(DESTINO, nome), largura, 86);
  }

  const editorial = process.env.PREMIUM_EDITORIAL;
  if (editorial) await converter(path.resolve(editorial), path.join(DESTINO, 'editorial-cuidado-v1.webp'), 1200, 85);
  else console.warn('sem PREMIUM_EDITORIAL: a imagem editorial fica a cargo do painel (aba Marca).');
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
