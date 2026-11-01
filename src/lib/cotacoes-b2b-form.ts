export function centavosDoFormulario(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error("Informe os valores em reais, com até duas casas decimais.");
  const [inteiro, fracao = ""] = text.split(/[.,]/);
  const result = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 2_147_483_647) throw new Error("Valor acima do limite permitido.");
  return result;
}
