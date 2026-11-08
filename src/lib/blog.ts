import { POSTS, type Post } from "@/content/blog/indice";
export { POSTS, type Post };

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Os posts que já podem aparecer.
 *
 * A pauta é de um post por dia, e a data faz esse trabalho sozinha: o texto
 * entra escrito com a data em que deve aparecer e fica invisível até lá. Assim
 * dá para escrever a semana inteira numa tarde sem publicar tudo de uma vez,
 * que é o único jeito de sustentar um ritmo diário.
 */
export function postsPublicados(limite = hoje()): Post[] {
  return POSTS.filter((p) => p.publicadoEm <= limite).sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm));
}

export function acharPost(slug: string, limite = hoje()): Post | undefined {
  return postsPublicados(limite).find((p) => p.slug === slug);
}

/** Só o que é post de verdade; caminho da plataforma passa direto. */
export function tituloDoRelacionado(alvo: string, limite = hoje()): string | null {
  if (alvo.startsWith("/")) return null;
  return acharPost(alvo, limite)?.title ?? null;
}

/** Seis cores, rotativas pela ordem de publicação. A página do texto usa a
 *  mesma do cartão de onde o leitor veio, senão a troca de tela parece um
 *  site diferente. */
export function corDoPost(slug: string): number {
  const i = POSTS.findIndex((p) => p.slug === slug);
  return (i < 0 ? 0 : i) % 6;
}
