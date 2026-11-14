import { lerArquivoLoja } from "./arquivos-loja";

type MarcaPublica = { slug: string; caminho: string | null; origem: string };
type LerMarca = (chave: string) => Promise<Buffer>;
const LIMITE_BYTES = 1024 * 1024;
const LIMITE_PIXELS = 4096 * 4096;

/** Mapeia apenas imagem pública do namespace do tenant; nunca consulta uma URL. */
function chaveDaMarca({ slug, caminho, origem }: MarcaPublica): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) || !caminho || caminho.length > 1024 || /[\s\\%?#]/.test(caminho) || caminho.includes("..")) return null;
  let publico = caminho;
  try {
    const base = new URL(origem);
    if (base.protocol !== "https:" || base.username || base.password || base.port || base.pathname !== "/" || base.search || base.hash) return null;
    if (caminho.startsWith("https://")) {
      const url = new URL(caminho);
      if (url.origin !== base.origin || url.username || url.password) return null;
      publico = url.pathname;
    }
  } catch { return null; }
  const partes = publico.match(/^\/uploads\/([a-z0-9][a-z0-9-]{0,62})\/([a-z0-9][a-z0-9._-]{0,200}\.(?:png|jpe?g|webp))$/i);
  return partes && partes[1] === slug ? `${slug}/${partes[2]}` : null;
}

function formatoDosBytes(bytes: Buffer): "png" | "jpeg" | "webp" | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/** I/O exclusivo da rota OG. A ausência de marca conserva seu fallback visual. */
export async function carregarMarcaDaPrevia(dados: MarcaPublica, ler: LerMarca = lerArquivoLoja): Promise<string | null> {
  const chave = chaveDaMarca(dados);
  if (!chave) return null;
  try {
    // O leitor existente limita o stream remoto a 12 MiB; só 1 MiB é aceito para decodificação da marca.
    const bytes = await ler(chave);
    if (!bytes.length || bytes.length > LIMITE_BYTES) return null;
    const formato = formatoDosBytes(bytes);
    const extensao = chave.split(".").pop()?.toLowerCase();
    if (!formato || (formato === "jpeg" ? !["jpg", "jpeg"].includes(extensao ?? "") : extensao !== formato)) return null;
    const { default: sharp } = await import("sharp");
    const imagem = sharp(bytes, { limitInputPixels: LIMITE_PIXELS, animated: false });
    const metadata = await imagem.metadata();
    if (metadata.format !== formato || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || metadata.width * metadata.height > LIMITE_PIXELS || (metadata.pages ?? 1) > 1) return null;
    const png = await imagem.rotate().resize(180, 180, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    if (png.length > 256 * 1024) return null;
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}
