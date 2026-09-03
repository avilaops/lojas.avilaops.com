import sharp from "sharp";
import { readdir, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const ORIGEM = process.argv[2];
const DESTINO = process.argv[3];
await mkdir(DESTINO, { recursive: true });

async function converter(entrada, nomeSaida) {
  const bytes = await readFile(entrada);
  const out = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  await writeFile(path.join(DESTINO, nomeSaida), out);
  const meta = await sharp(out).metadata();
  console.log(`${nomeSaida} ${meta.width}x${meta.height} ${(out.length / 1024).toFixed(0)} KB (de ${(bytes.length / 1024).toFixed(0)} KB)`);
}

for (const pasta of ["categorias", "banners"]) {
  for (const nome of (await readdir(path.join(ORIGEM, pasta))).filter((n) => n.endsWith(".png")).sort()) {
    await converter(path.join(ORIGEM, pasta, nome), nome.replace(/\.png$/, ".webp"));
  }
}
