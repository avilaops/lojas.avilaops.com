import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Processamento de imagem com o `sharp` (já vem com o Next). Sem ele
 * disponível (ex.: binário da plataforma ausente), tudo cai no "sem
 * processamento": a imagem original é servida , nunca falha o upload.
 *
 * Produção: o Dockerfile de runtime instala o sharp para linux-x64.
 */
type Sharp = typeof import("sharp").default;
let sharpMod: Sharp | null | undefined;

async function sharp(): Promise<Sharp | null> {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default;
  } catch {
    console.warn("[imagens] sharp indisponível: imagens sem otimização");
    sharpMod = null;
  }
  return sharpMod;
}

export const LARGURA_MAXIMA = 1600;
export const LARGURAS_PERMITIDAS = new Set([160, 320, 480, 800, 1200]);

/** Otimiza um raster ao entrar: limita a 1600 px e converte para WebP (alpha preservado). */
export async function otimizarAoEntrar(bytes: Buffer, ext: string): Promise<{ bytes: Buffer; ext: string }> {
  if (ext === "svg" || ext === "gif") return { bytes, ext };
  const s = await sharp();
  if (!s) return { bytes, ext };
  try {
    const out = await s(bytes, { failOn: "none" }).rotate().resize({ width: LARGURA_MAXIMA, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer();
    return { bytes: out, ext: "webp" };
  } catch (erro) {
    console.warn("[imagens] falha ao otimizar, mantendo original:", erro);
    return { bytes, ext };
  }
}

/**
 * Variante redimensionada, gerada uma vez e guardada ao lado do original
 * (`nome.w480.webp`). Devolve null quando não dá para gerar (SVG, sharp ausente).
 */
export async function variante(arquivo: string, largura: number): Promise<Buffer | null> {
  if (!LARGURAS_PERMITIDAS.has(largura)) return null;
  const ext = path.extname(arquivo).slice(1).toLowerCase();
  if (ext === "svg") return null;
  const destino = `${arquivo}.w${largura}.webp`;
  try {
    await access(destino);
    return readFile(destino);
  } catch {
    /* ainda não existe */
  }
  const s = await sharp();
  if (!s) return null;
  try {
    const out = await s(await readFile(arquivo), { failOn: "none" }).resize({ width: largura, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, out);
    return out;
  } catch {
    return null;
  }
}
