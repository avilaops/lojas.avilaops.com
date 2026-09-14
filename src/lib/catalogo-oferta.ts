import type { Prisma } from "@prisma/client";

export const INCLUIR_OFERTA = { preco: true, saldos: true } satisfies Prisma.VarianteInclude;
export type VarianteOferta = Prisma.VarianteGetPayload<{ include: typeof INCLUIR_OFERTA }>;

export function ofertaDaVariante<T extends VarianteOferta>(v: T) {
  const controlados = v.saldos.filter(s => s.fisico != null);
  const estoque = v.saldos.some(s => s.fisico == null) ? null : controlados.reduce((total, s) => total + s.fisico! - s.reservado, 0);
  return {
    ...v, precoCentavos: v.preco?.valorCentavos ?? 0,
    precoDeCentavos: v.preco?.comparacaoCentavos ?? null,
    estoque,
    // Sem saldo cadastrado, a disponibilidade é desconhecida, não infinita.
    compravel: v.ativo && Boolean(v.preco && v.preco.valorCentavos > 0) && v.disponibilidade !== "out_of_stock" && v.saldos.length > 0 && (estoque == null || estoque > 0),
  };
}

export function gtinValido(valor: string | null | undefined): boolean {
  if (!valor || !/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(valor)) return false;
  if (/^0+$/.test(valor)) return false;
  const digitos = valor.split("").map(Number);
  const verificador = digitos.pop();
  const soma = digitos.reverse().reduce((n, d, i) => n + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - soma % 10) % 10 === verificador;
}

export class ErroCatalogo extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}

/** Não depende de Next: importação, rotas e testes executam o mesmo contrato. */
export function validarGrade(opcoes: string[], variantes: { valores: Record<string, string>; precoCentavos?: number | null }[]) {
  if (new Set(opcoes).size !== opcoes.length) throw new ErroCatalogo("As opções não podem se repetir.");
  if (!variantes.length) return;
  if (!opcoes.length) throw new ErroCatalogo("Informe as opções das variações.");
  const vistas = new Set<string>();
  for (const v of variantes) {
    if (Object.keys(v.valores).length !== opcoes.length || opcoes.some(o => !v.valores[o]?.trim())) throw new ErroCatalogo("Preencha todas as opções de cada variação.");
    const chave = JSON.stringify(opcoes.map(o => v.valores[o]));
    if (vistas.has(chave)) throw new ErroCatalogo("Há combinações de opções repetidas.");
    vistas.add(chave);
    if (!Number.isSafeInteger(v.precoCentavos) || v.precoCentavos! < 0) throw new ErroCatalogo("Cada variação precisa do próprio preço. Use zero para preço sob consulta.");
  }
}
