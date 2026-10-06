/**
 * O que, no domínio-base, mora na raiz de `src/app` e não em `src/app/plataforma`.
 *
 * No domínio-base o proxy reescreve todo caminho para `/plataforma/...`, que é
 * onde vivem a página de venda e o painel. Estas são as exceções, e cada uma
 * existe porque um endereço foi combinado com alguém de fora:
 *
 *   - `/api/` e `/v1/`: contratos de API;
 *   - `/ml/` e `/melhor-envio/`: retorno da autorização do Mercado Livre e do
 *     Melhor Envio. A URL está cadastrada no aplicativo de cada um;
 *   - `/canais/`: o mesmo retorno para Amazon, Shopee e Magalu
 *     (`/canais/<canal>/callback`).
 *
 * **Retorno de OAuth novo entra aqui no mesmo commit da rota.** Fora desta
 * lista o caminho vira `/plataforma/<rota>`, que não existe: o lojista autoriza
 * no serviço, volta num 404 e a conexão não é gravada. Nenhum teste de unidade
 * da rota pega isso, porque a rota em si está certa — quem a esconde é o proxy.
 */
export const PREFIXOS_DA_RAIZ = ["/api/", "/v1/", "/ml/", "/melhor-envio/", "/canais/"] as const;

/** `true` quando o caminho, no domínio-base, não deve ser reescrito para a plataforma. */
export function ficaNaRaiz(pathname: string): boolean {
  return pathname.startsWith("/plataforma") || PREFIXOS_DA_RAIZ.some((p) => pathname.startsWith(p));
}

/**
 * Retorno de autorização: a resposta carrega o `code` na URL e nunca pode ser
 * guardada por ninguém, nem pela borda.
 */
export function ehRetornoDeAutorizacao(pathname: string): boolean {
  return /^\/(ml|melhor-envio|canais\/[^/]+)\/callback\/?$/.test(pathname);
}
