import type { Prisma } from "@prisma/client";
import { termosDeBusca } from "./catalogo";

/**
 * O filtro do catálogo no painel, num lugar só.
 *
 * A lista da tela e a planilha que o lojista baixa têm que enxergar o mesmo
 * catálogo: se "Sem preço" mostra 5.588 itens e o arquivo desce com outro
 * conjunto, o lojista corrige a planilha errada e reimporta em cima do que
 * estava certo. A pergunta é a mesma; a resposta também.
 */

export type FiltroCatalogo = {
  busca?: string;
  categoria?: string;
  situacao?: string;
};

/** Identificação ainda desconhecida. Ausência confirmada pelo fabricante é válida. */
export const varianteSemIdentificadores: Prisma.VarianteWhereInput = {
  ativo: true,
  identificadoresEstado: "desconhecido",
  AND: [{ OR: [{ gtin: null }, { gtin: "" }] }, { OR: [{ mpn: null }, { mpn: "" }] }],
};

/** As situações são a pergunta do dia ("o que está sem foto?"), não colunas. */
export function condicaoDoCatalogo(tenantId: string, filtro: FiltroCatalogo): Prisma.ProdutoWhereInput {
  const where: Prisma.ProdutoWhereInput = { tenantId };
  const busca = filtro.busca?.trim();
  const categoria = filtro.categoria?.trim();
  const situacao = filtro.situacao?.trim();

  if (busca) {
    // Todos os termos precisam casar, como na vitrine: "retentor 30x47" tem
    // que trazer o retentor daquela medida, não todo retentor da loja.
    where.AND = termosDeBusca(busca).map((termo) => ({ busca: { contains: termo } }));
  }
  if (categoria) where.categoria = { slug: categoria };

  if (situacao === "ativo") where.ativo = true;
  else if (situacao === "inativo") where.ativo = false;
  else if (situacao === "esgotado") where.OR = [{ disponibilidade: "out_of_stock" }, { estoque: 0 }];
  else if (situacao === "sem-foto") where.imagens = { isEmpty: true };
  else if (situacao === "imagem-merchant-revisar") where.OR = [
    { imagens: { isEmpty: true } },
    { imagemOrigem: { not: "propria" } },
  ];
  else if (situacao === "sem-preco") where.precoCentavos = 0;
  else if (situacao === "sem-categoria") where.categoriaId = null;
  else if (situacao === "sem-descricao") {
    const anteriores = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...anteriores,
      { OR: [{ descricao: null }, { descricao: "" }] },
      { OR: [{ descricaoCurta: null }, { descricaoCurta: "" }] },
    ];
  }
  else if (situacao === "sem-marca") where.OR = [\n    { marca: null },\n    { marca: "" },\n    { marca: { equals: "DIVERSOS", mode: "insensitive" } },\n  ];
  else if (situacao === "identificadores-pendentes") {
    // Mostrar apenas códigos ainda não confirmados pelo fabricante. Estado
    // `sem_identificador` é uma resposta válida e não entra nesta fila.
    where.variantes = { some: varianteSemIdentificadores };
  }
  else if (situacao === "sem-medida") {
    // O aviso do topo da tela ("5.588 produtos sem medida pagam frete pela
    // caixa padrão") vira filtro e vira planilha: é o caminho de corrigir.
    where.OR = [{ pesoKg: null }, { alturaCm: null }, { larguraCm: null }, { comprimentoCm: null }];
  }

  return where;
}

/** Da URL do painel para o filtro, sem repetir o nome do parâmetro em cada rota. */
export function filtroDaUrl(url: URL): FiltroCatalogo {
  return {
    busca: url.searchParams.get("q") ?? undefined,
    categoria: url.searchParams.get("categoria") ?? undefined,
    situacao: url.searchParams.get("situacao") ?? undefined,
  };
}
