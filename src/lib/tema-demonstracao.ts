import type { TemaLoja } from "./tema";

/**
 * Loja de demonstração do template `automotivo-premium`.
 *
 * Conteúdo neutro, de nenhum cliente: serve para o teste de contrato do tema
 * exercitar todos os campos de `premium` e para a futura pré-visualização no
 * painel mostrar o template cheio antes de a loja ter texto e foto próprios.
 * Se um campo novo entrar no schema, o teste cobra a entrada aqui — é o que
 * impede o template de crescer com campo que ninguém preenche nem revisa.
 *
 * As imagens apontam para os arquivos do próprio template
 * (`public/media/automotivo-premium/`), nunca para o acervo de uma loja.
 */
export const TEMA_PREMIUM_DEMONSTRACAO: TemaLoja = {
  corPrimaria: "#d62828",
  corPrimariaTexto: "#ffffff",
  corFundo: "#0b0b0c",
  corTexto: "#fafafa",
  modo: "escuro",
  fonte: "inter",
  raio: "suave",
  layout: "automotivo-premium",
  categoriaSemImagem: "ocultar",
  premium: {
    heroTitulo: "Cuidado automotivo do jeito certo",
    heroTexto: "Produtos separados por etapa do serviço, com a medida e o rendimento na ficha.",
    heroSelo: "Envio para todo o Brasil",
    buscaTitulo: "O que você vai fazer hoje?",
    buscaExemplo: "shampoo neutro, polidor, cera",
    editorialImagem: "/media/automotivo-premium/editorial-cuidado-v1.webp",
    editorialImagemSecundaria: "/media/automotivo-premium/editorial-vitrificacao-v1.webp",
    editorialTitulo: "Da lavagem à proteção",
    editorialTexto: "Cada etapa prepara a seguinte: lavar tira a sujeira, corrigir acerta a pintura, proteger faz durar.",
    logoEscuroUrl: "/media/automotivo-premium/simbolo-escuro-v1.webp",
    mostrarNome: true,
    etapas: [
      { categoria: "lavagem", titulo: "Lavagem", texto: "Shampoos, luvas e secagem sem risco.", icone: "lavagem" },
      { categoria: "polimento", titulo: "Correção", texto: "Polidores e boinas por nível de defeito.", icone: "polimento" },
      { categoria: "protecao", titulo: "Proteção", texto: "Ceras e selantes para manter o brilho.", icone: "protecao" },
    ],
  },
};
