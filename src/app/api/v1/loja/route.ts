import { rotaDaApi } from "@/lib/api-rotas";
import { lojaDaApi } from "@/lib/api-recursos";
import { urlDaLoja } from "@/lib/tenant";
import { ESCOPOS } from "@/lib/api-chaves";

/**
 * GET /api/v1/loja — a loja dona da chave, e o que a chave pode.
 *
 * É a primeira chamada de quem integra: confirma que a chave funciona, de qual
 * loja ela é e quais escopos tem, sem precisar adivinhar pelo 403.
 */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi({ escopo: "loja:ler" }, async ({ tenant, chave }) => ({
  dados: {
    ...lojaDaApi(tenant, urlDaLoja(tenant)),
    chave: { tipo: chave.tipo, escopos: chave.escopos.map((e) => ({ escopo: e, descricao: ESCOPOS[e as keyof typeof ESCOPOS] ?? null })) },
  },
}));
