import type { MetadataRoute } from "next";
import type { Tenant } from "@prisma/client";
import { noEnderecoOficial, urlDaLoja } from "./tenant";

/**
 * Como a loja se apresenta a quem chega por máquina: robots.txt, llms.txt e
 * o estado que o painel mostra ao lojista.
 *
 * A separação que importa, e que a documentação de cada fornecedor confirma
 * (conferida em 10/09/2026):
 *
 *   busca        Googlebot, Bingbot, OAI-SearchBot (ChatGPT search).
 *                O Google diz, com todas as letras, que não existe arquivo,
 *                marcação nem opt-in para AI Overviews ou AI Mode: página
 *                indexada e com snippet é o único requisito. A OpenAI diz que
 *                aparecer no ChatGPT search exige o OAI-SearchBot liberado,
 *                no robots E na infraestrutura (CDN/WAF), e leva ~24 h.
 *   treinamento  GPTBot (OpenAI), Google-Extended (Gemini), ClaudeBot,
 *                CCBot. Não afetam aparecer na busca de ninguém: o próprio
 *                Google escreve que Google-Extended "não afeta inclusão nem
 *                ranking na Pesquisa".
 *   usuário      ChatGPT-User: ação de uma pessoa dentro do ChatGPT; a OpenAI
 *                avisa que o robots pode não se aplicar. Não é crawler.
 *
 * Regra da plataforma: loja pública é encontrável por busca. Treinamento é
 * outra decisão, desligada por padrão e ligada pelo lojista, nunca "para
 * melhorar o SEO", porque não melhora.
 */

export const CRAWLERS_DE_BUSCA = ["Googlebot", "Googlebot-Image", "Bingbot", "OAI-SearchBot"] as const;
export const CRAWLERS_DE_TREINAMENTO = ["GPTBot", "Google-Extended", "ClaudeBot", "CCBot"] as const;

/** O que nenhuma máquina tem por que indexar numa loja: é de quem está comprando. */
export const CAMINHOS_PRIVADOS_DA_LOJA = ["/carrinho", "/checkout", "/pedido/", "/conta", "/api/"];

/**
 * A loja continua existindo para os buscadores?
 *
 * Suspensa é loja com a cobrança atrasada: perde o checkout, não a presença.
 * Bloquear o robots nesse estado apagava a indexação inteira, e a volta leva
 * semanas: a Vedashow ficou com 1.681 páginas "bloqueadas pelo robots.txt" no
 * Search Console depois de uma suspensão em setembro de 2026. Só loja em
 * provisionamento ou cancelada some da busca.
 */
export function visivelNaBusca(t: Pick<Tenant, "status">): boolean {
  return t.status === "ATIVA" || t.status === "SUSPENSA";
}

export function regrasRobots(t: Tenant): MetadataRoute.Robots {
  if (!visivelNaBusca(t)) return { rules: { userAgent: "*", disallow: "/" } };

  const rules: MetadataRoute.Robots["rules"] = [
    { userAgent: "*", allow: "/", disallow: CAMINHOS_PRIVADOS_DA_LOJA },
  ];
  // Grupo explícito para o treinamento, e não "confia no *": o dia em que
  // alguém apertar o `*` para conter um scraper, a busca continua liberada e
  // a decisão sobre treinamento continua sendo a da loja, não um acidente.
  if (!t.permiteTreinamentoIa) {
    rules.push({ userAgent: [...CRAWLERS_DE_TREINAMENTO], disallow: "/" });
  }
  return { rules, sitemap: `${urlDaLoja(t)}/sitemap.xml` };
}

export type EstadoDescoberta = {
  /** Endereço que o Google deve considerar o oficial. */
  dominioCanonico: string;
  /** Este host é o oficial? Fora dele a loja é cópia, com noindex. */
  noEnderecoOficial: boolean;
  indexavel: boolean;
  sitemap: string;
  llms: string;
  busca: { google: boolean; bing: boolean; chatgpt: boolean };
  treinamentoIa: boolean;
};

/** O que o painel mostra e o que o teste de publicação confere. */
export function estadoDescoberta(t: Tenant, host: string | null): EstadoDescoberta {
  const base = urlDaLoja(t);
  const ativa = visivelNaBusca(t);
  return {
    dominioCanonico: base.replace(/^https?:\/\//, ""),
    noEnderecoOficial: noEnderecoOficial(t, host),
    indexavel: ativa,
    sitemap: `${base}/sitemap.xml`,
    llms: `${base}/llms.txt`,
    busca: { google: ativa, bing: ativa, chatgpt: ativa },
    treinamentoIa: t.permiteTreinamentoIa,
  };
}
