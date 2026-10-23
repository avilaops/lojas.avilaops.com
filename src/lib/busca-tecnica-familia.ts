import type { ChaveDeMedida } from "./catalogo";

export type AtributoBuscaTecnica = "perfil" | "material" | "dureza" | "vedacao";
export type FamiliaBuscaTecnica = "retentor" | "oring" | "rolamento" | "correia" | "vedacao-hidraulica";

export type ConfiguracaoBuscaTecnica = {
  familia: FamiliaBuscaTecnica;
  medidas: ChaveDeMedida[];
  atributos: AtributoBuscaTecnica[];
  codigo: true;
};

const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function configuracaoBuscaTecnica(categoria: string): ConfiguracaoBuscaTecnica | null {
  const nome = normalizar(categoria);
  if (/o[ -]?ring|anel.*oring/.test(nome)) {
    return { familia: "oring", medidas: ["diametroInternoMm", "secaoMm"], atributos: ["material", "dureza"], codigo: true };
  }
  if (/rolamento/.test(nome)) {
    return { familia: "rolamento", medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"], atributos: ["vedacao"], codigo: true };
  }
  if (/correia/.test(nome)) {
    return { familia: "correia", medidas: ["comprimentoMm"], atributos: ["perfil"], codigo: true };
  }
  if (/vedac.*hidraul|hidraul.*vedac|gaxeta|raspador/.test(nome)) {
    return { familia: "vedacao-hidraulica", medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"], atributos: ["perfil", "material"], codigo: true };
  }
  if (/retentor/.test(nome)) {
    return { familia: "retentor", medidas: ["diametroInternoMm", "diametroExternoMm", "alturaMm"], atributos: ["perfil", "material"], codigo: true };
  }
  return null;
}

export function facetasTecnicasCadastradas(atributos: Array<Record<string, unknown> | null>) {
  const valores = (campo: "material" | "dureza" | "vedacao") => [...new Set(atributos
    .map((item) => item?.[campo])
    .filter((valor): valor is string => typeof valor === "string" && Boolean(valor.trim()))
    .map((valor) => valor.trim()))]
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  return { material: valores("material"), dureza: valores("dureza"), vedacao: valores("vedacao") };
}
