import path from "node:path";

/**
 * Onde os arquivos enviados moram e com que tipo saem — só isso, sem
 * dependência nativa.
 *
 * A rota que **serve** `/uploads/...` importava estas duas constantes de
 * `uploads.ts`, que também **processa** o envio e por isso carrega o
 * removedor de fundo (`sharp` + `onnxruntime-node`, estáticos). Quando o
 * binding do ONNX não carregou no container, o módulo inteiro falhou e toda
 * imagem de toda loja passou a responder 500 — logo, foto e ilustração —,
 * inclusive caminho inválido, que devolve 404 antes de tocar no disco.
 * Servir arquivo não pode depender de saber recortar fundo.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

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
