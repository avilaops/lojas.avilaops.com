import type { Escopo } from "./api-chaves";

/**
 * O que cada ferramenta do conector MCP exige, e o que cada credencial pode.
 *
 * Tudo puro. A rota (`/api/mcp`), a tela de autorização e o painel decidem
 * pelas mesmas funções: a ferramenta que não aparece em `tools/list` é a mesma
 * que `tools/call` recusa.
 *
 * Os escopos são os de `ESCOPOS` (`api-chaves.ts`), os mesmos da API para
 * desenvolvedores: uma chave secreta com `catalogo:ler` lê o catálogo pelas
 * duas portas. Ver docs/MCP.md.
 */

/** O que só o conector usa; a chave secreta precisa dele para entrar no MCP. */
export const ESCOPO_DO_CONECTOR: Escopo = "mcp:usar";

interface Ferramenta {
  /** Nome curto que o assistente mostra ao lojista ao pedir confirmação. */
  titulo: string;
  escopo: Escopo;
}

/**
 * Ferramenta nova entra aqui no mesmo commit em que entra em `MCP_TOOLS`: o
 * teste recusa ferramenta sem escopo, porque sem ele não há como saber se ela
 * lê ou altera, nem a quem mostrá-la.
 */
export const FERRAMENTAS: Record<string, Ferramenta> = {
  obter_loja: { titulo: "Ver dados da loja", escopo: "loja:ler" },
  atualizar_marca: { titulo: "Alterar marca e layout", escopo: "loja:escrever" },

  listar_produtos: { titulo: "Listar produtos", escopo: "catalogo:ler" },
  obter_produto: { titulo: "Ver produto", escopo: "catalogo:ler" },
  listar_categorias: { titulo: "Listar categorias", escopo: "catalogo:ler" },
  listar_estoque_baixo: { titulo: "Ver estoque baixo", escopo: "catalogo:ler" },
  listar_avaliacoes: { titulo: "Listar avaliações", escopo: "catalogo:ler" },
  criar_produto: { titulo: "Criar produto", escopo: "catalogo:escrever" },
  atualizar_produto: { titulo: "Alterar produto", escopo: "catalogo:escrever" },
  atualizar_categoria: { titulo: "Alterar categoria", escopo: "catalogo:escrever" },
  gerar_seo_categoria: { titulo: "Gerar e publicar SEO da categoria", escopo: "catalogo:escrever" },
  gerenciar_fotos_produto: { titulo: "Alterar fotos do produto", escopo: "catalogo:escrever" },
  ajustar_estoque: { titulo: "Ajustar estoque", escopo: "catalogo:escrever" },
  moderar_avaliacao: { titulo: "Moderar avaliação", escopo: "catalogo:escrever" },

  listar_pedidos: { titulo: "Listar pedidos", escopo: "pedidos:ler" },
  obter_pedido: { titulo: "Ver pedido", escopo: "pedidos:ler" },
  atualizar_status_pedido: { titulo: "Alterar status do pedido", escopo: "pedidos:escrever" },
  emitir_etiqueta_envio: { titulo: "Emitir etiqueta de envio", escopo: "pedidos:escrever" },

  listar_clientes: { titulo: "Listar clientes", escopo: "clientes:ler" },
  obter_cliente: { titulo: "Ver cliente", escopo: "clientes:ler" },

  listar_cupons: { titulo: "Listar cupons", escopo: "promocoes:ler" },
  criar_cupom: { titulo: "Criar cupom", escopo: "promocoes:escrever" },
  atualizar_cupom: { titulo: "Alterar cupom", escopo: "promocoes:escrever" },

  resumo_vendas: { titulo: "Resumo de vendas", escopo: "analises:ler" },
  resumo_atribuicao: { titulo: "Resumo de origem das vendas", escopo: "analises:ler" },
  resumo_marketing: { titulo: "Resumo de marketing", escopo: "analises:ler" },
};

export function ehEscrita(escopo: Escopo): boolean {
  return escopo.endsWith(":escrever");
}

/** A ferramenta altera a loja? Desconhecida conta como alteração: errar para o lado seguro. */
export function ferramentaAltera(nome: string): boolean {
  const f = FERRAMENTAS[nome];
  return !f || ehEscrita(f.escopo);
}

