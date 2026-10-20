import { prisma } from "./db";
import { arquivoFiscalR2Configurado, guardarArquivoFiscal } from "./fiscal-r2";

/** Arquiva somente NF-e completa, em lotes limitados, sem acessar a SEFAZ. */
export async function arquivarXmlFiscal() {
  if (!arquivoFiscalR2Configurado()) return { configurado: false, arquivados: 0, falhas: 0 };
  let arquivados = 0;
  let falhas = 0;
  for (let lote = 0; lote < 20; lote++) {
    const pendentes = await prisma.documentoFiscalLoja.findMany({
      where: { arquivadoEm: null, schema: { startsWith: "procNFe" }, chave: { not: null } },
      select: { id: true, cnpj: true, chave: true, xml: true },
      orderBy: [{ recebidoEm: "asc" }, { id: "asc" }], take: 25,
    });
    if (!pendentes.length) break;
    // Máximo de cinco uploads simultâneos; não saturar conexões de banco ou R2.
    const resultado: PromiseSettledResult<void>[] = [];
    for (let i = 0; i < pendentes.length; i += 5) {
      const parcela = pendentes.slice(i, i + 5);
      resultado.push(...await Promise.allSettled(parcela.map(async (doc) => {
      if (!/^\d{14}$/.test(doc.cnpj) || !/^\d{44}$/.test(doc.chave ?? "")) throw new Error("Identificação fiscal inválida.");
      const copiado = await guardarArquivoFiscal(doc.cnpj, doc.chave!, "xml", new TextEncoder().encode(doc.xml));
      if (!copiado) throw new Error("Armazenamento fiscal não configurado.");
      await prisma.documentoFiscalLoja.updateMany({
        where: { id: doc.id, arquivadoEm: null }, data: { arquivadoEm: new Date() },
      });
      })));
    }
    arquivados += resultado.filter(x => x.status === "fulfilled").length;
    falhas += resultado.filter(x => x.status === "rejected").length;
    // Um provedor fora do ar não provoca 20 tentativas sobre os mesmos objetos.
    if (falhas) break;
  }
  if (falhas) throw new Error(`Arquivamento fiscal: ${arquivados} concluídos; ${falhas} pendentes de nova tentativa.`);
  return { configurado: true, arquivados, falhas };
}
