import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { otimizarAoEntrar } from "./imagens";

/**
 * Fotos de produto e logo. Ficam em disco (volume /opt/lojas/uploads no
 * Hetzner), por loja, e são servidas por /uploads/<slug>/<arquivo> no
 * domínio-base da plataforma — uma URL absoluta que funciona em qualquer
 * domínio de loja.
 *
 * Só imagem, até 5 MB, tipo conferido pelos bytes (não pela extensão que o
 * navegador mandou).
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
const LIMITE = 5 * 1024 * 1024;
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

export class UploadInvalido extends Error {}

function tipoPelosBytes(b: Buffer): { ext: string; mime: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (b.length > 5 && b.toString("ascii", 0, 6).startsWith("GIF8")) return { ext: "gif", mime: "image/gif" };
  const inicio = b.toString("utf8", 0, Math.min(b.length, 300)).trimStart().toLowerCase();
  if (inicio.startsWith("<svg") || (inicio.startsWith("<?xml") && inicio.includes("<svg"))) return { ext: "svg", mime: "image/svg+xml" };
  return null;
}

/** Grava bytes já prontos (ex.: recorte do removedor de fundo). */
export async function salvarBytes(slug: string, bytes: Buffer, ext: string): Promise<{ url: string; caminho: string }> {
  const nome = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  const pasta = path.join(UPLOADS_DIR, slug);
  await mkdir(pasta, { recursive: true });
  await writeFile(path.join(pasta, nome), bytes);
  return { url: `https://${BASE}/uploads/${slug}/${nome}`, caminho: `${slug}/${nome}` };
}

export async function salvarImagem(slug: string, arquivo: File): Promise<{ url: string; caminho: string }> {
  if (arquivo.size > LIMITE) throw new UploadInvalido("Imagem acima de 5 MB.");
  const original = Buffer.from(await arquivo.arrayBuffer());
  const tipo = tipoPelosBytes(original);
  if (!tipo) throw new UploadInvalido("Envie PNG, JPG, WEBP, GIF ou SVG.");
  // Raster entra otimizado (≤1600 px, WebP); SVG/GIF ficam como vieram.
  const { bytes, ext } = await otimizarAoEntrar(original, tipo.ext);
  // SVG pode carregar script; serve-se com Content-Security-Policy (ver rota /uploads).
  const nome = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  const pasta = path.join(UPLOADS_DIR, slug);
  await mkdir(pasta, { recursive: true });
  await writeFile(path.join(pasta, nome), bytes);
  return { url: `https://${BASE}/uploads/${slug}/${nome}`, caminho: `${slug}/${nome}` };
}

export const MIME_POR_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };
