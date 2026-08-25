import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { MIME_POR_EXT, UPLOADS_DIR } from "@/lib/uploads";

/** Serve as imagens enviadas pelo painel. Cache longo: o nome do arquivo é único. */
export async function GET(_request: Request, { params }: { params: Promise<{ caminho: string[] }> }) {
  const { caminho } = await params;
  // Só <slug>/<arquivo>: nada de ".." nem subpastas.
  if (caminho.length !== 2 || caminho.some((p) => !/^[a-z0-9][a-z0-9.-]*$/i.test(p) || p.includes(".."))) return new Response("não", { status: 404 });
  const ext = caminho[1].split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_POR_EXT[ext];
  if (!mime) return new Response("não", { status: 404 });

  const arquivo = path.join(UPLOADS_DIR, caminho[0], caminho[1]);
  try {
    const info = await stat(arquivo);
    if (!info.isFile()) throw new Error();
    const corpo = await readFile(arquivo);
    return new Response(corpo, {
      headers: {
        "content-type": mime,
        "content-length": String(info.size),
        "cache-control": "public, max-age=31536000, immutable",
        ...(mime === "image/svg+xml" ? { "content-security-policy": "script-src 'none'; style-src 'unsafe-inline'", "x-content-type-options": "nosniff" } : {}),
      },
    });
  } catch {
    return new Response("não", { status: 404 });
  }
}