export function podeUsar(escopos: readonly string[], nome: string): boolean {
  const f = FERRAMENTAS[nome];
  return Boolean(f) && escopos.includes(f.escopo);
}

/**
 * As anotações que o protocolo prevê para a ferramenta. É por elas que o
 * assistente sabe quando pedir confirmação ao lojista antes de agir.
 * `openWorldHint: false`: toda ferramenta age só dentro da loja.
 */
export function anotacoes(nome: string) {
  const f = FERRAMENTAS[nome];
  const altera = ferramentaAltera(nome);
  return {
    title: f?.titulo ?? nome,
    readOnlyHint: !altera,
    // Nenhuma ferramenta apaga: o que há de mais forte é sobrescrever.
    destructiveHint: false,
    openWorldHint: false,
  };
}

// ── O que o lojista escolhe ao autorizar ───────────────────────────────

/** As áreas, na ordem em que a tela de autorização mostra. */
export const AREAS = [
  { id: "loja", nome: "Loja", descricao: "Nome, contato, marca e layout", ler: "loja:ler", escrever: "loja:escrever" },
  { id: "catalogo", nome: "Catálogo", descricao: "Produtos, categorias, fotos, estoque e avaliações", ler: "catalogo:ler", escrever: "catalogo:escrever" },
  { id: "pedidos", nome: "Pedidos", descricao: "Pedidos, status e etiqueta de envio", ler: "pedidos:ler", escrever: "pedidos:escrever" },
  { id: "clientes", nome: "Clientes", descricao: "Quem comprou, com contato e histórico", ler: "clientes:ler", escrever: null },
  { id: "promocoes", nome: "Promoções", descricao: "Cupons de desconto", ler: "promocoes:ler", escrever: "promocoes:escrever" },
  { id: "analises", nome: "Análises", descricao: "Resumo de vendas, origem e marketing", ler: "analises:ler", escrever: null },
] as const satisfies readonly { id: string; nome: string; descricao: string; ler: Escopo; escrever: Escopo | null }[];

export type IdDaArea = (typeof AREAS)[number]["id"];
export type AcessoDaArea = "nenhum" | "ler" | "alterar";

/** Tudo o que o conector sabe fazer. */
export const ESCOPOS_DO_MCP: readonly Escopo[] = AREAS.flatMap((a) => (a.escrever ? [a.ler, a.escrever] : [a.ler]));

const SO_LEITURA: readonly Escopo[] = AREAS.map((a) => a.ler);

/**
 * Os escopos da conexão a partir do que o lojista marcou na tela.
 *
 * `completo` e `leitura` são os dois atalhos; `areas` é a escolha por área.
 * Quem pode alterar uma área também a lê: assistente que muda preço sem ver o
 * preço atual erra mais, não menos. Área que não tem o que alterar (clientes,
 * análises) fica em leitura mesmo marcada como "alterar".
 */
export function escoposDaAutorizacao(pedido: { nivel?: unknown; areas?: unknown }): Escopo[] | null {
  if (pedido.nivel === "completo") return [...ESCOPOS_DO_MCP];
  if (pedido.nivel === "leitura") return [...SO_LEITURA];
  if (pedido.nivel !== "areas" || !pedido.areas || typeof pedido.areas !== "object") return null;

  const marcadas = pedido.areas as Record<string, unknown>;
  const escopos: Escopo[] = [];
  for (const a of AREAS) {
    const acesso = marcadas[a.id];
    if (acesso !== "ler" && acesso !== "alterar") continue;
    escopos.push(a.ler);
    if (acesso === "alterar" && a.escrever) escopos.push(a.escrever);
  }
  return escopos.length ? escopos : null;
}

/** Como o painel resume o acesso de uma conexão. */
export function resumoDoAcesso(escopos: readonly string[]): string {
  const tem = (e: string) => escopos.includes(e);
  if (ESCOPOS_DO_MCP.every(tem)) return "Consulta e altera tudo";
  if (SO_LEITURA.every(tem) && !escopos.some((e) => e.endsWith(":escrever"))) return "Só consulta";
  const partes = AREAS.filter((a) => tem(a.ler)).map((a) => (a.escrever && tem(a.escrever) ? `${a.nome} (altera)` : `${a.nome} (consulta)`));
  return partes.length ? partes.join(", ") : "Sem acesso";
}
