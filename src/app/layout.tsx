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
    title: { default: t.slogan ? `${t.nome} — ${t.slogan}` : t.nome, template: `%s · ${t.nome}` },
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
          <main className="flex-1">{children}</main>
          <Footer tenant={t} categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))} />
          {t.whatsapp && <WhatsAppFlutuante numero={t.whatsapp} nome={t.nome} />}
          <Consentimento ativo={temRastreio(pixels)} />
        </CartProvider>
      </body>
    </html>
  );
}
