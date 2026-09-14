import type { Metadata } from "next";
import Pixels from "@/components/Pixels";
import Consentimento from "@/components/Consentimento";
import { pixelsDo, temRastreio } from "@/lib/pixels";
import { headers } from "next/headers";
import "./globals.css";
import "@avilaops/checkout/tokens.css";
import "@avilaops/checkout/checkout.css";
import { noEnderecoOficial, tenantAtual, tenantPublico, temaDo, urlDaLoja, enderecoDo, identidadeDa } from "@/lib/tenant";
import { listarCategorias } from "@/lib/catalogo";
import { cssDoTema, fonteGoogleHref } from "@/lib/tema";
import { CartProvider } from "@/components/cart/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CabecalhoPremium from "@/components/templates/automotivo-premium/Cabecalho";
import CarrinhoLateral from "@/components/templates/automotivo-premium/CarrinhoLateral";
import "@/components/templates/automotivo-premium/premium.css";
import WhatsAppFlutuante from "@/components/WhatsAppFlutuante";
import LojaNaoEncontrada from "@/components/LojaNaoEncontrada";
import AvisoSuspensa from "@/components/AvisoSuspensa";
import BarraGaragem from "@/components/BarraGaragem";
import { prisma } from "@/lib/db";

/**
 * Ícone e manifesto da loja, quando ela tem os seus.
 *
 * A plataforma é multi-loja: um `<link rel="icon">` fixo no `<head>` colocaria
 * o ícone de um cliente na aba de todos os outros. Por isso o ícone é declarado
 * aqui, junto do resto dos metadados, onde já sabemos de que loja é a página.
 *
 * A pasta vem de `Tenant.faviconUrl`, não de uma lista no código: loja é dado.
 * Dentro dela os nomes são sempre os mesmos, que são os que o
 * RealFaviconGenerator entrega — assim subir a marca de um cliente novo é
 * copiar sete arquivos e preencher um campo, sem passar por deploy.
 *
 * Sem `faviconUrl`, o `icons` fica ausente e vale o `src/app/icon.tsx`, que
 * desenha a inicial do nome sobre a cor primária da loja.
 */
