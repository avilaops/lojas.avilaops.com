import type { Prisma } from "@prisma/client";

export function filtrosFiscais(tenantId: string, parametros = new URLSearchParams()) {
  const busca = (parametros.get("busca") ?? "").trim().slice(0, 100);
  const tipo = parametros.get("tipo");
  const somenteDisponiveis = parametros.get("arquivos") === "disponiveis";
  const numeroPagina = Number(parametros.get("pagina") ?? 1);
  const pagina = Number.isSafeInteger(numeroPagina) ? Math.min(100000, Math.max(1, numeroPagina)) : 1;
  const limite = 30;
  const data = (campo: string) => {
    const v = parametros.get(campo);
    // O período é de recebimento, no horário de São Paulo.
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
    const d = new Date(`${v}T00:00:00-03:00`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const inicio = data("inicio");
  const fim = data("fim");
  const where: Prisma.DocumentoFiscalLojaWhereInput = {
    tenantId,
    ...(busca ? { AND: [{ OR: [
      { chave: { contains: busca } },
      { nsu: { contains: busca } },
      { numero: { contains: busca, mode: "insensitive" } },
      { protocolo: { contains: busca, mode: "insensitive" } },
      { emitenteDocumento: { contains: busca, mode: "insensitive" } },
      { emitenteNome: { contains: busca, mode: "insensitive" } },
      { destinatarioDocumento: { contains: busca, mode: "insensitive" } },
      { destinatarioNome: { contains: busca, mode: "insensitive" } },
      { participantes: { some: { OR: [{ documento: { contains: busca, mode: "insensitive" } }, { razaoSocial: { contains: busca, mode: "insensitive" } }, { nomeFantasia: { contains: busca, mode: "insensitive" } }] } } },
      { itens: { some: { OR: [{ codigo: { contains: busca, mode: "insensitive" } }, { descricao: { contains: busca, mode: "insensitive" } }, { ncm: { contains: busca } }, { cfop: { contains: busca } }] } } },
      // Compatibilidade com documentos anteriores à migração; projeções novas evitam varrer XML.
      { AND: [{ parserVersao: 1 }, { xml: { contains: busca, mode: "insensitive" } }] },
    ] }] } : {}),
    ...(tipo === "nfe-recebidas" && somenteDisponiveis ? { schema: { startsWith: "procNFe" } } : tipo === "nfe-recebidas" ? { OR: [{ schema: { startsWith: "resNFe" } }, { schema: { startsWith: "procNFe" } }] } : tipo === "cte" && somenteDisponiveis ? { OR: [{ schema: { startsWith: "procCTe", mode: "insensitive" } }, { schema: { startsWith: "cteProc", mode: "insensitive" } }] } : tipo === "cte" ? { OR: [{ schema: { startsWith: "resCTe", mode: "insensitive" } }, { schema: { startsWith: "procCTe", mode: "insensitive" } }, { schema: { startsWith: "cteProc", mode: "insensitive" } }] } : tipo === "completa" ? { OR: [{ schema: { startsWith: "procNFe", mode: "insensitive" } }, { schema: { startsWith: "procCTe", mode: "insensitive" } }, { schema: { startsWith: "cteProc", mode: "insensitive" } }] } : tipo === "resumo" ? { OR: [{ schema: { startsWith: "resNFe", mode: "insensitive" } }, { schema: { startsWith: "resCTe", mode: "insensitive" } }] } : tipo === "evento" ? { schema: { contains: "evento", mode: "insensitive" } } : {}),
    ...(inicio || fim ? { recebidoEm: { ...(inicio ? { gte: inicio } : {}), ...(fim ? { lt: new Date(fim.getTime() + 86_400_000) } : {}) } } : {}),
  };
  return { where, pagina, limite };
}
