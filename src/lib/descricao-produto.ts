import { textoPuro } from "./seo-texto";

/** Preserva parágrafos de importações HTML sem executar marcação do lojista. */
export function paragrafosDaDescricao(descricao: string): string[] {
  return descricao
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>/gi, "\n\n")
    // Algumas importações achatam até os parágrafos. Os marcadores continuam
    // sendo texto do cadastro; apenas recuperamos a separação visual.
    .replace(/\s+(?=✔|✓|Modo de uso\b|Indicação de uso\b|Especificações técnicas\b|O que este produto entrega\b|Resultado final\b|Dica profissional:)/g, "\n")
    .split(/\r?\n/)
    .map(textoPuro)
    .filter(Boolean)
    .flatMap(paragrafo => {
      if (paragrafo.length <= 400) return [paragrafo];
      const frases = paragrafo.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/);
      const grupos: string[] = [];
      for (const frase of frases) {
        const ultimo = grupos.length - 1;
        if (ultimo >= 0 && grupos[ultimo].length + frase.length < 400) grupos[ultimo] += ` ${frase}`;
        else grupos.push(frase);
      }
      return grupos;
    });
}
