import { codigoExato, normalizarBusca } from "./busca-tecnica";
import { estadoDeVenda } from "./produto-regras";
import { referenciaAgelPk } from "./referencias-agel-pk";

export const LIMITES_COTACAO = { bytes: 32_768, linhas: 100, quantidade: 10_000, codigo: 120 } as const;
export type ItemCotacao = { codigo: string; quantidade: number };
export type ProdutoCotacao = {
  slug: string; nome: string; sku: string | null; codigoOriginal: string | null;
  codigosEquivalentes: string[]; atributos: unknown; ativo: boolean;
  precoCentavos: number; disponibilidade: string; estoque: number | null;
};
export type ResultadoCotacao = ItemCotacao & {
  estado: "encontrado" | "ambiguo" | "nao-encontrado" | "consulta-preco" | "esgotado";
  produtos: { slug: string; nome: string; codigo: string | null; precoCentavos: number | null }[];
  quantidadeAConfirmar: boolean;
};

/** CSV de duas colunas, com aspas escapadas e separador detectado fora de aspas. */
export function lerListaCotacao(texto: string): ItemCotacao[] {
  if (new TextEncoder().encode(texto).length > LIMITES_COTACAO.bytes) throw new Error("A lista deve ter até 32 KB.");
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) throw new Error("Informe ao menos um código e sua quantidade.");
  if (linhas.length > LIMITES_COTACAO.linhas + 1) throw new Error("Use no máximo 100 itens.");
  const registros = linhas.map((linha, indice) => {
    let aspas = false;
    let separador = ",";
    for (const c of linha) { if (c === '"') aspas = !aspas; if (!aspas && (c === ";" || c === "\t")) { separador = c; break; } }
    const campos: string[] = [];
    let campo = "";
    aspas = false;
    let fechado = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (aspas && linha[i + 1] === '"') { campo += '"'; i++; }
        else if (aspas) { aspas = false; fechado = true; }
        else if (!campo.trim() && !fechado) { aspas = true; campo = ""; }
        else throw new Error(`Aspas inválidas na linha ${indice + 1}.`);
      } else if (c === separador && !aspas) { campos.push(campo.trim()); campo = ""; fechado = false; }
      else { if (fechado && c.trim()) throw new Error(`CSV inválido na linha ${indice + 1}.`); campo += c; }
    }
    if (aspas) throw new Error(`Feche as aspas na linha ${indice + 1}.`);
    campos.push(campo.trim());
    if (campos.length !== 2) throw new Error(`Linha ${indice + 1}: use código e quantidade separados por ; ou vírgula.`);
    return campos;
  });
  if (["codigo", "código"].includes(registros[0][0].toLowerCase()) && ["quantidade", "qtd"].includes(registros[0][1].toLowerCase())) registros.shift();
  return validarItensCotacao(registros.map(([codigo, quantidade]) => ({ codigo, quantidade: /^\d+$/.test(quantidade) ? Number(quantidade) : NaN })));
}

export function validarItensCotacao(entrada: unknown): ItemCotacao[] {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > LIMITES_COTACAO.linhas) throw new Error("Informe de 1 a 100 itens.");
  return entrada.map((item: unknown, indice) => {
    if (!item || typeof item !== "object") throw new Error(`Item ${indice + 1} inválido.`);
    const { codigo, quantidade } = item as Record<string, unknown>;
    if (typeof codigo !== "string" || !codigo.trim() || codigo.trim().length > LIMITES_COTACAO.codigo || /[\x00-\x1f\x7f]/.test(codigo)) throw new Error(`Item ${indice + 1}: código inválido (até 120 caracteres).`);
    if (typeof quantidade !== "number" || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > LIMITES_COTACAO.quantidade) throw new Error(`Item ${indice + 1}: quantidade inteira entre 1 e 10.000.`);
    return { codigo: codigo.trim(), quantidade };
  });
}

export function resolverCotacao(itens: ItemCotacao[], catalogo: ProdutoCotacao[], vende: boolean): ResultadoCotacao[] {
  return itens.map((item): ResultadoCotacao => {
    const encontrados = catalogo.filter(p => {
      if (!p.ativo) return false;
      if (codigoExato(p, item.codigo)) return true;
      const referencia = referenciaAgelPk("pkvedacoes", p);
      const normalizarReferencia = (s: string) => normalizarBusca(s).replace(/[\s.-]/g, "").replace(/^agel/, "");
      return referencia !== null && normalizarReferencia(referencia.codigoAgel) === normalizarReferencia(item.codigo);
    });
    const unico = encontrados.length === 1 ? encontrados[0] : null;
    const venda = unico ? estadoDeVenda(unico, { vende }) : null;
    return {
      ...item,
      estado: !encontrados.length ? "nao-encontrado" : !unico ? "ambiguo" : venda?.esgotado ? "esgotado" : venda?.acao === "consulta-preco" ? "consulta-preco" : "encontrado",
      produtos: encontrados.map(p => ({ slug: p.slug, nome: p.nome, codigo: p.sku, precoCentavos: p.precoCentavos > 0 ? p.precoCentavos : null })),
      quantidadeAConfirmar: Boolean(unico && unico.estoque !== null && item.quantidade > unico.estoque),
    };
  });
}

export const ROTULOS_COTACAO = { encontrado: "Encontrado", ambiguo: "Mais de um produto: confirme o código", "nao-encontrado": "Não encontrado", "consulta-preco": "Preço sob consulta", esgotado: "Esgotado" };

export function mensagemCotacao(itens: ResultadoCotacao[]): string {
  return ["Olá! Quero cotar esta lista na PK Vedações:", ...itens.map((item, i) => `${i + 1}. ${item.codigo} | Quantidade: ${item.quantidade} | ${ROTULOS_COTACAO[item.estado]}${item.estado !== "ambiguo" && item.produtos[0] ? ` | ${item.produtos[0].nome} (${item.produtos[0].codigo ?? item.produtos[0].slug})` : ""}${item.quantidadeAConfirmar ? " | Confirmar quantidade disponível" : ""}`), "Favor confirmar aplicação, valores e disponibilidade. Esta lista não constitui pedido."].join("\n");
}

export function csvCotacao(itens: ResultadoCotacao[]): string {
  const celula = (valor: string | number) => { const s = String(valor); return `"${(/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"`; };
  return "\uFEFF" + [["Código", "Quantidade", "Situação", "Produtos", "Quantidade a confirmar"], ...itens.map(i => [i.codigo, i.quantidade, ROTULOS_COTACAO[i.estado], i.produtos.map(p => p.nome).join(" | "), i.quantidadeAConfirmar ? "Sim" : "Não"])].map(l => l.map(celula).join(";")).join("\r\n");
}
