import { slugificar } from "./catalogo";

/**
 * Categorias historicamente duplicadas que representam o mesmo departamento.
 *
 * A lista é fechada: singularizar qualquer palavra por regra juntaria nomes
 * que podem ter significados comerciais diferentes. Cada alias entra somente
 * depois de aparecer no catálogo real e ter um destino canônico conhecido.
 */
const ALIASES: Readonly<Record<string, string>> = {
  alicate: "alicate",
  alicates: "alicate",
  "anel-o-ring": "anel-o-ring",
  correia: "correia",
  correias: "correia",
  "o-ring": "anel-o-ring",
  "o-rings": "anel-o-ring",
  rolamento: "rolamento",
  rolamentos: "rolamento",
};

export function chaveCanonicaDaCategoria(valor: string): string {
  const slug = slugificar(valor);
  return ALIASES[slug] ?? slug;
}
