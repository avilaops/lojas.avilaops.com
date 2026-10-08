import { TemaSchema, VALORES_LAYOUT, contraste, type TemaLoja } from "./tema";
import { codificarRascunho } from "./previa-tema";

/**
 * Validação dos templates: a matriz de casos e o julgamento da medida.
 *
 * Tudo aqui é puro, sem banco, sem navegador e sem nada de requisição, para
 * ficar preso em `npm test`. Quem abre a prévia e mede é
 * `scripts/validar-templates.mts`; este arquivo só diz **o que** abrir e
 * **como julgar** o que voltou. Ver `docs/VALIDACAO-TEMPLATES.md`.
 */

/** 390×844 é o iPhone 14 Pro de `medir-mobile.mts`; 1280×800 é o notebook comum. */
export const VIEWPORTS = {
  movel: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const;

export type NomeViewport = keyof typeof VIEWPORTS;
export type Movimento = "normal" | "reduzido";

const NOMES_VIEWPORT = Object.keys(VIEWPORTS) as NomeViewport[];
const MODOS: TemaLoja["modo"][] = ["claro", "escuro"];
const MOVIMENTOS: Movimento[] = ["normal", "reduzido"];

/** Contraste mínimo do texto base sobre o fundo (WCAG AA, texto normal). */
export const CONTRASTE_MINIMO = 4.5;

export type CasoDeValidacao = {
  /** `<layout>.<viewport>.<modo>.<movimento>`: estável, serve de nome de arquivo. */
  id: string;
  layout: TemaLoja["layout"];
  viewport: NomeViewport;
  modo: TemaLoja["modo"];
  movimento: Movimento;
  /** Endereço da prévia no painel, com o tema do caso em `?t=`. */
  caminho: string;
};

/** O que o script mede em cada caso, dentro de `div[data-layout]`. */
export type MedidaDoCaso = {
  /** `data-layout` do contêiner da prévia; `null` quando ela não desenhou. */
  layoutDesenhado: string | null;
  /** `data-modo` do `<html>`. */
  modoNoHtml: string | null;
  /** Quanto a página passa da largura da tela. */
  vazaLateralPx: number;
  /** Primeiro elemento que passa da borda direita. */
  culpado: string | null;
  /** Exceções da página e `console.error`. */
  errosDePagina: string[];
  /** Cor e fundo computados do `body`, em hex. */
  corTexto: string;
  corFundo: string;
  /** `document.getAnimations().length`. */
  animacoesAtivas: number;
  /** Elementos (e `::before`/`::after`) com `transition-duration` maior que 0. */
  transicoesComDuracao: number;
};

/**
 * Os 96 casos: cada layout em cada viewport, modo e preferência de movimento.
 *
 * O tema do caso é o padrão do schema com o layout e o modo trocados. O
 * Automotivo Premium é o único com conteúdo próprio (`tema.premium`): sem ele
 * a prévia desenharia o template vazio, então o caso parte do tema preenchido
 * que o script entrega e troca só o modo.
 */
export function casosDeValidacao(temaPremium?: Record<string, unknown>): CasoDeValidacao[] {
  const casos: CasoDeValidacao[] = [];
  for (const layout of VALORES_LAYOUT) {
    for (const viewport of NOMES_VIEWPORT) {
      for (const modo of MODOS) {
        const tema = TemaSchema.parse(
          layout === "automotivo-premium" ? { ...temaPremium, layout, modo } : { layout, modo },
        );
        const caminho = `/painel/previa?t=${codificarRascunho(tema)}`;
        for (const movimento of MOVIMENTOS) {
          casos.push({ id: `${layout}.${viewport}.${modo}.${movimento}`, layout, viewport, modo, movimento, caminho });
        }
      }
    }
  }
  return casos;
}

/** As falhas do caso, em português. Lista vazia = passou. */
export function avaliarMedida(caso: CasoDeValidacao, medida: MedidaDoCaso): string[] {
  const falhas: string[] = [];

  // Pelo `data-layout` e não pelo texto da mensagem de erro: o texto muda, o
  // atributo é o que a loja publicada também usa.
  if (medida.layoutDesenhado !== caso.layout) {
    falhas.push(`a prévia não desenhou o layout (data-layout: ${medida.layoutDesenhado ?? "ausente"})`);
  }
  if (medida.modoNoHtml !== caso.modo) {
    falhas.push(`modo no <html> é ${medida.modoNoHtml ?? "ausente"}, esperado ${caso.modo}`);
  }
  if (medida.vazaLateralPx > 0) {
    falhas.push(`vaza ${medida.vazaLateralPx}px de lado (${medida.culpado ?? "culpado não identificado"})`);
  }
  if (medida.errosDePagina.length > 0) {
    falhas.push(`${medida.errosDePagina.length} erro(s) de página: ${medida.errosDePagina.slice(0, 3).join(" | ")}`);
  }
  const razao = contraste(medida.corTexto, medida.corFundo);
  // `!(>=)` e não `<`: cor que não veio em hex dá NaN, e NaN não pode passar.
  if (!(razao >= CONTRASTE_MINIMO)) {
    falhas.push(`contraste do texto base ${Number.isNaN(razao) ? "não mensurável" : razao.toFixed(2)} (${medida.corTexto} sobre ${medida.corFundo}), mínimo ${CONTRASTE_MINIMO}`);
  }
  if (caso.movimento === "reduzido") {
    if (medida.animacoesAtivas > 0) falhas.push(`${medida.animacoesAtivas} animação(ões) ativa(s) com movimento reduzido`);
    if (medida.transicoesComDuracao > 0) falhas.push(`${medida.transicoesComDuracao} elemento(s) com transição com movimento reduzido`);
  }
  return falhas;
}

/**
 * Erro de console que a prévia provoca e o template não: os links da home
 * apontam para páginas da loja, que não existem no domínio do painel (por isso
 * o palco é `inert`). O Next pré-carrega cada um, recebe 404 e o navegador
 * registra o erro. Só o 404: um 500 (ou qualquer outro status) no
 * pré-carregamento é defeito e reprova. O status sai do texto do Chromium
 * (`…responded with a status of 404 (Not Found)`); texto diferente não casa e
 * o erro reprova, que é o lado barulhento.
 */
export function ePreCarregamentoDeLink(endereco: string, texto: string): boolean {
  if (!/\bstatus of 404\b/.test(texto)) return false;
  try {
    const url = new URL(endereco);
    return url.searchParams.has("_rsc") && url.pathname !== "/painel/previa";
  } catch {
    return false;
  }
}
