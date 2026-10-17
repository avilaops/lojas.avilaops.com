/**
 * Chave Pix: tipo e formato, para a conexão `pix_direto`.
 *
 * Valida só o formato (o DICT é que sabe se a chave existe). Telefone sai em
 * +55DDDNÚMERO, CPF/CNPJ só dígitos, e-mail em minúsculas, EVP em minúsculas.
 */
export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export type ChavePixValidada =
  | { ok: true; tipo: TipoChavePix; chave: string }
  | { ok: false; mensagem: string };

function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + p * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/** Com `tipo`, confere contra ele; sem, descobre pelo formato. */
export function validarChavePix(entrada: string, tipo?: TipoChavePix): ChavePixValidada {
  const v = (entrada ?? "").trim();
  if (!v) return { ok: false, mensagem: "Informe a chave Pix." };
  const digitos = v.replace(/\D/g, "");

  const tentar = (t: TipoChavePix): ChavePixValidada | null => {
    switch (t) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 77 ? { ok: true, tipo: t, chave: v.toLowerCase() } : null;
      case "aleatoria":
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? { ok: true, tipo: t, chave: v.toLowerCase() } : null;
      case "cpf":
        return /^[\d.\-\s]+$/.test(v) && cpfValido(digitos) ? { ok: true, tipo: t, chave: digitos } : null;
      case "cnpj":
        return /^[\d./\-\s]+$/.test(v) && cnpjValido(digitos) ? { ok: true, tipo: t, chave: digitos } : null;
      case "telefone": {
        if (!/^\+?[\d\s()\-]+$/.test(v)) return null;
        const n = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : digitos;
        return /^[1-9]{2}9?\d{8}$/.test(n) ? { ok: true, tipo: t, chave: `+55${n}` } : null;
      }
    }
  };

  if (tipo) {
    return tentar(tipo) ?? { ok: false, mensagem: MENSAGENS[tipo] };
  }
  // Sem tipo: 11 dígitos é ambíguo (CPF ou celular). CPF válido ganha; quem
  // quer o celular escolhe o tipo "telefone" na tela.
  for (const t of ["email", "aleatoria", "cnpj", "cpf", "telefone"] as const) {
    const r = tentar(t);
    if (r) return r;
  }
  return { ok: false, mensagem: "Essa chave Pix não parece válida. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória." };
}

const MENSAGENS: Record<TipoChavePix, string> = {
  cpf: "CPF inválido. Confira os 11 números.",
  cnpj: "CNPJ inválido. Confira os 14 números.",
  email: "E-mail inválido.",
  telefone: "Celular inválido. Use DDD e número, por exemplo (11) 91234-5678.",
  aleatoria: "Chave aleatória inválida. Copie do app do banco, com os tracinhos.",
};
