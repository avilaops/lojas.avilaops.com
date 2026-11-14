import type { MetadataRoute } from "next";
import type { Tenant } from "@prisma/client";
import { visivelNaBusca } from "./descoberta";

export type SinaisConteudo = { busca: boolean; entradaIa: boolean; treinamento: boolean };

export function sinaisConteudoLoja(t: Pick<Tenant, "status" | "permiteTreinamentoIa">): SinaisConteudo {
  const publica = visivelNaBusca(t);
  return { busca: publica, entradaIa: publica, treinamento: publica && t.permiteTreinamentoIa };
}

/** A diretiva adicional exige texto: o serializador de metadados Next a ignora. */
export function textoRobotsComSinais(robots: MetadataRoute.Robots, sinais: SinaisConteudo): string {
  const lista = (valor: string | string[] | undefined) => valor === undefined ? [] : Array.isArray(valor) ? valor : [valor];
  const simNao = (valor: boolean) => valor ? "yes" : "no";
  const sinal = `Content-Signal: search=${simNao(sinais.busca)}, ai-input=${simNao(sinais.entradaIa)}, ai-train=${simNao(sinais.treinamento)}`;
  const grupos = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
  const blocos = grupos.map(regra => [
    ...lista(regra.userAgent ?? "*").map(valor => `User-Agent: ${valor}`),
    sinal,
    ...lista(regra.allow).map(valor => `Allow: ${valor}`),
    ...lista(regra.disallow).map(valor => `Disallow: ${valor}`),
    ...(regra.crawlDelay === undefined ? [] : [`Crawl-delay: ${regra.crawlDelay}`]),
  ].join("\n"));
  const finais = [...lista(robots.sitemap).map(valor => `Sitemap: ${valor}`), ...(robots.host ? [`Host: ${robots.host}`] : [])];
  return [...blocos, ...(finais.length ? [finais.join("\n")] : [])].join("\n\n") + "\n";
}
