import { conferirCupomPelaApi } from "@/lib/api-cupom";
import { ConsultaDeCupom, RespostaDeCupom, OpcoesDaConsultaDeCupom } from "@/lib/api-cupom-contrato";
import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { lerCorpo } from "@/lib/api-resposta";

/**
 * POST /api/v1/vitrine/cupom — confere um cupom para um carrinho, antes da
 * compra, para o site mostrar o desconto.
 *
 * Exige `vitrine:comprar` e a origem da chave, como a compra: cupom só
 * interessa a quem vende. A recusa é uma só (`cupom_invalido`) e cada erro
 * conta num limite próprio. Ver `src/lib/api-cupom.ts`.
 */
export const dynamic = "force-dynamic";

export const POST = rotaDaApi({ escopo: "vitrine:comprar", navegador: OpcoesDaConsultaDeCupom.navegador, escrita: OpcoesDaConsultaDeCupom.escrita } satisfies typeof OpcoesDaConsultaDeCupom, async ({ request, tenant, chave }) => {
  const consulta = await lerCorpo(request, ConsultaDeCupom);
  return RespostaDeCupom.parse({ dados: await conferirCupomPelaApi(tenant, chave, request, consulta) });
});

export const OPTIONS = preVooDaVitrine;
