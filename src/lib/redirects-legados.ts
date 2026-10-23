const HOST_VEDASHOW = "vedashow.com.br";

const DESTINOS_POR_CAMINHO = new Map<string, string>([
  ["/detalhe-produto/2408-uc209-rolamento", "/produtos?q=UC209"],
  ["/loja-grupo-produtos/3", "/produtos"],
]);

export function destinoLegado(host: string, pathname: string): string | null {
  const hostNormalizado = host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");

  if (hostNormalizado !== HOST_VEDASHOW) return null;

  return DESTINOS_POR_CAMINHO.get(pathname) ?? null;
}
