type LojaPesquisavel = { nome: string; slug: string; dominioPrincipal: string | null };

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function filtrarLojas<T extends LojaPesquisavel>(lojas: readonly T[], busca: string, base = ""): T[] {
  const termo = normalizar(busca);
  return lojas.filter((loja) => [loja.nome, loja.slug, loja.dominioPrincipal ?? (base ? `${loja.slug}.${base}` : "")]
    .some((valor) => normalizar(valor).includes(termo)));
}
