import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PainelLoja, { type SecaoPainel } from "@/components/painel/PainelLoja";
import Dominio from "@/components/painel/Dominio";
import Canais from "@/components/painel/Canais";
import Descoberta from "@/components/painel/Descoberta";
import { estadoDescoberta } from "@/lib/descoberta";
import { headers } from "next/headers";
import Equipe from "@/components/painel/Equipe";
import { prisma } from "@/lib/db";
import { lojistaAtual, sessaoDoPainel } from "@/lib/sessao";
import { listarOperadores, permite } from "@/lib/operadores";
import { dadosDoPainel } from "@/lib/painel-dados";

/** Endereço legível para o lojista, seção interna para o componente. */
const SECAO: Record<string, SecaoPainel> = {
  marca: "Marca",
  entrega: "Entrega",
  recebimento: "Recebimento",
  assinatura: "Assinatura",
  conta: "Conta",
};

export const metadata: Metadata = { title: "Configurações | Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Pagina({ params, searchParams }: {
  params: Promise<{ secao: string }>;
  searchParams: Promise<{ ml?: string }>;
}) {
  const { secao } = await params;

  // Equipe também não é seção do PainelLoja: ela lê a própria tabela e não
  // precisa do catálogo nem dos pedidos.
  if (secao === "equipe") {
    const s = await sessaoDoPainel();
    if (!s) notFound();
    // Só o dono vê e mexe. Gerente criando gerente seria quem tem acesso hoje
    // garantindo acesso para sempre, mesmo depois de desligado.
    if (!permite(s.papel, "equipe")) {
      return (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Só o dono da loja gerencia quem entra no painel.
        </p>
      );
    }
    const operadores = await listarOperadores(s.tenant.id);
    return (
      <Equipe
        dono={s.tenant.loginEmail}
        operadores={operadores.map((o) => ({
          id: o.id,
          nome: o.nome,
          email: o.email,
          papel: o.papel,
          ativo: o.ativo,
          ultimoAcessoEm: o.ultimoAcessoEm?.toISOString() ?? null,
        }))}
      />
    );
  }

  // Canais não é seção do PainelLoja: é a tela para onde o /ml/callback volta,
  // e ela precisa do estado da conexão, não do catálogo nem dos pedidos.
  if (secao === "canais") {
    const [loja, sp] = await Promise.all([lojistaAtual(), searchParams]);
    if (!loja) notFound();
    const porEstado = await prisma.anuncioMercadoLivre.groupBy({
      by: ["estado"],
      where: { tenantId: loja.id },
      _count: { _all: true },
    });
    const conta = (e: string) => porEstado.find((p) => p.estado === e)?._count._all ?? 0;
    return (
      <div className="grid gap-6">
        <Canais
          loja={{ slug: loja.slug, nome: loja.nome }}
          retorno={sp.ml}
          ml={{
            conectado: Boolean(loja.mlAccessTokenEnc && loja.mlRefreshTokenEnc),
            nickname: loja.mlNickname,
            userId: loja.mlUserId,
            conectadoEm: loja.mlConectadoEm?.toISOString() ?? null,
            expiraEm: loja.mlExpiraEm?.toISOString() ?? null,
            anuncios: {
              publicado: conta("publicado"),
              rascunho: conta("rascunho"),
              recusado: conta("recusado"),
              pausado: conta("pausado"),
            },
          }}
        />
      </div>
    );
  }

  // Descoberta: leitura do que a plataforma já garante (robots, sitemap,
  // llms.txt, domínio canônico) e a única decisão do lojista, a de treinamento.
  if (secao === "descoberta") {
    const loja = await lojistaAtual();
    if (!loja) notFound();
    const h = await headers();
    return <div className="grid gap-6"><Descoberta estado={estadoDescoberta(loja, h.get("x-forwarded-host") ?? h.get("host"))} /></div>;
  }

  // Domínio não é uma seção do PainelLoja: é tela própria, com verificação de
  // DNS, e não precisa do catálogo nem dos pedidos para desenhar.
  if (secao === "dominio") {
    const { loja } = await dadosDoPainel();
    return <div className="grid gap-6"><Dominio loja={{ slug: loja.slug, url: loja.url, dominioPrincipal: loja.dominioPrincipal, plano: loja.plano }} /></div>;
  }

  const alvo = SECAO[secao];
  if (!alvo) notFound();
  return <PainelLoja secao={alvo} {...(await dadosDoPainel())} />;
}
