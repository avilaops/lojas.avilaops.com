export type IconeNav = "visao" | "analises" | "pedidos" | "produtos" | "estoque" | "clientes" | "promocoes" | "avaliacoes" | "marketing" | "ia" | "conexoes" | "categorias" | "sobMedida" | "config";
export type ItemNav = { rotulo: string; href: string; icone: IconeNav; filhos?: Array<{ rotulo: string; href: string }> };
export type RecursosNavegacao = { pixManual: boolean; configuradorSobMedida: boolean };

export const SECOES: ItemNav[] = [
  { rotulo: "Visão geral", href: "/painel", icone: "visao" },
  {
    rotulo: "Análises",
    href: "/painel/analises",
    icone: "analises",
    filhos: [
      { rotulo: "Visão de vendas", href: "/painel/analises" },
      { rotulo: "Funil da loja", href: "/painel/analises/funil" },
      { rotulo: "Atribuição", href: "/painel/analises/atribuicao" },
    ],
  },
  { rotulo: "Pedidos", href: "/painel/pedidos", icone: "pedidos" },
  { rotulo: "Cotações B2B", href: "/painel/cotacoes", icone: "pedidos" },
  {
    rotulo: "Produtos",
    href: "/painel/produtos",
    icone: "produtos",
    filhos: [
      { rotulo: "Produtos", href: "/painel/produtos" },
      { rotulo: "Categorias", href: "/painel/produtos/categorias" },
    ],
  },
  { rotulo: "Inventário", href: "/painel/estoque", icone: "estoque" },
  { rotulo: "Clientes", href: "/painel/clientes", icone: "clientes" },
  { rotulo: "Promoções", href: "/painel/promocoes", icone: "promocoes" },
  { rotulo: "Avaliações", href: "/painel/avaliacoes", icone: "avaliacoes" },
  {
    rotulo: "Marketing",
    href: "/painel/marketing",
    icone: "marketing",
    filhos: [
      { rotulo: "Buscadores", href: "/painel/marketing" },
      { rotulo: "Anúncios", href: "/painel/marketing/anuncios" },
      { rotulo: "Blog", href: "/painel/marketing/blog" },
    ],
  },
  { rotulo: "IA e API", href: "/painel/ia", icone: "ia" },
  { rotulo: "Conexões", href: "/painel/conexoes", icone: "conexoes" },
];

export function secoesDoPainel({ pixManual, configuradorSobMedida }: { pixManual: boolean; configuradorSobMedida: boolean }): ItemNav[] {
  return SECOES.flatMap((secao) => {
    const adicionais: ItemNav[] = [];
    if (secao.href === "/painel/pedidos" && configuradorSobMedida) adicionais.push({ rotulo: "Projetos sob medida", href: "/painel/sob-medida", icone: "sobMedida" });
    if (secao.href === "/painel/pedidos" && pixManual) adicionais.push({ rotulo: "Pix a conferir", href: "/painel/pedidos/pix", icone: "pedidos" });
    return [secao, ...adicionais];
  });
}

function normalizarBusca(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

/** O menu e a busca usam as mesmas seções e os mesmos recursos habilitados. */
export function atalhosDoPainel(recursos: RecursosNavegacao) {
  const destinos = new Map<string, { rotulo: string; href: string }>();
  for (const secao of secoesDoPainel(recursos)) {
    destinos.set(secao.href, { rotulo: secao.rotulo, href: secao.href });
    for (const filho of secao.filhos ?? []) {
      if (!destinos.has(filho.href)) destinos.set(filho.href, { rotulo: filho.rotulo, href: filho.href });
    }
  }
  destinos.set("/painel/configuracoes", { rotulo: "Configurações", href: "/painel/configuracoes" });
  return [...destinos.values()];
}

export function buscarAtalhosDoPainel(termo: string, recursos: RecursosNavegacao) {
  const consulta = normalizarBusca(termo);
  return atalhosDoPainel(recursos).filter((item) => normalizarBusca(item.rotulo).includes(consulta));
}
