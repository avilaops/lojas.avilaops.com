/**
 * Os três planos, num lugar só: a página inicial, o cadastro (/criar) e o
 * JSON-LD de oferta leem daqui. Antes o cadastro tinha a própria lista, sem
 * preço, e a mesma escolha aparecia com nomes e promessas diferentes em cada
 * tela. Preço em reais inteiros por mês; ver docs/PLANOS.md.
 */
export const PLANOS = [
  {
    id: "SITE",
    nome: "Site",
    rotulo: "Para quem vende pelo WhatsApp",
    preco: 110,
    descricao: "Catálogo com preço no ar e pedido pelo WhatsApp, sem responder \"quanto é?\" o dia inteiro.",
    destaque: false,
    itens: ["Vitrine e catálogo com preço", "Pedido pelo WhatsApp", "Domínio, SSL e hospedagem", "E-mail profissional", "Painel simples"],
  },
  {
    id: "LOJA",
    nome: "Loja",
    rotulo: "O mais escolhido",
    preco: 269,
    destaque: true,
    descricao: "A loja completa: o cliente escolhe, paga na hora e você só vê o pedido chegar.",
    itens: ["Tudo do Site", "Carrinho e checkout na sua loja", "Pix na hora, cartão e boleto", "Frete por CEP e retirada na loja", "Cupons, variações e estoque", "Google Shopping, carrinho abandonado e avaliações", "Relatório semanal no e-mail"],
  },
  {
    id: "LOJA_PRO",
    nome: "Loja Pro",
    rotulo: "Para quem já vende muito",
    preco: 497,
    descricao: "Para distribuidor e atacado: domínio próprio, prioridade no atendimento e conversa com o sistema que você já usa.",
    destaque: false,
    itens: ["Tudo da Loja", "Domínio próprio da sua marca", "Cotação para revenda pelo WhatsApp", "Integração com o seu sistema", "Prioridade de suporte"],
  },
] as const;

export type IdPlano = (typeof PLANOS)[number]["id"];

export function planoPorId(id: string) {
  return PLANOS.find((p) => p.id === id);
}

/** "R$ 269/mês" */
export function mensalidade(preco: number): string {
  return `R$ ${preco.toLocaleString("pt-BR")}/mês`;
}
