import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { codigoInterno, lerCodigoInterno, type ConsultaEtiquetas, type ItemEtiqueta } from "./etiquetas";
import { gerarBarras } from "./etiquetas-barras";
import type { z } from "zod";

const POR_PAGINA = 30;

/** Só unidades vendáveis ativas; o pai de uma grade nunca vira uma etiqueta ambígua. */
export async function consultarEtiquetas(tenantId: string, consulta: z.infer<typeof ConsultaEtiquetas>) {
  const { q, produtoId, pagina, tipo } = consulta;
  const idInterno = lerCodigoInterno(q);
  const where: Prisma.VarianteWhereInput = {
    tenantId,
    ativo: true,
    produtoId,
    produto: { tenantId, ativo: true },
    ...(idInterno ? { id: idInterno } : q ? {
      OR: [
        { sku: q }, { gtin: q },
        // Um leitor envia o identificador completo. Números não fazem busca aproximada.
        ...(!/^\d+$/.test(q) && !q.startsWith("V:") ? [
          { nome: { contains: q, mode: "insensitive" as const } },
          { produto: { nome: { contains: q, mode: "insensitive" as const } } },
        ] : []),
      ],
    } : {}),
  };
  const [total, variantes] = await Promise.all([
    prisma.variante.count({ where }),
    prisma.variante.findMany({
      where, skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA,
      orderBy: [{ produto: { nome: "asc" } }, { ordem: "asc" }, { id: "asc" }],
      include: { produto: { select: { nome: true } }, preco: true },
    }),
  ]);
  const gtins = variantes.flatMap(v => v.gtin ? [v.gtin] : []);
  const repetidos = tipo === "gtin" && gtins.length ? await prisma.variante.groupBy({
    by: ["gtin"],
    where: { tenantId, ativo: true, produto: { tenantId, ativo: true }, gtin: { in: gtins } },
    _count: { _all: true },
    having: { gtin: { _count: { gt: 1 } } },
  }) : [];
  const duplicados = new Set(repetidos.map(v => v.gtin));
  const itens: ItemEtiqueta[] = variantes.map(v => {
    let codigo: string | null = null;
    let svg: string | null = null;
    let erro: string | null = null;
    try {
      if (tipo === "gtin" && !v.gtin) throw new Error("Cadastre o GTIN do fabricante ou use código interno.");
      if (tipo === "gtin" && duplicados.has(v.gtin)) throw new Error("GTIN associado a mais de um item da loja. Corrija o cadastro ou use código interno.");
      codigo = tipo === "interno" ? codigoInterno(v.id) : v.gtin!;
      svg = gerarBarras(codigo, tipo);
    } catch (e) {
      erro = e instanceof Error ? e.message : "Não foi possível gerar esta etiqueta.";
    }
    return { id: v.id, produtoId: v.produtoId, nome: v.produto.nome, variacao: v.padrao ? null : v.nome, sku: v.sku, precoCentavos: v.preco?.valorCentavos ?? null, codigo, svg, erro };
  });
  return { itens, total, pagina, paginas: Math.max(1, Math.ceil(total / POR_PAGINA)) };
}
