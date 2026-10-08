import type { ChaveApi, Tenant } from "@prisma/client";
import { z } from "zod";
import { LimitadorPorJanela } from "./api-limite";
import { freteDaVitrine } from "./api-recursos";
import { ErroApi } from "./api-resposta";
import { resolverItensDoCatalogo } from "./catalogo";
import { CUPOM_INVALIDO, MENSAGEM_CUPOM_INVALIDO } from "./checkout-cobranca";
import { buscarCupomValido, descontoDoCupom, normalizarCodigo } from "./cupons";
import { cotarFrete } from "./frete";
import { enderecoDaRequisicao } from "./requisicao-origem";

/**
 * Cupom pela chave publicável.
 *
 * A vitrine da loja diz por que o cupom não entrou (não existe, venceu,
 * esgotou, falta mínimo). Aqui a porta é uma chave que está no JavaScript de um
 * site, e essas cinco respostas são um mapa para adivinhar cupom. Por isso:
 *
 * - **Uma recusa só** (`cupom_invalido`), igual para qualquer motivo.
 * - **Erro conta.** Cupom certo não gasta nada; cupom errado gasta uma
 *   tentativa do endereço e uma da chave. Esgotou, a resposta é 429 até a
 *   janela virar, inclusive para cupom certo: senão o limite só atrasaria a
 *   adivinhação em vez de pará-la.
 *
 * O teto por chave existe porque endereço se troca. O preço dele é conhecido:
 * quem quiser pode esgotar o cupom do site de um lojista por dez minutos. Fica
 * só sem cupom, e só por este canal; a compra e a vitrine da loja seguem.
 *
 * O endereço fica na memória do limitador pela janela e em mais lugar nenhum.
 */

const JANELA_MS = 10 * 60_000;
export const ERROS_POR_ENDERECO = 5;
export const ERROS_POR_CHAVE = 100;

const erros = new LimitadorPorJanela(Date.now, JANELA_MS);

const doEndereco = (chaveId: string, request: Request) => `cupom:${chaveId}:${enderecoDaRequisicao(request)}`;
const daChave = (chaveId: string) => `cupom:${chaveId}`;

/** Antes de olhar o cupom: quem já errou demais não fica sabendo nem se acertou. */
export function exigirTentativaDeCupom(chaveId: string, request: Request) {
  const endereco = erros.esgotado(doEndereco(chaveId, request), ERROS_POR_ENDERECO);
  const chave = erros.esgotado(daChave(chaveId), ERROS_POR_CHAVE);
  if (endereco.esgotado || chave.esgotado) {
    throw new ErroApi("limite_excedido", "Muitas tentativas de cupom. Tente de novo mais tarde.", {
      "Retry-After": String(Math.max(endereco.esgotado ? endereco.reiniciaEm : 0, chave.esgotado ? chave.reiniciaEm : 0)),
    });
  }
}

export function registrarCupomRecusado(chaveId: string, request: Request) {
  erros.consumir(doEndereco(chaveId, request), ERROS_POR_ENDERECO);
  erros.consumir(daChave(chaveId), ERROS_POR_CHAVE);
}

export function cupomRecusado(): ErroApi {
  return new ErroApi("pedido_invalido", MENSAGEM_CUPOM_INVALIDO, {}, CUPOM_INVALIDO);
}

export const ConsultaDeCupom = z
  .object({
    codigo: z.string().trim().min(1).max(40),
    itens: z.array(z.object({ id: z.string().trim().min(1).max(80), quantidade: z.number().int().min(1).max(999) }).strict()).min(1).max(50),
    /** Só para cupom de frete grátis: com o CEP, a resposta traz as opções de entrega já com ele. */
    cep: z.string().trim().min(8, "CEP com 8 dígitos").max(9).optional(),
  })
  .strict();

/**
 * Confere um cupom para um carrinho. Só informa: quem aplica é a compra, que
 * calcula tudo de novo.
 */
export async function conferirCupomPelaApi(tenant: Tenant, chave: Pick<ChaveApi, "id">, request: Request, consulta: z.infer<typeof ConsultaDeCupom>) {
  exigirTentativaDeCupom(chave.id, request);

  const itens = await resolverItensDoCatalogo(tenant.id, consulta.itens);
  if (itens.length !== consulta.itens.length) {
    throw new ErroApi("pedido_invalido", "Algum item do carrinho não está disponível.", {}, "item_indisponivel");
  }
  const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const r = await buscarCupomValido(tenant.id, normalizarCodigo(consulta.codigo), subtotal);
  if (!("cupom" in r)) {
    registrarCupomRecusado(chave.id, request);
    throw cupomRecusado();
  }

  const freteGratis = r.cupom.tipo === "FRETE_GRATIS";
  return {
    codigo: r.cupom.codigo,
    tipo: r.cupom.tipo,
    descontoCentavos: descontoDoCupom(r.cupom, itens),
    ...(freteGratis && consulta.cep ? { fretes: (await cotarFrete(tenant, consulta.cep, itens, { freteGratisCupom: true })).map(freteDaVitrine) } : {}),
  };
}
