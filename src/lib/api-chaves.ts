import { createHash, randomBytes } from "node:crypto";
import type { Plano, TenantStatus, TipoChaveApi } from "@prisma/client";

/**
 * As chaves da API para desenvolvedores: formato, escopos e quem pode tê-las.
 *
 * Tudo puro, sem banco: a rota (`api-rotas.ts`) e o painel decidem pelas mesmas
 * funções, e o teste prova as regras sem subir Postgres. Ver docs/API.md.
 *
 * Duas espécies, como em qualquer API de pagamento:
 *
 *   SECRETA     lojas_sk_…  mora no servidor do lojista (ERP, PDV, planilha).
 *                           Lê catálogo e pedidos, conforme os escopos.
 *   PUBLICAVEL  lojas_pk_…  pode ir no JavaScript de um site ou app. Só lê o
 *                           que a vitrine já mostra a qualquer visitante.
 *
 * A diferença não é de confiança no lojista, é de onde a chave vai parar:
 * chave que vai para o navegador é pública no instante em que é publicada.
 */

export const PREFIXO_CHAVE: Record<TipoChaveApi, string> = {
  SECRETA: "lojas_sk_",
  PUBLICAVEL: "lojas_pk_",
};

/**
 * O catálogo de escopos. Escopo novo é entrada aqui, junto com a rota que o
 * exige — não se declara escopo sem rota, porque chave criada hoje com um
 * escopo que ainda não faz nada ganharia poder em silêncio no deploy que
 * fizesse.
 */
export const ESCOPOS = {
  "loja:ler": "Dados da loja (nome, plano, endereço da vitrine)",
  "catalogo:ler": "Produtos e variações, inclusive inativos, com estoque",
  "catalogo:escrever": "Preço e estoque por SKU (o que o ERP sincroniza)",
  "pedidos:ler": "Pedidos com cliente, itens, valores e rastreio",
  "vitrine:ler": "O que a vitrine pública mostra: produtos ativos e dados da loja",
  // Escopo próprio, e não `catalogo:escrever`: chave que o lojista criou para o
  // ERP acertar preço e estoque não pode amanhecer podendo criar produto.
  "produtos:escrever": "Criar produto e editar o cadastro (nome, descrição, categoria, ativo)",
  "pedidos:escrever": "Avançar o pedido: separar, enviar com rastreio, entregar, cancelar",
  // Daqui para baixo, quem exige são as ferramentas do conector MCP
  // (`FERRAMENTAS` em mcp-permissoes.ts); a API `/api/v1` não tem rota para eles.
  "loja:escrever": "Marca, cores e layout da loja (conector MCP)",
  "clientes:ler": "Clientes da loja, com contato e histórico de compras (conector MCP)",
  "promocoes:ler": "Cupons de desconto (conector MCP)",
  "promocoes:escrever": "Criar e alterar cupons (conector MCP)",
  "analises:ler": "Resumo de vendas, origem das vendas e marketing (conector MCP)",
  "mcp:usar": "Usar esta chave no conector MCP (/api/mcp), dentro dos outros escopos marcados",
} as const;

export type Escopo = keyof typeof ESCOPOS;

/** O que a chave publicável pode, e nunca mais que isso: ela é pública por definição. */
export const ESCOPOS_PUBLICAVEL: readonly Escopo[] = ["vitrine:ler"];

/** Escopos que uma chave secreta pode receber; a vitrine vem junto sempre. */
export const ESCOPOS_SECRETA: readonly Escopo[] = [
  "loja:ler", "catalogo:ler", "catalogo:escrever", "pedidos:ler", "vitrine:ler",
  "produtos:escrever", "loja:escrever", "pedidos:escrever", "clientes:ler", "promocoes:ler", "promocoes:escrever", "analises:ler", "mcp:usar",
];

export function ehEscopo(v: string): v is Escopo {
  return Object.prototype.hasOwnProperty.call(ESCOPOS, v);
}

/**
 * Os escopos que a chave vai ter de fato.
 *
 * Publicável ignora o pedido e fica com a vitrine: aceitar "pedidos:ler" numa
 * chave que vai para o navegador seria entregar os pedidos a quem abrir o
 * DevTools. Secreta fica com o que pediu, dentro do permitido, mais a vitrine.
 */
export function escoposDaChave(tipo: TipoChaveApi, pedidos: readonly string[]): Escopo[] {
  if (tipo === "PUBLICAVEL") return [...ESCOPOS_PUBLICAVEL];
  const validos = new Set<Escopo>(pedidos.filter(ehEscopo).filter((e) => ESCOPOS_SECRETA.includes(e)));
  validos.add("vitrine:ler");
  return ESCOPOS_SECRETA.filter((e) => validos.has(e));
}

/** A loja está no ar? Suspensa continua com vitrine (sem checkout), então conta. */
export function lojaNoAr(status: TenantStatus): boolean {
  return status === "ATIVA" || status === "SUSPENSA";
}

/**
 * O plano permite este tipo de chave?
 *
 * Secreta segue a regra do conector MCP: é recurso do Loja Pro. Publicável
 * serve a qualquer plano, porque só lê o que a vitrine de qualquer plano já
 * publica: cobrar por ela seria cobrar pelo que o HTML da loja entrega de graça.
 */
export function planoPermite(tipo: TipoChaveApi, plano: Plano): boolean {
  return tipo === "PUBLICAVEL" || plano === "LOJA_PRO";
}

export function hashDaChave(chave: string): string {
  return createHash("sha256").update(chave).digest("hex");
}

export interface ChaveGerada {
  /** Mostrada uma vez, no momento da criação. Não é guardada. */
  chave: string;
  hash: string;
  prefixo: string;
  final: string;
}

/** 160 bits de acaso: sha256 sem sal basta, não há o que adivinhar por dicionário. */
export function gerarChave(tipo: TipoChaveApi): ChaveGerada {
  const chave = `${PREFIXO_CHAVE[tipo]}${randomBytes(20).toString("hex")}`;
  return {
    chave,
    hash: hashDaChave(chave),
    prefixo: chave.slice(0, PREFIXO_CHAVE[tipo].length + 4),
    final: chave.slice(-4),
  };
}

/** De que tipo a chave diz ser, pelo formato. Nulo = nem parece chave nossa. */
export function tipoPeloFormato(chave: string): TipoChaveApi | null {
  for (const tipo of ["SECRETA", "PUBLICAVEL"] as const) {
    if (new RegExp(`^${PREFIXO_CHAVE[tipo]}[0-9a-f]{40}$`).test(chave)) return tipo;
  }
  return null;
}

/**
 * A chave da requisição: `Authorization: Bearer …` ou `x-api-key`.
 *
 * Publicável também aceita `?chave=` — é o caso de `<img src>` e de quem testa
 * no navegador. Secreta na URL não: URL vai para log de proxy, histórico e
 * Referer, e chave secreta que passou por lá está vazada.
 */
export function chaveDaRequisicao(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cabecalho = request.headers.get("x-api-key")?.trim();
  if (cabecalho) return cabecalho;
  const daUrl = new URL(request.url).searchParams.get("chave")?.trim() ?? "";
  return daUrl.startsWith(PREFIXO_CHAVE.PUBLICAVEL) ? daUrl : "";
}

/** Como o painel mostra a chave depois de criada. */
export function chaveMascarada(c: { prefixo: string; final: string }): string {
  return `${c.prefixo}…${c.final}`;
}
