/** Acabamentos distintos nunca herdam a mesma foto por semelhança do nome. */
export function corDaRoda(texto, marca) {
  const n = texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();
  if (/\b(FUME|SMOKE|BDS|BDF|SHADOW)\b/.test(n)) return null;
  if (/\b(PRET[AO]|GRAFITE)\s+DIAM(?:ANTAD[AO])?\b/.test(n)) {
    if (/\b(FOSCO|FOSCA|GOLD|DOURAD[AO])\b/.test(n)) return null;
    return /\bGRAFITE\b/.test(n) ? "grafite-diamantado" : "preto-diamantado";
  }
  if (marca === "KRMAI") {
    if (/\bBD\b/.test(n)) return "preto-diamantado";
    if (/\bGD\b/.test(n)) return "grafite-diamantado";
  }
  if (/\bPRATA\b/.test(n) && !/DIAM|HYPER|FOSC|GLOSS/.test(n)) return "prata";
  if (/\bBLACK\s+PIANO\b/.test(n)) return "black-piano";
  return null;
}
