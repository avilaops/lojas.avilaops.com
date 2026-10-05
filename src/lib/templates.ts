import type { TemaLoja } from "./tema";

/**
 * Contrato de template: quem é dono de cada bloco da loja, por layout.
 *
 * Antes disto, "qual template troca qual bloco" era `layout ===
 * "automotivo-premium"` repetido no layout raiz e em seis páginas; um segundo
 * template de loja inteira obrigaria a repetir cada `if`. Agora a página
 * pergunta ao contrato (`usaBlocoProprio`, `contratoDo`) e template novo é uma
 * entrada em `CONTRATOS`.
 *
 * A versão é do contrato, não de cada template: sobe quando o formato muda
 * (bloco novo, campo novo), e todo template acompanha no mesmo commit.
 */
export const VERSAO_CONTRATO = 1;

export const BLOCOS = ["cabecalho", "hero", "categorias", "produto", "carrinho", "rodape"] as const;
export type Bloco = (typeof BLOCOS)[number];

export type ContratoTemplate = {
  layout: TemaLoja["layout"];
  versao: number;
  /** `home`: só compõe a página inicial. `loja`: veste a loja inteira. */
  escopo: "home" | "loja";
  blocos: Record<Bloco, "compartilhado" | "proprio">;
  /** Custom properties que o CSS do template define sob `html[data-template]`. */
  tokens: string[];
  /** O `<html>` recebe `data-template="<layout>"`, que é onde os tokens se penduram. */
  atributoHtml: boolean;
};

/** Composição de home: o hero é dela, o resto é o da plataforma. */
function soHome(layout: TemaLoja["layout"]): ContratoTemplate {
  return {
    layout,
    versao: VERSAO_CONTRATO,
    escopo: "home",
    blocos: { cabecalho: "compartilhado", hero: "proprio", categorias: "compartilhado", produto: "compartilhado", carrinho: "compartilhado", rodape: "compartilhado" },
    tokens: [],
    atributoHtml: false,
  };
}

export const CONTRATOS: Record<TemaLoja["layout"], ContratoTemplate> = {
  "automotivo-premium": {
    layout: "automotivo-premium",
    versao: VERSAO_CONTRATO,
    escopo: "loja",
    // O rodapé é o `Footer` de todas as lojas; o premium só o reveste por CSS.
    blocos: { cabecalho: "proprio", hero: "proprio", categorias: "proprio", produto: "proprio", carrinho: "proprio", rodape: "compartilhado" },
    tokens: [
      "--ap-max", "--radius",
      "--background", "--foreground", "--card", "--card-foreground",
      "--muted", "--muted-foreground", "--border", "--input",
      "--ck-bg", "--ck-surface", "--ck-surface-muted", "--ck-fg", "--ck-fg-muted", "--ck-border",
    ],
    atributoHtml: true,
  },
  spotlight: soHome("spotlight"),
  mercado: soHome("mercado"),
  "catalogo-tecnico": soHome("catalogo-tecnico"),
  distribuidora: soHome("distribuidora"),
  farmacia: soHome("farmacia"),
  automotivo: soHome("automotivo"),
  conversao: soHome("conversao"),
  classico: soHome("classico"),
  vitrine: soHome("vitrine"),
  editorial: soHome("editorial"),
  minimal: soHome("minimal"),
};

export function contratoDo(tema: Pick<TemaLoja, "layout">): ContratoTemplate {
  return CONTRATOS[tema.layout];
}

export function usaBlocoProprio(tema: Pick<TemaLoja, "layout">, bloco: Bloco): boolean {
  return contratoDo(tema).blocos[bloco] === "proprio";
}
