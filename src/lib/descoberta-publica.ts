import type { Tenant } from "@prisma/client";
import { criarCatalogoPublico } from "@avilaops/publicacao-texto/descoberta";
import { visivelNaBusca } from "./descoberta";
import { identidadeDa, noEnderecoOficial, normalizarHost, urlDaLoja } from "./tenant";
import { descricaoDaLoja } from "./textos-loja";

export type FormatoDescoberta = "ard" | "ai-catalog";
export type ContextoDescoberta = {
  host: string | null;
  tenant: Tenant | null;
  baseDomain?: string;
};

export function catalogoDaRequisicao({ host: hostBruto, tenant, baseDomain = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com" }: ContextoDescoberta) {
  const host = normalizarHost(hostBruto);
  const plataforma = normalizarHost(baseDomain);
  if (host === plataforma) {
    return criarCatalogoPublico({
      origem: `https://${plataforma}`,
      nome: "E-Commerce",
      descricao: "Comércio digital com identidade, operação e futuro.",
      paginas: [
        { url: "/", titulo: "E-Commerce", descricao: "Comércio digital com identidade, operação e futuro." },
        { url: "/ajuda", titulo: "Ajuda" },
        { url: "/developers", titulo: "Desenvolvedores" },
        { url: "/marca", titulo: "Marca" },
        { url: "/blog", titulo: "Blog" },
      ],
      recursos: [
        { url: "/llms.txt", nome: "Informações públicas da plataforma", tipo: "text/plain" },
        { url: "/llms-full.txt", nome: "Conteúdo completo da plataforma", tipo: "text/plain" },
        { url: "/sitemap.xml", nome: "Páginas publicadas da plataforma", tipo: "application/xml" },
      ],
    });
  }
  if (!tenant || !visivelNaBusca(tenant) || !noEnderecoOficial(tenant, host)) return null;
  const origem = urlDaLoja(tenant);
  // A resolução já pertence ao tenantAtual. Esta comparação também recusa
  // aliases noindex e uma combinação acidental de Host e tenant de outra loja.
  if (host !== new URL(origem).hostname) return null;
  const descricao = descricaoDaLoja(tenant, identidadeDa(tenant).diferencial);
  return criarCatalogoPublico({
    origem,
    nome: tenant.nome,
    descricao,
    paginas: [
      { url: "/", titulo: tenant.nome, descricao },
      { url: "/produtos", titulo: `Produtos • ${tenant.nome}` },
      { url: "/sobre", titulo: `Sobre • ${tenant.nome}` },
    ],
    recursos: [
      { url: "/llms.txt", nome: `Informações públicas • ${tenant.nome}`, tipo: "text/plain" },
      { url: "/llms-full.txt", nome: `Catálogo público em texto • ${tenant.nome}`, tipo: "text/plain" },
      { url: "/sitemap.xml", nome: `Páginas publicadas • ${tenant.nome}`, tipo: "application/xml" },
    ],
  });
}

export function respostaDescobertaPublica(contexto: ContextoDescoberta, formato: FormatoDescoberta): Response {
  const catalogo = catalogoDaRequisicao(contexto);
  const headers = {
    "cache-control": "private, no-store, max-age=0, must-revalidate",
    vary: "Host, X-Forwarded-Host",
    "x-content-type-options": "nosniff",
  };
  if (!catalogo) return new Response("Não encontrado.\n", { status: 404, headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
  return new Response(formato === "ard" ? catalogo.jsonArd : catalogo.jsonAiCatalogo, {
    headers: { ...headers, "content-type": "application/json; charset=utf-8" },
  });
}
