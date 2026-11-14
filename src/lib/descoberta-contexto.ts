/** Contexto explícito de leitura; rotas novas ficam fora até serem revisadas. */
export function paginaPermiteDescoberta(caminho: string, consulta: string, plataforma: boolean): boolean {
  if (consulta || /[%\\]/.test(caminho) || caminho.includes("//") || caminho.split("/").some((parte) => parte === "." || parte === "..")) return false;
  const pagina = caminho.replace(/\/$/, "") || "/";
  if (plataforma) {
    return ["/", "/ajuda", "/developers", "/developers/privacidade", "/marca", "/termos-comerciais", "/blog"].includes(pagina)
      || /^\/blog\/[^/]+$/.test(pagina);
  }
  return ["/", "/produtos", "/sobre", "/contato", "/blog"].includes(pagina)
    || /^\/(produtos|categoria|blog)\/[^/]+$/.test(pagina)
    || /^\/politicas\/(envio|devolucao|privacidade|termos|aviso-legal)$/.test(pagina);
}

/** Usa somente os nomes dos cookies, nunca envia os valores ao navegador. */
export function requisicaoTemSessaoPrivada(cookies: string | null): boolean {
  return (cookies ?? "").split(";").some((cookie) => ["loja_conta", "lojas_sessao", "minha-moto"].includes(cookie.trim().split("=", 1)[0]));
}