function iconesDa(pasta: string | null, nome: string): Pick<Metadata, "icons" | "manifest" | "appleWebApp"> {
  if (!pasta) return {};
  const base = pasta.replace(/\/+$/, "");
  return {
    icons: {
      icon: [
        { url: `${base}/favicon-96x96.png`, type: "image/png", sizes: "96x96" },
        { url: `${base}/favicon.svg`, type: "image/svg+xml" },
        { url: `${base}/favicon.ico`, rel: "shortcut icon" },
      ],
      apple: [{ url: `${base}/apple-touch-icon.png`, sizes: "180x180" }],
    },
    manifest: `${base}/site.webmanifest`,
    // Vira `<meta name="apple-mobile-web-app-title">`: é o nome que aparece
    // embaixo do ícone quando alguém salva a loja na tela de início do iPhone.
    appleWebApp: { title: nome },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  if (h.get("x-plataforma") === "1") {
    return {
      metadataBase: new URL("https://lojas.avilaops.com"),
      title: { default: "Lojas Avila Ops", template: "%s · Lojas Avila Ops" },
      description: "Comércio digital com identidade, operação e futuro.",
      applicationName: "Lojas Avila Ops",
      manifest: "/site.webmanifest",
      icons: { icon: "/lojas-mark.svg", apple: "/lojas-mark.svg" },
      robots: { index: true, follow: true },
    };
  }
  const t = await tenantAtual();
  if (!t) return { title: "Loja não encontrada", robots: { index: false } };
  return {
    metadataBase: new URL(urlDaLoja(t)),
    ...iconesDa(t.faviconUrl, t.nome),
    title: { default: t.slogan ? `${t.nome} | ${t.slogan}` : t.nome, template: `%s · ${t.nome}` },
    description: t.slogan ?? `Loja virtual ${t.nome}`,
    /**
     * Quem não pode ser indexado:
     *   - loja fora do ar (provisionando, suspensa, cancelada);
     *   - loja com domínio próprio sendo servida por OUTRO endereço, como o
     *     subdomínio da plataforma. Ali ela é cópia do domínio de verdade, e
     *     canonical é sugestão: sem `noindex` o subdomínio pode acabar
     *     indexado e competir com o endereço da marca pela mesma busca.
     *
     * `follow` fica ligado para o Google continuar seguindo os links e chegar
     * às páginas do domínio certo. E o robots.txt NÃO bloqueia estas URLs de
     * propósito: página bloqueada não é rastreada, e sem rastrear o Google não
     * lê o `noindex` que está nela.
     */
    robots:
      t.status !== "ATIVA"
        ? { index: false, follow: false }
        : noEnderecoOficial(t, h.get("x-forwarded-host") ?? h.get("host"))
          ? undefined
          : { index: false, follow: true },
    openGraph: { siteName: t.nome, locale: "pt_BR", type: "website" },
    // Verificação do Search Console / Bing Webmaster, quando o lojista colar o código.
    ...(t.verificacaoGoogle || t.verificacaoBing
      ? { verification: { ...(t.verificacaoGoogle ? { google: t.verificacaoGoogle } : {}), ...(t.verificacaoBing ? { other: { "msvalidate.01": t.verificacaoBing } } : {}) } }
      : {}),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Domínio-base (lojas.avilaops.com): é a plataforma, não uma loja. O proxy
  // marca a requisição e reescreve para src/app/plataforma, que tem o próprio chrome.
  const h = await headers();
  if (h.get("x-plataforma") === "1") {
    return (
      <html lang="pt-BR">
        <body>{children}</body>
      </html>
    );
  }

  const t = await tenantAtual();

  if (!t || t.status === "CANCELADA") {
    return (
      <html lang="pt-BR">
        <body>
          <LojaNaoEncontrada />
        </body>
      </html>
    );
  }

  const tema = temaDo(t);
  const premium = tema.layout === "automotivo-premium";
  const identidade = identidadeDa(t);
  const fonte = fonteGoogleHref(tema);
  const categorias = await listarCategorias(t.id);

  // Exemplo de busca: um produto de verdade da loja, não frase genérica.
  //
  // O nome vem cortado antes do primeiro travessão, porque o cadastro do
  // lojista costuma trazer descrição junto ("FAG 6205-2RS - Rolamento Radial
  // Esfera Fixo - Unitário"), e o placeholder tem que caber no campo.
  const exemplo = await prisma.produto.findFirst({
    where: { tenantId: t.id, ativo: true, imagens: { isEmpty: false } },
    orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }],
    select: { nome: true },
  });
  const exemploBusca = exemplo?.nome.split(" - ")[0].trim().slice(0, 32) ?? null;
  const publico = tenantPublico(t);
  const pixels = pixelsDo(t);
  const endereco = enderecoDo(t);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${urlDaLoja(t)}/#organization`,
    name: t.nome,
    url: urlDaLoja(t),
    ...(t.logoUrl ? { logo: t.logoUrl } : {}),
    ...(identidade.diferencial ? { description: identidade.diferencial } : {}),
    ...(t.telefone ? { telephone: t.telefone } : {}),
    ...(t.enderecoPublico && endereco.cidade
      ? { address: { "@type": "PostalAddress", streetAddress: [endereco.logradouro, endereco.numero].filter(Boolean).join(", "), addressLocality: endereco.cidade, addressRegion: endereco.uf, postalCode: endereco.cep, addressCountry: "BR" } }
      : {}),
  };

  // WebSite com SearchAction: é o que diz ao Google que /produtos?q= é a busca
  // da loja. Sem inventar nada: a URL é a que o formulário do cabeçalho usa.
  const jsonLdSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${urlDaLoja(t)}/#website`,
    url: urlDaLoja(t),
    name: t.nome,
    publisher: { "@id": `${urlDaLoja(t)}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${urlDaLoja(t)}/produtos?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="pt-BR" data-ck-theme={tema.modo === "escuro" ? "dark" : "light"} data-template={premium ? "automotivo-premium" : undefined} data-modo={tema.modo} suppressHydrationWarning={premium}>
      <head>
        {fonte && <link rel="stylesheet" href={fonte} />}
        <style dangerouslySetInnerHTML={{ __html: `${cssDoTema(tema)}:root{--brand-support:${identidade.corApoio}}` }} />
        {premium && <script dangerouslySetInnerHTML={{ __html: `try{var m=localStorage.getItem(${JSON.stringify(`loja:${t.slug}:modo`).replace(/</g,"\\u003c")});if(m==='claro'||m==='escuro'){document.documentElement.dataset.modo=m;document.documentElement.dataset.ckTheme=m==='escuro'?'dark':'light'}}catch(e){}` }}/ >}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSite) }} />
        {/* Descoberta do llms.txt pela especificação v2 (llmstxt.org, ago/2026):
            rel="describedby" aponta para o arquivo que descreve o site. É
            complemento; quem indexa continua sendo sitemap + páginas. */}
        <link rel="describedby" href="/llms.txt" />
      </head>
      <body className="flex min-h-screen flex-col">
        <Pixels p={pixels} />
        <CartProvider slug={t.slug} painelHabilitado={premium}>
          {t.status === "SUSPENSA" && <AvisoSuspensa />}
          {t.avisoTopo && !premium && (
            <p className="barra-aviso" role="status">{t.avisoTopo}</p>
          )}
          {premium ? <CabecalhoPremium loja={publico} logo={t.logoUrl} logoEscuro={tema.premium?.logoEscuroUrl} mostrarNome={tema.premium?.mostrarNome} categorias={[...categorias].sort((a,b)=>a.ordem-b.ordem).map(c=>({slug:c.slug,nome:c.nome}))} modo={tema.modo}/> : <Header loja={publico} logoUrl={t.logoUrl} categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} exemploBusca={exemploBusca} />}
          {t.segmento === "motopecas" && <BarraGaragem tenantId={t.id} />}
          <main id="conteudo-loja" className="flex-1">{children}</main>
          <Footer tenant={t} categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} />
          {premium && <CarrinhoLateral/>}
          {t.whatsapp && <WhatsAppFlutuante numero={t.whatsapp} nome={t.nome} />}
          <Consentimento ativo={temRastreio(pixels)} />
        </CartProvider>
      </body>
    </html>
  );
}
