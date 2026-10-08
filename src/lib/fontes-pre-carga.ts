/**
 * Acha, no CSS que o build gerou, os arquivos de uma família que valem
 * pré-carregar: recorte latino, estilo normal, pesos 400 e 700 (ou a fonte
 * variável que cobre os dois). Função pura, separada de `fontes-loja.ts` para
 * ser testada sem o `next/font`.
 */
export function extrairPreCargas(css: string, familia: string): string[] {
  const achados = new Map<string, string>();
  for (const bloco of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const nome = bloco.match(/font-family:\s*["']?([^;"'}]+)["']?/)?.[1]?.trim();
    if (nome !== familia || !/font-style:\s*normal/.test(bloco)) continue;
    // Recorte latino: o minificador escreve U+0000-00FF como `U+??`.
    if (!/unicode-range:\s*(U\+\?\?|U\+0{1,4}-0{0,2}FF)/i.test(bloco)) continue;
    const peso = bloco.match(/font-weight:\s*([\d ]+)/)?.[1]?.trim() ?? "";
    const [de, ate] = peso.split(/\s+/).map(Number);
    const arquivo = bloco.match(/url\(["']?[^)"']*\/media\/([^)"']+\.woff2)["']?\)/)?.[1];
    if (!arquivo) continue;
    for (const alvo of [400, 700]) if (ate ? de <= alvo && alvo <= ate : de === alvo) achados.set(arquivo, `/_next/static/media/${arquivo}`);
  }
  return [...achados.values()];
}

