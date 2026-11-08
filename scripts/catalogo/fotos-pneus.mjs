/** Identidade conservadora: não trata parte do nome como modelo completo. */
const normalizar = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function identidadePneu(nome, marca) {
  if (!marca || /\b(SEMI\s*NOVO|USADO)\b/i.test(nome)) return null;
  const medida = nome.match(/\b(\d{3})\s*\/\s*(\d{2})\s*(?:\/|ZR?|R)\s*(\d{2})\b/i);
  if (!medida) return null;
  const indice = nome.match(/\b(\d{2,3})\s*\(?([A-Z])\)?\b/i);
  let modelo = nome.replace(medida[0], " ").replace(/^PNEU\s*/i, "").replace(/\b\d{2,3}\s*\(?[A-Z]\)?\b/gi, " ").replace(/\b(?:XL|TL|EXTRA\s*LOAD)\b/gi, " ");
  const aliases = [marca, ...(marca === "Michelin" ? ["MICHELLIN"] : []), ...(marca === "Accelera" ? ["ACELLERA"] : []), ...(marca === "Linglong" ? ["LING LONG"] : [])];
  for (const alias of aliases) modelo = modelo.replace(new RegExp(escapar(alias), "ig"), " ");
  modelo = normalizar(modelo);
  if (!modelo) return null;
  return { marca: normalizar(marca), medida: medida.slice(1).join("/"), modelo, indice: indice ? indice[1] + indice[2].toUpperCase() : null };
}
export function mesmoPneu(nome, marca, tituloFonte) {
  const a = identidadePneu(nome, marca), b = identidadePneu(tituloFonte, marca);
  return Boolean(a && b && normalizar(tituloFonte).includes(a.marca) && a.medida === b.medida && a.modelo === b.modelo && (!a.indice || a.indice === b.indice));
}
