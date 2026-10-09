import type { Plano } from "@prisma/client";

/**
 * Faixas de preço antigas: o "anúncio que não vale mais".
 *
 * A tabela pública tem três planos (`PLANOS`, em planos.ts). Quem fechou por um
 * preço que já saiu de tabela continua pagando o que combinou, e esse preço
 * mora aqui. Uma faixa antiga **não aparece** em página pública, no cadastro
 * nem na troca de plano do lojista: só a administração da Ávila Ops atribui
 * (`POST /api/admin/tenants/<slug>/faixa`), loja por loja.
 *
 * Este arquivo é só de servidor de propósito — não importe em componente de
 * cliente, para o preço antigo não ir para o JavaScript da vitrine.
 *
 * Faixa nova entra aqui com um id que nunca muda (fica gravado em
 * `Tenant.faixaPreco`). Faixa não se apaga enquanto houver loja nela: marque
 * `fechada` e ela deixa de poder ser atribuída, sem tirar o preço de quem tem.
 */
export const FAIXAS_ANTIGAS = {
  "loja-pro-350": {
    plano: "LOJA_PRO",
    centavos: 35000,
    nome: "Loja Pro, tabela antiga",
    /** Por que existe, para quem ler daqui a um ano. */
    nota: "Preço da Loja Pro de quem fechou antes da tabela de R$ 497 (Brilhax e Vedashow, 2026).",
    fechada: false,
  },
} as const satisfies Record<string, { plano: Plano; centavos: number; nome: string; nota: string; fechada: boolean }>;

export type IdFaixaAntiga = keyof typeof FAIXAS_ANTIGAS;

/** A tabela pública de hoje, em centavos. É a mesma de `PLANOS` (planos.ts), que está em reais. */
export const PRECO_DE_TABELA: Record<Plano, number> = { SITE: 11000, LOJA: 26900, LOJA_PRO: 49700 };

export function faixaAntiga(id: string | null | undefined) {
  return id && id in FAIXAS_ANTIGAS ? FAIXAS_ANTIGAS[id as IdFaixaAntiga] : null;
}

/**
 * A faixa que vale para a loja, ou `null`. Só vale enquanto o plano da loja for
 * o da faixa: trocou de plano, saiu do anúncio antigo e paga a tabela.
 */
export function faixaDaLoja(t: { plano: Plano; faixaPreco: string | null }) {
  const f = faixaAntiga(t.faixaPreco);
  return f && f.plano === t.plano ? f : null;
}

/** Quanto a loja paga por mês, em centavos: a faixa antiga dela, ou a tabela do plano. */
export function mensalidadeDaLoja(t: { plano: Plano; faixaPreco: string | null }): number {
  return faixaDaLoja(t)?.centavos ?? PRECO_DE_TABELA[t.plano];
}

export const precoDeTabela = (plano: Plano) => PRECO_DE_TABELA[plano];
