import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import { identidadeDa, lojaVende, tenantPublico } from "@/lib/tenant";
import { LAYOUTS, cssDoTema, fonteGoogleHref } from "@/lib/tema";
import { contratoDo, usaBlocoProprio } from "@/lib/templates";
import { catalogoDeDemonstracao, lerRascunho, lojaDaPrevia } from "@/lib/previa-tema";
import { comporHome } from "@/components/home/composicao";
import { CartProvider } from "@/components/cart/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CabecalhoPremium from "@/components/templates/automotivo-premium/Cabecalho";

/**
 * Prévia do tema: a home como ficaria com o rascunho que o lojista ainda não
 * salvou, sobre um catálogo de demonstração.
 *
 * Mora no painel (domínio-base) e não na loja porque a loja recusa `<iframe>`
 * de outro endereço, e fica em grupo próprio, fora de `(admin)`, porque o
 * `:root` do tema repintaria o chrome do painel.
 *
 * Esta página só lê: a sessão, para saber de quem é a marca, e o `?t=` da URL.
 * Nada aqui grava, mede ou avisa ninguém; por isso também não entram pixels,
 * medição de sessão, banner de cookies, dado estruturado nem botão de conversa.
 */
export const metadata: Metadata = {
  title: "Prévia do tema",
  robots: { index: false, follow: false },
};

export default async function PreviaDoTema({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");

  const { t } = await searchParams;
  const tema = lerRascunho(typeof t === "string" ? t : undefined);

  if (!tema) {
    return (
      <main className="mx-auto grid min-h-screen max-w-md content-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Não foi possível montar a prévia</h1>
        <p className="text-sm">O endereço não trouxe um tema válido. Volte ao painel, confira os campos e abra a prévia de novo.</p>
        <p><Link className="underline" href="/painel/configuracoes/marca">Voltar para Marca</Link></p>
      </main>
    );
  }

  const previa = lojaDaPrevia(loja, tema);
  const contrato = contratoDo(tema);
  const identidade = identidadeDa(previa);
  const publico = tenantPublico(previa);
  const fonte = fonteGoogleHref(tema);
  const { categorias, vitrine } = catalogoDeDemonstracao();
  const menu = categorias.map((c) => ({ slug: c.slug, nome: c.nome }));
  const rotulo = LAYOUTS.find((l) => l.valor === tema.layout)?.rotulo ?? tema.layout;

  // Os seletores do template olham para o <html>, que é do layout raiz. Aqui
  // os atributos chegam por script em linha, a mesma técnica que a loja usa
  // para o modo. Os valores já passaram pelo schema (enums), e ainda assim
  // saem por JSON.stringify com `<` escapado.
  const atributos = JSON.stringify({
    template: contrato.atributoHtml ? contrato.layout : null,
    modo: tema.modo,
    ckTheme: tema.modo === "escuro" ? "dark" : "light",
  }).replace(/</g, "\\u003c");

  return (
    <>
      {fonte && <link rel="stylesheet" href={fonte} />}
      <style dangerouslySetInnerHTML={{ __html: `${cssDoTema(tema)}:root{--brand-support:${identidade.corApoio}}` }} />
      <script dangerouslySetInnerHTML={{ __html: `(function(){var a=${atributos},d=document.documentElement.dataset;if(a.template)d.template=a.template;d.modo=a.modo;d.ckTheme=a.ckTheme})()` }} />
      <p role="status" className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center text-sm" style={{ background: "#111827", color: "#ffffff" }}>
        <strong>Prévia com produtos de demonstração. Nada foi salvo.</strong>
        <span>Layout: {rotulo}</span>
        <Link className="underline" href="/painel/configuracoes/marca">Voltar para Marca</Link>
      </p>
      {/* `inert`: os links da home apontam para páginas da loja, que não
          existem no domínio do painel. A prévia é para olhar, não para navegar. */}
      <div inert data-layout={tema.layout} className="flex min-h-screen flex-col pb-14">
        <CartProvider slug={`previa-${loja.slug}`}>
          {usaBlocoProprio(tema, "cabecalho")
            ? <CabecalhoPremium loja={publico} logo={previa.logoUrl} logoEscuro={tema.premium?.logoEscuroUrl} mostrarNome={tema.premium?.mostrarNome} categorias={menu} modo={tema.modo} />
            : <Header loja={publico} logoUrl={previa.logoUrl} mostrarNome={tema.mostrarNomeNoCabecalho} categorias={menu} mostrarPromocoes={(tema.campanhasHome?.length ?? 0) > 0} />}
          <main className="flex-1">
            {comporHome(tema, { t: previa, identidade, categorias, vitrine, temDestaques: vitrine.some((p) => p.destaque), vende: lojaVende(previa) })}
          </main>
          <Footer tenant={previa} categorias={menu} />
        </CartProvider>
      </div>
    </>
  );
}
