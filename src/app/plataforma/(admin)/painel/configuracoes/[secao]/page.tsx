import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import PainelLoja, { type SecaoPainel } from "@/components/painel/PainelLoja";
import Dominio from "@/components/painel/Dominio";
import Canais from "@/components/painel/Canais";
import MelhorEnvio from "@/components/painel/MelhorEnvio";
import { aplicativoConfigurado as melhorEnvioDisponivel, conectado as melhorEnvioConectado } from "@/lib/melhor-envio-conta";
import PerguntasMl from "@/components/painel/PerguntasMl";
import ReputacaoMl from "@/components/painel/ReputacaoMl";
import { perguntasPendentes } from "@/lib/mercadolivre-perguntas";
import { pendenciasDoCatalogo } from "@/lib/mercadolivre-preparo";
import { lerRegrasDoCanal } from "@/lib/canais";
import { Secao } from "@/components/painel/campos";
import Descoberta from "@/components/painel/Descoberta";
import Automacoes from "@/components/painel/Automacoes";
import { estadoDescoberta } from "@/lib/descoberta";
import { headers } from "next/headers";
import Equipe from "@/components/painel/Equipe";
import Politicas from "@/components/painel/Politicas";
import CamposPersonalizados from "@/components/painel/CamposPersonalizados";
import { lerDefinicoes } from "@/lib/campos-personalizados";
import { TIPOS_POLITICA, lerRegrasDevolucao, modeloDePolitica, politicaPublicada } from "@/lib/politicas";
import { prisma } from "@/lib/db";
import { lojistaAtual, sessaoDoPainel } from "@/lib/sessao";
import { listarOperadores, permite } from "@/lib/operadores";
import { dadosDoPainel } from "@/lib/painel-dados";
import { urlDaLoja } from "@/lib/tenant";

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
  searchParams: Promise<{ ml?: string; me?: string }>;
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
    const [porEstado, candidatos, perguntas, reputacao, pendencias] = await Promise.all([
      prisma.anuncioMercadoLivre.groupBy({
        by: ["estado"],
        where: { tenantId: loja.id },
        _count: { _all: true },
      }),
      prisma.anuncioMercadoLivre.findMany({
        where: {
          tenantId: loja.id,
          preparoEstado: "PRONTO",
          mlbId: null,
          estado: { in: ["rascunho", "recusado"] },
        },
        select: {
          produtoId: true,
          produto: { select: { nome: true, precoCentavos: true, estoque: true, imagens: true } },
        },
        orderBy: { preparadoEm: "desc" },
        take: 50,
      }),
      perguntasPendentes(loja.id),
      prisma.reputacaoMercadoLivre.findUnique({ where: { tenantId: loja.id } }),
      pendenciasDoCatalogo(loja.id),
    ]);
    const conta = (e: string) => porEstado.find((p) => p.estado === e)?._count._all ?? 0;
    return (
      <div className="grid gap-6">
        <Canais
          loja={{ slug: loja.slug, nome: loja.nome }}
          candidatos={candidatos.map(({ produtoId, produto }) => ({
            produtoId,
            nome: produto.nome,
            preco: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(produto.precoCentavos / 100),
            precoCentavos: produto.precoCentavos,
            estoque: produto.estoque ?? 0,
            imagem: produto.imagens[0] ?? null,
          }))}
          regras={lerRegrasDoCanal(loja.canais, "mercadolivre")}
          pendencias={pendencias}
          // O aplicativo do ML é da plataforma, não da loja: sem ele o botão de
          // conectar levaria a uma tela de erro do próprio Mercado Livre.
          integracaoDisponivel={Boolean(process.env.ML_APP_ID && process.env.ML_APP_SECRET)}
          retorno={sp.ml}
          ml={{
            conectado: Boolean(loja.mlAccessTokenEnc && loja.mlRefreshTokenEnc),
            nickname: loja.mlNickname,
            userId: loja.mlUserId,
            conectadoEm: loja.mlConectadoEm?.toISOString() ?? null,
            expiraEm: loja.mlExpiraEm?.toISOString() ?? null,
            anuncios: {
              aprovado: conta("aprovado"),
              publicado: conta("publicado"),
              rascunho: conta("rascunho"),
              recusado: conta("recusado"),
              pausado: conta("pausado"),
            },
          }}
        />
        {reputacao && (
          <Secao
            titulo="Saúde da conta no Mercado Livre"
            descricao="É o Mercado Livre quem calcula. O que a loja faz é mostrar o número junto do que muda ele."
          >
            <ReputacaoMl
              r={{
                nivel: reputacao.nivel,
                selo: reputacao.selo,
                transacoes: reputacao.transacoes,
                concluidas: reputacao.concluidas,
                canceladas: reputacao.canceladas,
                reclamacoes: reputacao.reclamacoes,
                atrasos: reputacao.atrasos,
                cancelamentos: reputacao.cancelamentos,
                positivas: reputacao.positivas,
                alertas: Array.isArray(reputacao.alertas) ? (reputacao.alertas as string[]) : [],
                medidoEm: reputacao.medidoEm.toISOString(),
              }}
            />
          </Secao>
        )}
        {perguntas.length > 0 && (
          <Secao
            titulo={`Perguntas do Mercado Livre (${perguntas.length})`}
            descricao="Quem pergunta está decidindo agora. Responder rápido é o que converte no canal — e a resposta vai direto para o anúncio."
          >
            <PerguntasMl
              perguntas={perguntas.map((p) => ({
                id: p.id,
                texto: p.texto,
                autor: p.autor,
                mlbId: p.mlbId,
                perguntadaEm: p.perguntadaEm.toISOString(),
                motivoErro: p.motivoErro,
                produtoNome: p.produto?.nome ?? null,
              }))}
            />
          </Secao>
        )}
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

  // Automações: o outbox da loja, lido pela API paginada (useSearchParams →
  // Suspense). Não passa pelo PainelLoja: não precisa de catálogo nem pedidos.
  if (secao === "automacoes") {
    const s = await sessaoDoPainel();
    if (!s) notFound();
    return (
      <Suspense fallback={null}>
        <div className="grid gap-6"><Automacoes /></div>
      </Suspense>
    );
  }

  // Políticas: o que o cliente lê no rodapé da loja. Também não passa pelo
  // PainelLoja — precisa das categorias (para marcar venda final), não do
  // catálogo inteiro nem dos pedidos.
  if (secao === "politicas") {
    const loja = await lojistaAtual();
    if (!loja) notFound();
    const categorias = await prisma.categoria.findMany({
      where: { tenantId: loja.id },
      select: { slug: true, nome: true },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
    return (
      <div className="grid gap-6">
        <Politicas
          politicas={TIPOS_POLITICA.map((tipo) => {
            const publicada = politicaPublicada(loja, tipo);
            return {
              tipo,
              publicado: publicada?.paragrafos.join("\n\n") ?? "",
              modelo: modeloDePolitica(loja, tipo).join("\n\n"),
              propria: publicada?.propria ?? false,
            };
          })}
          regras={lerRegrasDevolucao(loja.regrasDevolucao)}
          categorias={categorias}
        />
      </div>
    );
  }

  // Campos personalizados: a loja declara o que pergunta em cada produto.
  if (secao === "campos") {
    const loja = await lojistaAtual();
    if (!loja) notFound();
    return <CamposPersonalizados iniciais={lerDefinicoes(loja.camposPersonalizados)} />;
  }

  // Domínio não é uma seção do PainelLoja: é tela própria, com verificação de
  // DNS, e não precisa do catálogo nem dos pedidos para desenhar.
  if (secao === "dominio") {
    const loja = await lojistaAtual();
    if (!loja) notFound();
    return <div className="grid gap-6"><Dominio loja={{ slug: loja.slug, url: urlDaLoja(loja), dominioPrincipal: loja.dominioPrincipal, plano: loja.plano }} /></div>;
  }

  const alvo = SECAO[secao];
  if (!alvo) notFound();

  // Entrega leva o plugin do Melhor Envio em cima da tabela da loja: é para
  // esta tela que o /melhor-envio/callback volta, e a conexão é lida do
  // tenant, não do que o PainelLoja carrega.
  if (secao === "entrega") {
    const [loja, sp] = await Promise.all([lojistaAtual(), searchParams]);
    if (!loja) notFound();
    return (
      <div className="grid gap-6">
        <MelhorEnvio
          conexao={{
            conectado: melhorEnvioConectado(loja),
            conta: loja.melhorEnvioConta,
            conectadoEm: loja.melhorEnvioConectadoEm?.toISOString() ?? null,
          }}
          integracaoDisponivel={melhorEnvioDisponivel()}
          temCepOrigem={(loja.cepOrigem ?? "").replace(/\D/g, "").length === 8}
          retorno={sp.me}
        />
        <Suspense fallback={null}>
          <PainelLoja secao={alvo} {...(await dadosDoPainel(alvo))} />
        </Suspense>
      </div>
    );
  }

  // Marca lê `?bloco=` no cliente (useSearchParams): precisa de Suspense para
  // a rota não cair inteira em renderização no navegador.
  return (
    <Suspense fallback={null}>
      <PainelLoja secao={alvo} {...(await dadosDoPainel(alvo))} />
    </Suspense>
  );
}
