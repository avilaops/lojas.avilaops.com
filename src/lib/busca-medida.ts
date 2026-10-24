export const CAMPOS_MEDIDA = [
  { prefixo: "di", rotulo: "Diâmetro interno" },
  { prefixo: "de", rotulo: "Diâmetro externo" },
  { prefixo: "alt", rotulo: "Altura" },
] as const;

export function paraMilimetros(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(limpo)) return null;
  const numero = Number(limpo.replace(",", "."));
  return numero > 0 && numero < 10000 ? numero : null;
}

export type TipoBuscaMedida = "aproximada" | "exata";

export function prepararBuscaMedida(valores: Record<string, string>, tipo: TipoBuscaMedida = "aproximada"):
  | { ok: true; query: string }
  | { ok: false; campo?: string; mensagem: string } {
  const params = new URLSearchParams();
  for (const { prefixo, rotulo } of CAMPOS_MEDIDA) {
    const texto = valores[prefixo] ?? "";
    if (!texto.trim()) continue;
    const mm = paraMilimetros(texto);
    if (mm === null) {
      return { ok: false, campo: prefixo, mensagem: `${rotulo}: informe um número maior que zero e menor que 10.000 mm, usando vírgula ou ponto decimal.` };
    }
    params.set(`${prefixo}_de`, String(tipo === "exata" ? mm : Math.max(0, +(mm - 0.5).toFixed(2))));
    params.set(`${prefixo}_ate`, String(tipo === "exata" ? mm : +(mm + 0.5).toFixed(2)));
  }
  if (!params.size) return { ok: false, mensagem: "Informe ao menos uma medida, em milímetros." };
  return { ok: true, query: params.toString() };
}
