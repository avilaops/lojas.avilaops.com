/**
 * O painel tem um domínio público configurado. A URL interna do Next standalone
 * usa o hostname/porta do container e não serve para validar o Origin do navegador.
 * Cabeçalhos Host e X-Forwarded-* também não autorizam uma origem por conta própria.
 */
export function origemFiscalPermitida(
  request: Request,
  dominioBase = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com",
  producao = process.env.NODE_ENV === "production",
): boolean {
  const dominio = dominioBase.toLowerCase();
  const origem = request.headers.get("origin");
  if (origem === `https://${dominio}`) return true;

  // HTTP só existe no desenvolvimento local, com host e porta exatos.
  if (producao || !["localhost", "127.0.0.1", "[::1]"].includes(dominio)) return false;
  const url = new URL(request.url);
  return url.hostname === dominio && origem === url.origin;
}
