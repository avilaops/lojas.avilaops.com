/** Chunks de componentes podem ser pequenos; tamanho sozinho não prova falha. */
export function temRegrasCss(texto) {
  const css = texto.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  return !/^\s*(?:<!doctype|<html)/i.test(css) && /\{[^{}]*:[^{}]*\}/.test(css);
}
