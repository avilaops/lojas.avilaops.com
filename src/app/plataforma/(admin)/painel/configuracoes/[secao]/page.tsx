import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PainelLoja, { type SecaoPainel } from "@/components/painel/PainelLoja";
import Dominio from "@/components/painel/Dominio";
import Canais from "@/components/painel/Canais";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
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
