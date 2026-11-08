import type { ProdutoCotacaoDomiRio } from "./domirio-comercial";

export type OfertaCotacaoDomiRio = ProdutoCotacaoDomiRio & {
  id: string; produtoId: string; padrao: boolean; estoque: number | null; disponivel: boolean;
};
export type LinhaCotacaoDomiRio = { id: string; quantidade: number };
export const LIMITE_LISTA_DOMIRIO = 50;

function quantidadeValida(n: number) { return Number.isSafeInteger(n) && n >= 1 && n <= 99999; }

export function adicionarLinhaDomiRio(lista: LinhaCotacaoDomiRio[], id: string, quantidade: number): LinhaCotacaoDomiRio[] {
  if (!quantidadeValida(quantidade)) throw new Error("Informe uma quantidade inteira entre 1 e 99999.");
  const anterior = lista.find(l => l.id === id);
  if (anterior) {
    if (!quantidadeValida(anterior.quantidade + quantidade)) throw new Error("A quantidade acumulada ultrapassa 99999 unidades.");
    return lista.map(l => l.id === id ? { ...l, quantidade: l.quantidade + quantidade } : l);
  }
  if (lista.length >= LIMITE_LISTA_DOMIRIO) throw new Error("Use até 50 apresentações por cotação.");
  return [...lista, { id, quantidade }];
}

/** Nada do nome, preço ou código salvo no navegador é autoridade sobre o catálogo. */
export function restaurarListaDomiRio(entrada: unknown, ofertas: OfertaCotacaoDomiRio[]): LinhaCotacaoDomiRio[] {
  if (!Array.isArray(entrada)) return [];
  let lista: LinhaCotacaoDomiRio[] = [];
  for (const item of entrada.slice(0, LIMITE_LISTA_DOMIRIO)) {
    if (!item || typeof item !== "object") continue;
    const { id, quantidade } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof quantidade !== "number" || !quantidadeValida(quantidade) || !ofertas.some(o => o.id === id)) continue;
    try { lista = adicionarLinhaDomiRio(lista, id, quantidade); } catch { /* Mantém o que passou na conferência. */ }
  }
  return lista;
}

export function importarCarrinhoDomiRio(itens: LinhaCotacaoDomiRio[], ofertas: OfertaCotacaoDomiRio[]) {
  return restaurarListaDomiRio(itens.map(item => ({ ...item, id: ofertas.find(o => o.id === item.id || (o.produtoId === item.id && o.padrao))?.id ?? "" })), ofertas);
}

export function mensagemListaDomiRio(lista: LinhaCotacaoDomiRio[], ofertas: OfertaCotacaoDomiRio[], base: string, cep = "") {
  if (!lista.length || lista.length > LIMITE_LISTA_DOMIRIO) throw new Error("Adicione de 1 a 50 apresentações à cotação.");
  const cepLimpo = cep.trim();
  if (cepLimpo && !/^\d{5}-?\d{3}$/.test(cepLimpo)) throw new Error("Informe um CEP com 8 números ou deixe o campo vazio.");
  const linhas = lista.map((l, i) => {
    const o = ofertas.find(o => o.id === l.id);
    if (!o || !quantidadeValida(l.quantidade)) throw new Error("Revise os produtos e as quantidades da lista.");
    const url = new URL(`/produtos/${encodeURIComponent(o.slug)}`, base);
    if (o.varianteId) url.searchParams.set("variante", o.varianteId);
    const confirmar = !o.disponivel || (o.estoque !== null && l.quantidade > o.estoque);
    return `${i + 1}. ${o.nome}${o.apresentacao ? ` · ${o.apresentacao}` : ""}${o.sku ? `\nCódigo: ${o.sku}` : ""}\nQuantidade: ${l.quantidade} ${l.quantidade === 1 ? "unidade" : "unidades"}${confirmar ? " · Confirmar disponibilidade" : ""}\n${url.href}`;
  });
  const mensagem = ["Olá, Domi-Rio! Gostaria de cotar esta lista:", ...linhas, cepLimpo ? `CEP de entrega: ${cepLimpo.replace(/^(\d{5})(\d{3})$/, "$1-$2")}` : null, "Favor confirmar disponibilidade, apresentações, pagamento e frete. Esta consulta não constitui um pedido."].filter(Boolean).join("\n\n");
  if (mensagem.length > 7500) throw new Error("A lista ficou longa para o WhatsApp. Divida em duas cotações.");
  return mensagem;
}
