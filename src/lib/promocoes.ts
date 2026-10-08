import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { campanhasDaLoja } from "./campanhas";
import { WHERE_COMPRAVEL } from "./produto-regras";
import type { TemaLoja } from "./tema";

/**
 * A loja tem o que mostrar em `/promocoes`?
 *
 * Uma pergunta, um lugar. O sitemap respondia olhando campanha com arte e
 * produto com desconto; o menu respondia olhando só se `campanhasHome` tinha
 * alguma linha, mesmo sem imagem. Resultado: loja com o link "Promoções" no
 * cabeçalho apontando para uma página que o próprio sitemap escondia por
 * estar vazia. Agora sitemap, cabeçalho e página perguntam aqui.
 */

/** `emPromocao` (produto-regras), na forma que o Prisma entende. */
export function whereEmPromocao(tenantId: string): Prisma.ProdutoWhereInput {
  return {
    tenantId,
    ...WHERE_COMPRAVEL,
    precoDeCentavos: { gt: prisma.produto.fields.precoCentavos },
    imagens: { isEmpty: false },
    imagemOrigem: "propria",
  };
}

/**
 * A regra, pura: campanha com arte ou ao menos um produto em oferta.
 *
 * Banner que só leva ao catálogo inteiro (`/produtos`) ou à home é vitrine
 * institucional, não campanha: com ele sozinho a página de promoções abria
 * dizendo que não havia desconto nenhum.
 */
export function temPromocoes(tema: TemaLoja, haProdutoEmPromocao: boolean): boolean {
  const campanhas = campanhasDaLoja(tema).filter((c) => !["/", "/produtos"].includes(c.link.split(/[?#]/)[0].replace(/\/+$/, "") || "/"));
  return campanhas.length > 0 || haProdutoEmPromocao;
}

/**
 * Para o cabeçalho, que roda em toda página: não carrega o catálogo. Com
 * campanha no ar nem consulta; sem ela, pergunta ao banco por um produto só.
 */
export async function lojaTemPromocoes(tenantId: string, tema: TemaLoja): Promise<boolean> {
  if (temPromocoes(tema, false)) return true;
  const um = await prisma.produto.findFirst({ where: whereEmPromocao(tenantId), select: { id: true } });
  return temPromocoes(tema, um !== null);
}
