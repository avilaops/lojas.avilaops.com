import type { Metadata } from "next";
import Pixels from "@/components/Pixels";
import Consentimento from "@/components/Consentimento";
import { pixelsDo, temRastreio } from "@/lib/pixels";
import { headers } from "next/headers";
import "./globals.css";
import "@avilaops/checkout/tokens.css";
import "@avilaops/checkout/checkout.css";
import { tenantAtual, tenantPublico, temaDo, urlDaLoja, enderecoDo, identidadeDa } from "@/lib/tenant";
import { listarCategorias } from "@/lib/catalogo";
import { cssDoTema, fonteGoogleHref } from "@/lib/tema";
import { CartProvider } from "@/components/cart/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppFlutuante from "@/components/WhatsAppFlutuante";
import LojaNaoEncontrada from "@/components/LojaNaoEncontrada";
import AvisoSuspensa from "@/components/AvisoSuspensa";
import BarraGaragem from "@/components/BarraGaragem";

/**
 * Ícone e manifesto da loja, quando ela tem os seus.
 *
 * A plataforma é multi-loja: um `<link rel="icon">` fixo no `<head>` colocaria
 * o ícone de um cliente na aba de todos os outros. Por isso o ícone é declarado
 * aqui, junto do resto dos metadados, onde já sabemos de que loja é a página.
 *
 * Enquanto o lojista não sobe a marca dele, o `icons` fica ausente e o navegador
 * usa o padrão, que é melhor que exibir a marca de outra empresa.
 */
const ICONES_POR_LOJA: Record<string, { pasta: string; nomeCurto: string }> = {
  // Gerado no RealFaviconGenerator a partir da marca da FX (Fênix Eletrodos).
  fxeletrodos: { pasta: "/Fxeletrodos/favicon", nomeCurto: "Fenix" },
};

function iconesDa(slug: string): Pick<Metadata, "icons" | "manifest" | "appleWebApp"> {
  const c = ICONES_POR_LOJA[slug];
  if (!c) return {};
  return {
    icons: {
      icon: [
        { url: `${c.pasta}/favicon-96x96.png`, type: "image/png", sizes: "96x96" },
        { url: `${c.pasta}/favicon.svg`, type: "image/svg+xml" },
        { url: `${c.pasta}/favicon.ico`, rel: "shortcut icon" },
      ],
      apple: [{ url: `${c.pasta}/apple-touch-icon.png`, sizes: "180x180" }],
    },
    manifest: `${c.pasta}/site.webmanifest`,
    // Vira `<meta name="apple-mobile-web-app-title">`: é o nome que aparece
    // embaixo do ícone quando alguém salva a loja na tela de início do iPhone.
    appleWebApp: { title: c.nomeCurto },
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
    ...iconesDa(t.slug),
    title: { default: t.slogan ? `${t.nome} | ${t.slogan}` : t.nome, template: `%s · ${t.nome}` },
    description: t.slogan ?? `Loja virtual ${t.nome}`,
    robots: t.status === "ATIVA" ? undefined : { index: false, follow: false },
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
  const identidade = identidadeDa(t);
  const fonte = fonteGoogleHref(tema);
  const categorias = await listarCategorias(t.id);
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

  return (
    <html lang="pt-BR" data-ck-theme={tema.modo === "escuro" ? "dark" : "light"}>
      <head>
        {fonte && <link rel="stylesheet" href={fonte} />}
        <style dangerouslySetInnerHTML={{ __html: `${cssDoTema(tema)}:root{--brand-support:${identidade.corApoio}}` }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Pixels p={pixels} />
        <CartProvider slug={t.slug}>
          {t.status === "SUSPENSA" && <AvisoSuspensa />}
          {t.avisoTopo && (
            <p className="barra-aviso" role="status">{t.avisoTopo}</p>
          )}
          <Header loja={publico} logoUrl={t.logoUrl} categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} />
          {t.segmento === "motopecas" && <BarraGaragem tenantId={t.id} />}
          <main className="flex-1">{children}</main>
          <Footer tenant={t} categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} />
          {t.whatsapp && <WhatsAppFlutuante numero={t.whatsapp} nome={t.nome} />}
          <Consentimento ativo={temRastreio(pixels)} />
        </CartProvider>
      </body>
    </html>
  );
}
