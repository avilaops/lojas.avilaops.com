import { z } from "zod";
import { exigir } from "@/lib/operadores";
import { prepararCatalogo } from "@/lib/mercadolivre-preparo";

const Entrada = z.object({
  /** Quantos produtos preparar nesta rodada. */
  limite: z.number().int().min(1).max(40).optional(),
  /** `false` reprepara quem já tem anúncio — depois de corrigir marca e GTIN. */
  somenteSemAnuncio: z.boolean().optional(),
});

/**
 * POST /api/painel/canais/mercadolivre/preparo — o lojista manda conferir o
 * catálogo agora, sem esperar a rotina.
 *
 * Existe porque quem acabou de digitar a marca de trinta produtos quer ver a
 * lista de pendências encolher no mesmo minuto. Até aqui, o preparo só
 * acontecia na rodada do n8n: a correção era feita às dez e o resultado
 * aparecia às onze, e no meio disso o lojista não sabia se tinha acertado.
 *
 * O lote é pequeno de propósito. Cada produto custa uma consulta ao preditor de
 * categoria do Mercado Livre, e um catálogo de dois mil itens numa chamada só
 * estouraria o tempo da requisição e tomaria a cota da conta. Quarenta por
 * clique dá resposta em segundos; o resto continua sendo trabalho da rotina.
 *
 * Não publica nada e não precisa da conta conectada: o preditor é público. O
 * lojista pode arrumar o catálogo inteiro antes de autorizar qualquer coisa.
 */
export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;

  const entrada = Entrada.safeParse(await request.json().catch(() => ({})));
  if (!entrada.success) return Response.json({ erro: "dados inválidos" }, { status: 422 });

  const resultado = await prepararCatalogo(s.tenant.id, {
    limite: entrada.data.limite ?? 40,
    somenteSemAnuncio: entrada.data.somenteSemAnuncio ?? true,
  });
  return Response.json(resultado);
}
