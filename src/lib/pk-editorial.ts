export type TipoEditorialPk = "guias" | "aplicacoes";
export type EditorialPk = { slug: string; titulo: string; resumo: string; tipo: TipoEditorialPk; familias: readonly string[]; segmento?: string };
export const EDITORIAL_PK: readonly EditorialPk[] = [
  {
    "slug": "medir-vedacoes",
    "titulo": "Como medir DI, DE, altura e seção",
    "resumo": "Registre as dimensões sem confundir desgaste com medida nominal.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "perfis-b-bs-std",
    "titulo": "Gaxetas B, BS e STD: qual função conferir",
    "resumo": "Diferencie vedação de haste e de êmbolo antes de comparar medidas.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "pu-nylon-funcoes",
    "titulo": "PU e nylon: vedar e guiar são funções diferentes",
    "resumo": "Entenda por que a gaxeta e o anel guia participam do mesmo conjunto.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "prevenir-vazamento-contaminacao",
    "titulo": "Como investigar vazamentos e entrada de sujeira",
    "resumo": "Observe vedação, raspagem e guia antes de repetir a troca.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "preparar-cotacao",
    "titulo": "Como preparar uma cotação de vedações por lote",
    "resumo": "Uma lista por posição ajuda a evitar dúvidas entre peças parecidas.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "selecionar-perfil-aplicacao",
    "titulo": "Como selecionar um perfil para a aplicação",
    "resumo": "Cruze posição, alojamento e condições reais do cilindro.",
    "tipo": "guias",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ]
  },
  {
    "slug": "industria-hidraulica",
    "titulo": "Indústria e manutenção hidráulica",
    "resumo": "Seleção de vedações para prensas, dispositivos de fixação e unidades de produção, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Indústria e manutenção hidráulica"
  },
  {
    "slug": "agricultura",
    "titulo": "Agricultura e implementos",
    "resumo": "Seleção de vedações para levantamento de implementos, articulação e posicionamento de conjuntos agrícolas, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Agricultura e implementos"
  },
  {
    "slug": "construcao",
    "titulo": "Construção e terraplenagem",
    "resumo": "Seleção de vedações para acionamento de caçambas, articulações e estabilizadores, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Construção e terraplenagem"
  },
  {
    "slug": "mineracao",
    "titulo": "Mineração e beneficiamento",
    "resumo": "Seleção de vedações para comportas, dispositivos de posicionamento e cilindros auxiliares de equipamentos, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Mineração e beneficiamento"
  },
  {
    "slug": "transporte-implementos",
    "titulo": "Transporte e manutenção de implementos",
    "resumo": "Seleção de vedações para basculamento, abertura de tampas e acionamentos auxiliares de carrocerias, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Transporte e manutenção de implementos"
  },
  {
    "slug": "logistica-movimentacao",
    "titulo": "Logística e movimentação de materiais",
    "resumo": "Seleção de vedações para plataformas, mesas elevatórias e posicionadores hidráulicos, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Logística e movimentação de materiais"
  },
  {
    "slug": "energia",
    "titulo": "Energia e equipamentos auxiliares",
    "resumo": "Seleção de vedações para acionamentos hidráulicos de comportas, posicionadores e dispositivos de manutenção, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Energia e equipamentos auxiliares"
  },
  {
    "slug": "florestal",
    "titulo": "Operações florestais",
    "resumo": "Seleção de vedações para garras, articulações e movimentação auxiliar de equipamentos florestais, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Operações florestais"
  },
  {
    "slug": "saneamento",
    "titulo": "Saneamento e infraestrutura",
    "resumo": "Seleção de vedações para acionamento de comportas, grades e dispositivos auxiliares de estações, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Saneamento e infraestrutura"
  },
  {
    "slug": "embalagens-processos",
    "titulo": "Embalagens, alimentos e máquinas de processo",
    "resumo": "Seleção de vedações para prensas de embalagem, posicionadores e acionamentos hidráulicos auxiliares, conforme o projeto do cilindro.",
    "tipo": "aplicacoes",
    "familias": [
      "gaxetas",
      "raspadores",
      "aneis-guia"
    ],
    "segmento": "Embalagens, alimentos e máquinas de processo"
  }
];
export function listarEditorialPk(tenantSlug: string, tipo?: TipoEditorialPk): EditorialPk[] {
  return tenantSlug === "pkvedacoes" ? EDITORIAL_PK.filter(item => !tipo || item.tipo === tipo) : [];
}
export function acharEditorialPk(tenantSlug: string, tipo: TipoEditorialPk, slug: string): EditorialPk | undefined {
  return listarEditorialPk(tenantSlug, tipo).find(item => item.slug === slug);
}
export function caminhosEditorialPk(tenantSlug: string): string[] {
  if (tenantSlug !== "pkvedacoes") return [];
  return ["/guias", "/aplicacoes", ...listarEditorialPk(tenantSlug).map(item => `/${item.tipo}/${item.slug}`)];
}

