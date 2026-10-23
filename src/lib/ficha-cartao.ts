import { fichaDoProduto, type LinhaDaFicha } from "./ficha";

const CAMPOS_DE_ESCOLHA = new Set(["perfil", "material", "dureza", "vedacao"]);

/**
 * Mantém no card somente o que ajuda a comparar peças sem abrir cada ficha.
 * A origem continua sendo a ficha saneada: medidas inválidas e campos vazios
 * nunca reaparecem por este atalho.
 */
export function fichaCompactaDoProduto(
  atributos: Record<string, unknown> | null | undefined,
): LinhaDaFicha[] {
  return fichaDoProduto(atributos)
    .filter((linha) => linha.unidade === "mm" || CAMPOS_DE_ESCOLHA.has(linha.chave))
    .slice(0, 5);
}

/** Unidade comercial cadastrada, sem inferir pelo nome ou pela embalagem. */
export function unidadeDeVenda(
  atributos: Record<string, unknown> | null | undefined,
): string | null {
  const valor = atributos?.unidade ?? atributos?.unidadeVenda;
  if (typeof valor !== "string") return null;
  const unidade = valor.trim();
  return unidade && unidade.length <= 20 ? unidade : null;
}
