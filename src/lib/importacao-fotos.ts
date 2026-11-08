import { z } from "zod";

/** Somente mídia de catálogos oficiais revisados; novos fornecedores exigem revisão. */
const HOSTS = new Set(["kr-wheels.com", "brwrodas.com.br", "www.zunkyrodas.com", "www.motorcrazy.com.br"]);
function oficial(valor: string, imagem = false) {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && HOSTS.has(url.hostname) && (!imagem || (url.pathname.includes("/wp-content/uploads/") && /\.(png|jpe?g|webp)$/i.test(url.pathname)));
  } catch { return false; }
}
export const ImportacaoFotosSchema = z.object({
  produtoId: z.string().min(1),
  sku: z.string().min(1),
  nome: z.string().min(1),
  versaoCatalogo: z.number().int().positive(),
  imagemUrl: z.string().url().refine(valor => oficial(valor, true), "Use uma foto raster do catálogo oficial revisado."),
  pagina: z.string().url().refine(valor => oficial(valor), "Informe a página oficial revisada."),
  familia: z.string().trim().min(3).max(40),
  criterio: z.string().trim().min(10).max(500),
}).strict();
