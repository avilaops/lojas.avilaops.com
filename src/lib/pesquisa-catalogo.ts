import { z } from "zod";
import { prisma } from "./db";
import { ErroCatalogo } from "./catalogo-oferta";
import { salvarProdutoNoCatalogo } from "./catalogo-escrita";

export const PromoverImagemPesquisaSchema = z.object({
  imagemCandidataId: z.string().min(1),
  versaoCatalogo: z.number().int().positive().optional(),
});

export type CandidataPromovivel = {
  estado: string;
  direitoUso: string;
  correspondenciaExata: boolean;
  urlArmazenada: string | null;
  correspondencia: { confirmada: boolean | null; confianca: string };
};

/** Regra pura e reutilizável: pesquisa nunca vira catálogo só por similaridade. */
export function impedimentoPromocao(c: CandidataPromovivel): string | null {
  if (c.estado === "PROMOVIDA") return "imagem já promovida";
  if (c.estado !== "APROVADA") return "imagem candidata ainda não aprovada";
  if (c.direitoUso !== "PERMITIDO") return "uso da imagem não está autorizado";
  if (!c.correspondenciaExata || c.correspondencia.confirmada !== true || c.correspondencia.confianca !== "alta") return "produto exato não foi confirmado com alta confiança";
  if (!c.urlArmazenada) return "imagem ainda não foi armazenada na infraestrutura da loja";
  return null;
}

export async function promoverImagemPesquisa(tenantId: string, imagemCandidataId: string, versaoCatalogo?: number) {
  const candidata = await prisma.imagemCandidataProduto.findFirst({
    where: { id: imagemCandidataId, correspondencia: { tenantId } },
    include: { fonte: true, correspondencia: { include: { produto: true, execucao: true } } },
  });
  if (!candidata) throw new ErroCatalogo("Imagem candidata não encontrada nesta loja.", 404);
  if (candidata.fonte.execucaoId !== candidata.correspondencia.execucaoId) throw new ErroCatalogo("A fonte não pertence à mesma execução da correspondência.", 422);
  const impedimento = impedimentoPromocao(candidata);
  if (impedimento) throw new ErroCatalogo(impedimento, 422);

  const produto = candidata.correspondencia.produto;
  const url = candidata.urlArmazenada!;
  await salvarProdutoNoCatalogo(tenantId, produto.id, {
    imagens: [...new Set([...produto.imagens, url])],
    imagemOrigem: "propria",
    imagemFamilia: null,
  }, {
    origem: `pesquisa:${candidata.correspondencia.execucao.id}`,
    versao: versaoCatalogo,
    metadadosMidia: {
      fonte: `pesquisa:${candidata.fonte.id}:${candidata.fonte.url}`,
      correspondencia: "confirmada",
    },
  });

  await prisma.imagemCandidataProduto.update({
    where: { id: candidata.id },
    data: { estado: "PROMOVIDA", promovidaUrl: url, promovidaEm: new Date() },
  });
  return prisma.produto.findUniqueOrThrow({ where: { id: produto.id }, include: { midias: { orderBy: { ordem: "asc" } } } });
}
