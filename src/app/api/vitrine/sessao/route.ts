import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { tenantAtual } from "@/lib/tenant";
import {
  COOKIE_SESSAO,
  COOKIE_VISITANTE,
  MINUTOS_DE_SESSAO,
  classificarDispositivo,
  classificarOrigem,
  novaChave,
} from "@/lib/atribuicao";

/**
 * POST /api/vitrine/sessao — a medição da vitrine.
 *
 * Uma chamada por página vista, do próprio navegador. É o que torna possível
 * responder "quantas visitas, de que canal, quantas viraram pedido" — nada
 * disso existe retroativamente a partir do histórico de pedidos.
 *
 * ## Privacidade
 *
 * First-party e sem terceiro: nada sai deste domínio, e nem IP nem user-agent
 * são guardados (o user-agent só é lido para dizer "celular" ou "computador", e
 * descartado). As duas chaves gravadas são valores sorteados, sem relação com
 * identidade.
 *
 * A **sessão** é medição de audiência do próprio site e vale para todo mundo.
 * O **visitante** — a chave que liga a visita de hoje à de ontem — só é gravado
 * com "aceito" no banner: ligar visitas entre dias é perfil de navegação, e a
 * loja declara que não guarda perfil sem consentimento. Sem ele, cada sessão é
 * um visitante próprio, e a atribuição por último clique enxerga só dentro da
 * sessão. O relatório continua honesto; fica menos preciso, que é o preço
 * correto a pagar.
 */

const SEGUNDOS_DE_SESSAO = MINUTOS_DE_SESSAO * 60;
const DIAS_DE_VISITANTE = 180;

/** Robô não é visita: contá-lo estragaria toda taxa de conversão do painel. */
const ROBO = /bot|crawler|spider|crawling|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|facebookexternalhit|slurp|bingpreview/i;

export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as
    | { caminho?: string; referrer?: string | null; busca?: string; consentimento?: string }
    | null;
  if (!corpo?.caminho) return novaResposta();

  const h = await headers();
  const userAgent = h.get("user-agent");
  if (userAgent && ROBO.test(userAgent)) return novaResposta();

  const t = await tenantAtual();
  // Loja fora do ar não acumula audiência: contaria a visita de quem viu o
  // aviso de suspensa como se fosse visita à vitrine.
  if (!t || t.status !== "ATIVA") return novaResposta();

  const jar = await cookies();
  const podeLigarVisitas = corpo.consentimento === "aceito";
  const caminho = corpo.caminho.slice(0, 300);
  const emProduto = caminho.startsWith("/produtos/");
  const emCheckout = caminho.startsWith("/checkout") || caminho.startsWith("/carrinho");

  const chaveAtual = jar.get(COOKIE_SESSAO)?.value;
  const limite = new Date(Date.now() - SEGUNDOS_DE_SESSAO * 1000);
  const existente = chaveAtual
    ? await prisma.sessaoVitrine.findFirst({ where: { chave: chaveAtual, tenantId: t.id, ultimoEm: { gte: limite } } })
    : null;

  if (existente) {
    await prisma.sessaoVitrine.update({
      where: { id: existente.id },
      data: {
        paginas: { increment: 1 },
        ultimoEm: new Date(),
        // `||` e não atribuição direta: quem viu um produto e voltou para a
        // home continua tendo visto um produto nesta sessão.
        ...(emProduto && !existente.viuProduto ? { viuProduto: true } : {}),
        ...(emCheckout && !existente.iniciouCheckout ? { iniciouCheckout: true } : {}),
      },
    });
    // Renova o cookie para a janela deslizar enquanto a pessoa navega.
    return novaResposta(chaveAtual, podeLigarVisitas ? jar.get(COOKIE_VISITANTE)?.value : undefined);
  }

  const hostDaLoja = (h.get("x-forwarded-host") ?? h.get("host") ?? "").replace(/:\d+$/, "");
  const origem = classificarOrigem({
    parametros: new URLSearchParams(corpo.busca ?? ""),
    referrer: corpo.referrer ?? null,
    hostDaLoja,
  });

  const chave = novaChave();
  // Sem consentimento, o visitante é a própria sessão: nada liga esta visita à
  // de ontem, nem no banco.
  const visitante = (podeLigarVisitas ? jar.get(COOKIE_VISITANTE)?.value : null) || chave;

  await prisma.sessaoVitrine.create({
    data: {
      tenantId: t.id,
      chave,
      visitante,
      canal: origem.canal,
      origem: origem.origem,
      midia: origem.midia,
      campanha: origem.campanha,
      termo: origem.termo,
      conteudo: origem.conteudo,
      referrer: origem.referrer,
      entrada: caminho,
      dispositivo: classificarDispositivo(userAgent),
      viuProduto: emProduto,
      iniciouCheckout: emCheckout,
    },
  });

  return novaResposta(chave, podeLigarVisitas ? visitante : undefined);
}

/**
 * Sempre 204: a medição nunca fala com a tela.
 *
 * Erro de medição não pode virar erro visível na loja de um cliente, e um
 * corpo de resposta só daria ao navegador algo para processar à toa.
 */
function novaResposta(chaveSessao?: string, visitante?: string): Response {
  const cabecalhos = new Headers();
  const comum = "Path=/; SameSite=Lax; HttpOnly; Secure";
  if (chaveSessao) cabecalhos.append("set-cookie", `${COOKIE_SESSAO}=${chaveSessao}; Max-Age=${SEGUNDOS_DE_SESSAO}; ${comum}`);
  if (visitante) cabecalhos.append("set-cookie", `${COOKIE_VISITANTE}=${visitante}; Max-Age=${DIAS_DE_VISITANTE * 86_400}; ${comum}`);
  return new Response(null, { status: 204, headers: cabecalhos });
}
