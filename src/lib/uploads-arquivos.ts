import path from "node:path";

/**
 * Onde as fotos moram e com que tipo saem. Módulo leve de propósito: a rota
 * `/uploads` só precisa disto para servir um arquivo que já está em disco.
 *
 * Em 28/09/2026 a rota importava `@/lib/uploads`, que puxa o removedor de fundo
 * (`sharp` e `onnxruntime-node` carregados no topo do módulo). Quando o binário
 * nativo do ONNX não carregou no container, a rota inteira passou a responder
 * 500 — inclusive para foto existente e para caminho que devia dar 404 — e a
 * vitrine ficou com as imagens quebradas fora do cache da borda. Servir foto
 * não pode depender do removedor de fundo.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

/**
 * O `ico` e o `webmanifest` não são foto de produto: entram porque o ícone da
 * loja mora aqui, junto do resto do que é dela. Sem eles a rota devolve 404 e
 * o navegador fica com o ícone padrão.
 */
export const MIME_POR_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  webmanifest: "application/manifest+json",
};
