/**
 * De onde veio a requisição, só para contar em limite por minuto.
 *
 * O endereço fica na memória do limitador por um minuto e em mais lugar nenhum:
 * não vai para log, métrica nem banco (a medição por loja não guarda IP, e isto
 * não é exceção). Atrás do Cloudflare o endereço real é o `cf-connecting-ip`.
 */
export function enderecoDaRequisicao(request: Request): string {
  const h = request.headers;
  return (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || "sem-origem";
}
