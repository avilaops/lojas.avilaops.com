import { z } from "zod";
import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { freteDaVitrine } from "@/lib/api-recursos";
import { ErroApi, lerCorpo } from "@/lib/api-resposta";
import { resolverItensDoCatalogo } from "@/lib/catalogo";
import { cotarFrete } from "@/lib/frete";

/**
 * POST /api/v1/vitrine/frete — as opções de entrega para um carrinho e um CEP.
 *
 * A mesma cotação do checkout da loja (`cotarFrete`): entrega local, a
 * transportadora da loja e a retirada. O `id` de cada opção é o que vai em
 * `freteId` na compra, e o servidor cota de novo ali: o preço daqui é para
 * mostrar, não para cobrar.
 *
 * É POST porque leva um carrinho, e tem limite por endereço porque cada
 * cotação é uma chamada à transportadora na conta do lojista.
 */
export const dynamic = "force-dynamic";

const Cotacao = z
  .object({
    cep: z.string().trim().min(8, "CEP com 8 dígitos").max(9),
    itens: z.array(z.object({ id: z.string().trim().min(1).max(80), quantidade: z.number().int().min(1).max(999) }).strict()).min(1).max(50),
  })
  .strict();

export const POST = rotaDaApi({ escopo: "vitrine:ler", navegador: true, escrita: { exigeOrigem: false, porEnderecoPorMinuto: 30 } }, async ({ request, tenant }) => {
  const { cep, itens } = await lerCorpo(request, Cotacao);
  const resolvidos = await resolverItensDoCatalogo(tenant.id, itens);
  if (resolvidos.length !== itens.length) {
    throw new ErroApi("pedido_invalido", "Algum item do carrinho não está disponível.", {}, "item_indisponivel");
  }
  return { dados: (await cotarFrete(tenant, cep, resolvidos)).map(freteDaVitrine) };
});

export const OPTIONS = preVooDaVitrine;
