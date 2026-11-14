import { lerArquivoLoja } from "./arquivos-loja";
import { MIME_POR_EXT } from "./uploads-arquivos";

type MarcaSchema = {
  slug: string;
  origem: string;
  logo: string | null;
  origemPlataforma?: string;
};

/** Metadado opcional: só anuncia uploads gerenciados que ainda existem. */
export async function logoPublicoParaSchema(
  { slug, origem, logo, origemPlataforma = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}` }: MarcaSchema,
  ler: (chave: string) => Promise<Buffer> = lerArquivoLoja,
): Promise<string | null> {
  if (!logo?.trim()) return null;
  let url: URL;
  try {
    url = new URL(logo, origem);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    const gerenciado = [new URL(origem).hostname, new URL(origemPlataforma).hostname].includes(url.hostname);
    if (!gerenciado || (url.pathname !== "/uploads" && !url.pathname.startsWith("/uploads/"))) return url.href;
    if (url.port) return null;
  } catch { return null; }
  const partes = url.pathname.match(/^\/uploads\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9.-]*)$/i);
  if (!partes || partes[1] !== slug || partes[2].includes("..")) return null;
  const mime = MIME_POR_EXT[partes[2].split(".").pop()?.toLowerCase() ?? ""];
  if (!mime?.startsWith("image/")) return null;
  try {
    return (await ler(`${slug}/${partes[2]}`)).length ? url.href : null;
  } catch {
    // Não muda a resposta operacional da rota /uploads. Na ausência de prova,
    // omite apenas o logo opcional; a prévia OG mantém sua própria regra.
    return null;
  }
}
