import { preVooDaVitrine, rotaDaApi } from "@/lib/api-rotas";
import { lojaDaVitrine } from "@/lib/api-recursos";
import { lojaVende, urlDaLoja } from "@/lib/tenant";

/** GET /api/v1/vitrine/loja — o cabeçalho de um front próprio: nome, logo, contato, se vende. */
export const dynamic = "force-dynamic";

export const GET = rotaDaApi({ escopo: "vitrine:ler", navegador: true }, async ({ tenant }) => ({
  dados: lojaDaVitrine(tenant, urlDaLoja(tenant), lojaVende(tenant)),
}));

export const OPTIONS = preVooDaVitrine;
