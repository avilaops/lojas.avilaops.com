import { comprarPelaApi } from "@/lib/api-checkout";
import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { ErroApi } from "@/lib/api-resposta";

/**
 * POST /api/v1/vitrine/checkout — fecha a compra a partir do site ou do app do
 * lojista: cria o pedido e a cobrança, e devolve o Pix, o boleto ou o
 * resultado do cartão.
 *
 * Exige o escopo `vitrine:comprar`, que a chave publicável só tem quando o
 * lojista marcou. O corpo diz o que comprar, para quem e como pagar; o preço e
 * o frete saem do servidor (`criarCobranca`). Com `Idempotency-Key`, repetir a
 * requisição devolve a mesma cobrança em vez de criar outra.
 */
export const dynamic = "force-dynamic";

export const POST = rotaDaApi({ escopo: "vitrine:comprar", navegador: true, escrita: { exigeOrigem: true, porEnderecoPorMinuto: 6 } }, async ({ request, tenant, chave }) => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    throw new ErroApi("parametro_invalido", "O corpo precisa ser JSON válido.");
  }
  return { dados: await comprarPelaApi(tenant, chave, request, corpo) };
});

export const OPTIONS = preVooDaVitrine;
