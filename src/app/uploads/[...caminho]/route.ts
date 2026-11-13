import path from "node:path";
import { MIME_POR_EXT, UPLOADS_DIR } from "@/lib/uploads-arquivos";
import { variante } from "@/lib/imagens";
import { lerArquivoLoja } from "@/lib/arquivos-loja";

/** Serve as imagens enviadas pelo painel. Cache longo: o nome do arquivo é único. */
export async function GET(request: Request, { params }: { params: Promise<{ caminho: string[] }> }) {
  const { caminho } = await params;
  // Só <slug>/<arquivo>: nada de ".." nem subpastas.
  if (caminho.length !== 2 || caminho.some((p) => !/^[a-z0-9][a-z0-9.-]*$/i.test(p) || p.includes(".."))) return new Response("não", { status: 404 });
  const ext = caminho[1].split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_POR_EXT[ext];
  if (!mime) return new Response("não", { status: 404 });

  const arquivo = path.join(UPLOADS_DIR, caminho[0], caminho[1]);
  try {
    // ?w=480 → variante redimensionada em WebP (gerada uma vez, guardada em disco).
    const w = Number(new URL(request.url).searchParams.get("w") ?? 0);
    if (w) {
      const v = await variante(arquivo, w);
      if (v) return new Response(new Uint8Array(v), { headers: { "content-type": "image/webp", "content-length": String(v.length), "cache-control": "public, max-age=31536000, immutable" } });
    }
    const corpo = await lerArquivoLoja(caminho.join("/"));
    return new Response(new Uint8Array(corpo), {
      headers: {
        "content-type": mime,
        "content-length": String(corpo.length),
        "cache-control": "public, max-age=31536000, immutable",
        ...(mime === "image/svg+xml" ? { "content-security-policy": "script-src 'none'; style-src 'unsafe-inline'", "x-content-type-options": "nosniff" } : {}),
      },
    });
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return new Response("não", { status: 404 });
    return new Response("Arquivo temporariamente indisponível.", { status: 503, headers: { "cache-control": "no-store" } });
  }
}
