import { createElement, type ComponentType, type ReactElement } from "react";
import type { TemaLoja } from "@/lib/tema";
import { contratoDo } from "@/lib/templates";
import type { DadosHome } from "./tipos";
import Automotivo from "./Automotivo";
import CatalogoTecnico from "./CatalogoTecnico";
import Classico from "./Classico";
import Conversao from "./Conversao";
import Distribuidora from "./Distribuidora";
import Editorial from "./Editorial";
import Farmacia from "./Farmacia";
import Industrial from "./Industrial";
import Mercado from "./Mercado";
import Minimal from "./Minimal";
import Spotlight from "./Spotlight";
import Vitrine from "./Vitrine";
import HomePremium from "@/components/templates/automotivo-premium/Home";

/**
 * Layout → composição da home.
 *
 * A loja publicada (`src/app/page.tsx`) e a prévia do painel perguntam aqui,
 * para as duas não divergirem: layout novo entra uma vez e aparece nas duas.
 * `Record` sobre o enum do tema faz o typecheck falhar se algum ficar de fora.
 */
const HOMES: Record<TemaLoja["layout"], ComponentType<DadosHome>> = {
  "automotivo-premium": HomePremium,
  spotlight: Spotlight,
  mercado: Mercado,
  "catalogo-tecnico": CatalogoTecnico,
  distribuidora: Distribuidora,
  industrial: Industrial,
  automotivo: Automotivo,
  farmacia: Farmacia,
  conversao: Conversao,
  vitrine: Vitrine,
  editorial: Editorial,
  minimal: Minimal,
  classico: Classico,
};

/** Template que é a loja inteira traz a própria home; os demais só compõem. */
function homeDo(tema: Pick<TemaLoja, "layout">): ComponentType<DadosHome> {
  return contratoDo(tema).escopo === "loja" ? HomePremium : HOMES[tema.layout] ?? Classico;
}

/** A home do layout escolhido, já com os dados. */
export function comporHome(tema: Pick<TemaLoja, "layout">, dados: DadosHome): ReactElement {
  return createElement(homeDo(tema), dados);
}
