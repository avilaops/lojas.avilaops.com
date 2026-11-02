import { exigir } from "@/lib/operadores";
import { salvarBytes } from "@/lib/uploads";
import sharp from "sharp";

export const runtime = "nodejs";
const MAX_INPUT = 2 * 1024 * 1024;
const MAX_OUTPUT = 12 * 1024 * 1024;

/** Amplia uma imagem de catálogo usando o worker ONNX CPU privado. */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const endpoint = process.env.LOJAS_UPSCALE_WORKER_URL;
  const token = process.env.LOJAS_UPSCALE_WORKER_TOKEN;
  if (!endpoint || !token) return Response.json({ erro: "Ampliação por IA indisponível." }, { status: 503 });
  // URL fixa de configuração, sem aceitar destinos fornecidos pelo cliente.
  let url: URL;
  try {
    url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error("URL inválida");
  } catch { return Response.json({ erro: "Worker mal configurado." }, { status: 503 }); }
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_INPUT + 8192) return Response.json({ erro: "Imagem acima de 2 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("arquivo");
  if (!(file instanceof File) || !file.size || file.size > MAX_INPUT)
    return Response.json({ erro: "Envie uma imagem PNG, JPG ou WebP de até 2 MB." }, { status: 422 });
  const original = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(original, { limitInputPixels: 1_000_000 }).metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format ?? "") || !meta.width || !meta.height ||
        meta.width > 512 || meta.height > 512 || meta.width * meta.height > 262144)
      return Response.json({ erro: "Use PNG, JPG ou WebP com no máximo 512 × 512 pixels." }, { status: 422 });
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/octet-stream" },
      body: original,
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[ampliar] worker", res.status);
      return Response.json({ erro: "Não foi possível ampliar a imagem." }, { status: 503 });
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_OUTPUT)
      return Response.json({ erro: "Resultado excede o limite." }, { status: 502 });
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_OUTPUT) return Response.json({ erro: "Resultado excede o limite." }, { status: 502 });
    const out = await sharp(bytes).metadata();
    if (out.format !== "webp" || out.width !== meta.width * 4 || out.height !== meta.height * 4)
      return Response.json({ erro: "Resultado inválido." }, { status: 502 });
    const saved = await salvarBytes(s.tenant.slug, bytes, "webp");
    return Response.json({ url: saved.url, ampliada: true, escala: 4 });
  } catch (error) {
    console.error("[ampliar]", error instanceof Error ? error.name : "unknown");
    return Response.json({ erro: "Ampliação indisponível. Tente novamente." }, { status: 503 });
  }
}
