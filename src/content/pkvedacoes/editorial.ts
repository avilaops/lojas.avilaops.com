import type { ComponentType } from "react";
import type { TipoEditorialPk } from "@/lib/pk-editorial";
type ModuloEditorial = { default: ComponentType };
const corpos: Record<string, () => Promise<ModuloEditorial>> = {
  "guias/medir-vedacoes": () => import("./guias/medir-vedacoes.mdx"),
  "guias/perfis-b-bs-std": () => import("./guias/perfis-b-bs-std.mdx"),
  "guias/pu-nylon-funcoes": () => import("./guias/pu-nylon-funcoes.mdx"),
  "guias/prevenir-vazamento-contaminacao": () => import("./guias/prevenir-vazamento-contaminacao.mdx"),
  "guias/preparar-cotacao": () => import("./guias/preparar-cotacao.mdx"),
  "guias/selecionar-perfil-aplicacao": () => import("./guias/selecionar-perfil-aplicacao.mdx"),
  "aplicacoes/industria-hidraulica": () => import("./aplicacoes/industria-hidraulica.mdx"),
  "aplicacoes/agricultura": () => import("./aplicacoes/agricultura.mdx"),
  "aplicacoes/construcao": () => import("./aplicacoes/construcao.mdx"),
  "aplicacoes/mineracao": () => import("./aplicacoes/mineracao.mdx"),
  "aplicacoes/transporte-implementos": () => import("./aplicacoes/transporte-implementos.mdx"),
  "aplicacoes/logistica-movimentacao": () => import("./aplicacoes/logistica-movimentacao.mdx"),
  "aplicacoes/energia": () => import("./aplicacoes/energia.mdx"),
  "aplicacoes/florestal": () => import("./aplicacoes/florestal.mdx"),
  "aplicacoes/saneamento": () => import("./aplicacoes/saneamento.mdx"),
  "aplicacoes/embalagens-processos": () => import("./aplicacoes/embalagens-processos.mdx"),
};
export async function carregarEditorialPk(tipo: TipoEditorialPk, slug: string) {
  const carregar = corpos[`${tipo}/${slug}`];
  return carregar ? (await carregar()).default : null;
}

