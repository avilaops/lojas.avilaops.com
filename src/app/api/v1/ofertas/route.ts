import { z } from "zod";
import { prisma } from "@/lib/db";
import { rotaDaApi } from "@/lib/api-rotas";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
import { ajustarOfertaNoCatalogo } from "@/lib/catalogo-escrita";
import { ErroCatalogo } from "@/lib/catalogo-oferta";
import { invalidarCatalogo } from "@/lib/catalogo-cache";

/**
 * PATCH /api/v1/ofertas — preço e estoque por SKU, em lote.
 *
 * É o que um ERP faz: a cada passada, manda o SKU com o preço e o saldo que
 * ele tem. Cada item é aplicado por `ajustarOfertaNoCatalogo` (a mesma trava,
 * histórico e evento do painel), num item por vez: um SKU recusado não
 * desfaz os outros, e a resposta diz o que aconteceu com cada um.
 *
 * Os valores são absolutos ("estoque 5", não "mais 5"), então reenviar o
 * mesmo lote depois de um erro de rede não muda nada — e item igual ao que
 * já está gravado volta `sem_mudanca`, sem criar versão no histórico.
 */
export const dynamic = "force-dynamic";

const MAXIMO_POR_LOTE = 100;
/** R$ 100 milhões: acima disso é centavos confundidos com reais multiplicados de novo. */
const TETO_CENTAVOS = 10_000_000_000;

const Item = z
  .object({
    sku: z.string().trim().min(1, "informe o SKU").max(100),
    precoCentavos: z.number().int("centavos inteiros").min(0).max(TETO_CENTAVOS).optional(),
    precoDeCentavos: z.number().int("centavos inteiros").positive().max(TETO_CENTAVOS).nullable().optional(),
    // Saldo físico. Nulo = a loja não controla estoque deste SKU.
    estoque: z.number().int("quantidade inteira").min(0).max(10_000_000).nullable().optional(),
  })
  // Campo desconhecido é erro: `preco: 49.9` em reais, ignorado em silêncio, é
  // o ERP achando que atualizou o preço.
  .strict()
  .refine((i) => i.precoCentavos !== undefined || i.precoDeCentavos !== undefined || i.estoque !== undefined, "informe precoCentavos, precoDeCentavos ou estoque");

const Lote = z.object({ itens: z.array(Item).min(1, "o lote está vazio").max(MAXIMO_POR_LOTE, `no máximo ${MAXIMO_POR_LOTE} itens por chamada`) }).strict();

type Situacao = "atualizado" | "sem_mudanca" | "erro";

export const PATCH = rotaDaApi({ escopo: "catalogo:escrever" }, async ({ request, tenant, chave }) => {
  const { itens } = await lerCorpo(request, Lote);

  const repetido = itens.find((item, i) => itens.findIndex((o) => o.sku === item.sku) !== i);
  if (repetido) throw new ErroApi("parametro_invalido", `O SKU "${repetido.sku}" aparece mais de uma vez no lote; qual dos dois valeria?`);

  const variantes = await prisma.variante.findMany({
    where: { tenantId: tenant.id, sku: { in: itens.map((i) => i.sku) } },
    select: { id: true, sku: true, produtoId: true },
  });
  const porSku = new Map(variantes.map((v) => [v.sku!, v]));

  // O histórico mostra que foi a API, e por qual chave: o lojista que vê um
  // preço mudar sozinho precisa saber qual integração mexeu.
  const origem = `api:${chave.id}`;
  const resultados: Array<{ sku: string; situacao: Situacao; produtoId?: string; varianteId?: string; erro?: { codigo: string; mensagem: string } }> = [];

  for (const item of itens) {
    const v = porSku.get(item.sku);
    if (!v) {
      resultados.push({ sku: item.sku, situacao: "erro", erro: { codigo: "nao_encontrado", mensagem: "Nenhum produto ou variação com este SKU nesta loja." } });
      continue;
    }
    try {
      const r = await ajustarOfertaNoCatalogo(tenant.id, v.id, item, origem);
      resultados.push({ sku: item.sku, situacao: r.mudou ? "atualizado" : "sem_mudanca", produtoId: v.produtoId, varianteId: v.id });
    } catch (e) {
      if (!(e instanceof ErroCatalogo)) throw e;
      resultados.push({ sku: item.sku, situacao: "erro", produtoId: v.produtoId, varianteId: v.id, erro: { codigo: "recusado", mensagem: e.message } });
    }
  }

  const contar = (s: Situacao) => resultados.filter((r) => r.situacao === s).length;
  if (contar("atualizado") > 0) {
    // A gravação já foi confirmada no banco. Falhar em limpar o cache da
    // vitrine não pode virar 500: o ERP leria "não gravou" e o lojista
    // investigaria um erro que não houve. O cache expira sozinho.
    try {
      invalidarCatalogo(tenant.id);
    } catch (e) {
      console.error(`[api/v1/ofertas] cache da loja ${tenant.id} não foi limpo`, e);
    }
  }

  return {
    dados: {
      atualizados: contar("atualizado"),
      semMudanca: contar("sem_mudanca"),
      erros: contar("erro"),
      itens: resultados,
    },
  };
});
