/**
 * Nome de balcão vira nome de vitrine.
 *
 * O catálogo industrial nasce no sistema do lojista com nome que serve a quem
 * atende, não a quem procura: `RET.49X65X10 BAG T.B`. Isso quebra duas coisas
 * ao mesmo tempo:
 *
 * 1. **O preditor de categoria do Mercado Livre erra.** Testado em 02/09/2026:
 *    "Rolamento 6205 2RS" devolve *Águas Minerais* em primeiro lugar, enquanto
 *    "Rolamento rígido de esferas 6205 2RS" devolve *Esferas de rolamento*.
 *    "Retentor 49x65x10" cai em retentor de máquina de lavar; com "de roda
 *    automotivo" na frente, acerta as três primeiras posições.
 * 2. **O Google também não acha.** Ninguém digita "RET.49X65X10 BAG T.B".
 *
 * A transformação é **determinística de propósito**. Ela só usa o que já está
 * no cadastro (abreviação conhecida, grupo, marca, medida) e nunca inventa
 * aplicação: dizer "para Fiat Uno" sem o dado é pior que não dizer nada, porque
 * o comprador devolve a peça e a culpa é da loja. Onde falta informação, o nome
 * fica mais curto, não mais criativo.
 */

/** Abreviação de balcão que o setor usa, e o que ela quer dizer por extenso. */
const ABREVIACOES: Array<[RegExp, string]> = [
  [/^RET\.?/i, "Retentor"],
  [/^ROL\.?/i, "Rolamento"],
  [/^CORR\.?/i, "Correia"],
  [/^MANG\.?/i, "Mangueira"],
  [/^GAX\.?/i, "Gaxeta"],
  [/^ANEL/i, "Anel"],
  [/^BUCH\.?/i, "Bucha"],
  [/^MANC\.?/i, "Mancal"],
  [/^ABRAC\.?/i, "Abraçadeira"],
  [/^VED\.?/i, "Vedação"],
];

/**
 * Termo que ajuda o comprador e o preditor a entender do que se trata.
 *
 * Só entra quando o grupo do produto comprova. Não é enfeite: é o que separa
 * "retentor de máquina de lavar" de "retentor de roda".
 */
const QUALIFICADOR: Record<string, string> = {
  // "de vedação" não move o preditor: testado em 02/09/2026, "Retentor de
  // vedação 49x65x10" continua caindo em Águas minerais. "para veículos" leva
  // para Retentores para veículos, e é o termo que o próprio ML usa no nome do
  // domínio, o que explica por que ele reconhece.
  //
  // Não uso "de roda", que funciona igual: a Vedashow vende retentor
  // industrial e automotivo, e o dado não distingue os dois. "para veículos" é
  // amplo o bastante para não afirmar aplicação que não temos.
  RETENTOR: "para veículos",
  ROLAMENTO: "rígido de esferas",
  GAXETA: "de vedação",
  MANCAL: "de rolamento",
  CORREIA: "de transmissão",
};

/** Ruído de sistema antigo: código de depósito, sufixo de embalagem. */
const RUIDO = /\b(T\.?B|BAG|CX|PCT|UND?|EMB)\b\.?/gi;

const MEDIDA = /\b\d+([.,]\d+)?\s*[xX×]\s*\d+([.,]\d+)?(\s*[xX×]\s*\d+([.,]\d+)?)?\b/;

export interface EntradaNome {
  /** Nome como está no cadastro do lojista. */
  nome: string;
  /** Grupo do catálogo (Retentor, Rolamento). É o que dá confiança. */
  grupo?: string | null;
  marca?: string | null;
}

export interface NomeEnriquecido {
  /** O nome para vitrine e para o preditor. */
  nome: string;
  /** Mudou em relação ao original. */
  mudou: boolean;
  /** O que foi usado, para o lojista entender e para o teste conferir. */
  aplicou: string[];
}

/** Unidade de medida é escrita em minúscula por norma, e "3,25 Mm" além de
 *  feio está errado: Mm é megametro. */
const UNIDADES = new Set(["mm", "cm", "m", "kg", "g", "pol", "un", "mt", "l", "ml", "a", "v", "w"]);

function capitalizar(p: string): string {
  // Medida e sigla curta continuam como estão: "49x65x10" e "2RS" são dados.
  if (/^[\d.,/xX×-]+$/.test(p) || (p.length <= 4 && p === p.toUpperCase() && /[A-Z]/.test(p))) return p;
  if (UNIDADES.has(p.toLowerCase())) return p.toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/**
 * Transforma o nome, sem inventar.
 *
 * A ordem importa: expande a abreviação, tira o ruído, acrescenta o
 * qualificador do grupo e só então a marca. O qualificador entra depois da
 * palavra principal e antes da medida, que é como o comprador lê.
 */
export function enriquecerNome(entrada: EntradaNome): NomeEnriquecido {
  const original = entrada.nome.trim();
  const aplicou: string[] = [];

  let t = original.replace(/\s+/g, " ").trim();

  // 1. Abreviação vira palavra.
  let principal = "";
  for (const [padrao, palavra] of ABREVIACOES) {
    if (padrao.test(t)) {
      t = t.replace(padrao, "").trim();
      principal = palavra;
      aplicou.push(`abreviação ${palavra.toLowerCase()}`);
      break;
    }
  }

  // 2. Ruído de sistema sai.
  const antes = t;
  t = t.replace(RUIDO, " ").replace(/\s+/g, " ").trim();
  if (t !== antes) aplicou.push("ruído removido");

  // 3. Sem abreviação conhecida, o grupo dá a palavra principal, e só quando o
  //    nome ainda não a contém: senão vira "Correia Correia 5PK".
  const grupo = (entrada.grupo ?? "").trim().toUpperCase();
  if (!principal && grupo && grupo !== "DIVERSOS") {
    const jaTem = new RegExp(`\\b${grupo}`, "i").test(t);
    if (!jaTem) {
      principal = capitalizar(grupo);
      aplicou.push("grupo como palavra principal");
    }
  }

  const partes = t.split(" ").filter(Boolean).map(capitalizar);
  const corpo = partes.join(" ");

  // 4. Qualificador do grupo: é o que muda a previsão de categoria.
  const chave = grupo || principal.toUpperCase();
  const qualificador = QUALIFICADOR[chave];
  let nome = principal ? `${principal} ${corpo}`.trim() : corpo;

  if (qualificador && principal) {
    // Entra logo depois da palavra principal, antes da medida.
    nome = `${principal} ${qualificador} ${corpo}`.replace(/\s+/g, " ").trim();
    aplicou.push("qualificador do grupo");
  }

  // 5. Marca no fim, quando existe e ainda não aparece.
  const marca = (entrada.marca ?? "").trim();
  if (marca && marca.toUpperCase() !== "DIVERSOS" && !new RegExp(`\\b${marca}\\b`, "i").test(nome)) {
    nome = `${nome} ${marca}`;
    aplicou.push("marca");
  }

  nome = nome.replace(/\s+/g, " ").trim();
  return { nome, mudou: nome !== original, aplicou };
}

/** O nome tem medida? É o sinal mais forte de que a peça é identificável. */
export function temMedida(nome: string): boolean {
  return MEDIDA.test(nome);
}
