export type SitePublico = "plataforma" | "loja";
export type FormatoPublico = "md" | "mdx";

const PLATAFORMA = new Set(["/", "/ajuda", "/marca", "/termos-comerciais", "/developers", "/developers/privacidade", "/blog"]);
const LOJA = new Set(["/", "/produtos", "/sobre", "/contato", "/promocoes", "/blog", "/guias", "/aplicacoes", "/como-escolher", "/cotacao", "/cotacao-lote", "/configurador"]);

function normalizarCaminho(valor: string): string | null {
  if (!valor.startsWith("/") || /[\\\u0000-\u0020?#]/.test(valor) || /%(?:2f|5c)/i.test(valor)) return null;
  try {
    const caminho = decodeURIComponent(valor);
    // Recusar outra codificação e dot-segments antes da decisão de acesso.
    if (/[\\%\u0000-\u0020?#]/.test(caminho) || caminho.includes("//")) return null;
    if (caminho.split("/").some(segmento => segmento === "." || segmento === "..")) return null;
    return caminho.length > 1 ? caminho.replace(/\/$/, "") : caminho;
  } catch {
    return null;
  }
}

export function rotaPublicavel(caminhoBruto: string, site: SitePublico): boolean {
  const caminho = normalizarCaminho(caminhoBruto);
  if (!caminho) return false;
  if ((site === "plataforma" ? PLATAFORMA : LOJA).has(caminho)) return true;
  const padrao = site === "plataforma" ? /^\/blog\/([\p{L}\p{N}._~-]+)$/u : /^\/(produtos|categoria|politicas|blog|guias|aplicacoes)\/([\p{L}\p{N}._~-]+)$/u;
  return padrao.test(caminho);
}

export function lerCaminhoTexto(valor: string, site: SitePublico): { caminhoHtml: string; formato: FormatoPublico } | null {
  const caminho = normalizarCaminho(valor);
  const partes = caminho?.match(/^(.*?)\/index\.(md|mdx)$/i);
  if (!partes) return null;
  const caminhoHtml = partes[1] || "/";
  return rotaPublicavel(caminhoHtml, site) ? { caminhoHtml, formato: partes[2].toLowerCase() as FormatoPublico } : null;
}

/** O Next pode manter a URL original no manipulador após a reescrita. */
export function caminhoTextoDaRequisicao(pathname: string, parametro: string | null): string {
  return /\/index\.(?:md|mdx)$/i.test(pathname) ? pathname : parametro ?? "";
}

export function caminhosPublicosDeTexto(caminho: string) {
  const base = caminho === "/" ? "/index" : `${encodeURI(caminho)}/index`;
  return { md: `${base}.md`, mdx: `${base}.mdx` };
}

export function linksDeTexto(caminho: string, site: SitePublico): string | null {
  if (!rotaPublicavel(caminho, site)) return null;
  const textos = caminhosPublicosDeTexto(normalizarCaminho(caminho)!);
  return `<${textos.md}>; rel="alternate"; type="text/markdown", <${textos.mdx}>; rel="alternate"; type="text/mdx", </llms.txt>; rel="describedby"`;
}

/** Reutiliza os links já publicados pelo índice, sem consultar o catálogo. */
export function adicionarDescobertaTexto(indice: string, origem: string, site: SitePublico): string {
  const base = new URL(origem);
  const encontrados = new Map<string, string>();
  for (const link of indice.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    try {
      const url = new URL(link[2]);
      if (url.origin !== base.origin || url.search || !rotaPublicavel(url.pathname, site)) continue;
      const caminho = normalizarCaminho(url.pathname)!;
      if (!encontrados.has(caminho)) encontrados.set(caminho, link[1]);
    } catch {
      // Um link editorial inválido não cria uma rota alternativa.
    }
  }
  if (!encontrados.size) return indice;
  const linhas = [...encontrados].map(([caminho, titulo]) => {
    const textos = caminhosPublicosDeTexto(caminho);
    return `- [${titulo} • Markdown](${base.origin}${textos.md}) • [MDX](${base.origin}${textos.mdx})`;
  });
  return `${indice.trimEnd()}\n\n## Versões em Markdown e MDX\n\n${linhas.join("\n")}\n`;
}
