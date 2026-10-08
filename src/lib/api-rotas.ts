import { randomUUID } from "node:crypto";
import type { ChaveApi, Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { chaveDaRequisicao, hashDaChave, lojaNoAr, planoPermite, tipoPeloFormato, type Escopo } from "@/lib/api-chaves";
import { LimitadorPorJanela, cabecalhosDoLimite } from "@/lib/api-limite";
import { ErroApi, corpoDeErro } from "@/lib/api-resposta";
import { hostDoSlug, registrarSemDerrubar } from "@/lib/metricas-rota";
import { HOST_SEM_LOJA } from "@/lib/metricas-tenant";

/**
 * A porta da API para desenvolvedores: toda rota de `/api/v1` passa por
 * `rotaDaApi`, e é só aqui que se autentica, limita, trata erro e põe CORS.
 *
 * Rota nova não escreve nada disso: declara o escopo que exige e devolve o
 * corpo. Assim a regra "chave publicável só lê vitrine" não depende de cada
 * rota lembrar dela. Ver docs/API.md.
 *
 * A loja vem da chave, não do host: `/api/v1` responde igual em
 * lojas.avilaops.com e no domínio da loja, e uma chave nunca enxerga outra
 * loja porque toda consulta das rotas filtra pelo `tenant.id` daqui.
 */

export interface ContextoApi {
  request: Request;
  tenant: Tenant;
  chave: Pick<ChaveApi, "id" | "tipo" | "escopos">;
  url: URL;
}

/** Por minuto, por chave. Publicável é compartilhada por todos os visitantes de um site. */
const LIMITE_POR_MINUTO = { SECRETA: 120, PUBLICAVEL: 600 } as const;

const limitador = new LimitadorPorJanela();

/** Gravar o último uso a cada requisição seria uma escrita por leitura; um minuto basta para o painel. */
const INTERVALO_ULTIMO_USO_MS = 60_000;

async function autenticar(request: Request): Promise<{ tenant: Tenant; chave: ChaveApi }> {
  const bruta = chaveDaRequisicao(request);
  if (!bruta) {
    throw new ErroApi("chave_ausente", "Envie a chave em `Authorization: Bearer <chave>` ou no cabeçalho `x-api-key`.");
  }
  if (!tipoPeloFormato(bruta)) {
    throw new ErroApi("chave_invalida", "Chave em formato desconhecido. As chaves começam com `lojas_sk_` ou `lojas_pk_`.");
  }

  const chave = await prisma.chaveApi.findUnique({ where: { hash: hashDaChave(bruta) }, include: { tenant: true } });
  if (!chave) throw new ErroApi("chave_invalida", "Chave não reconhecida.");
  if (chave.revogadaEm) throw new ErroApi("chave_revogada", "Esta chave foi revogada no painel da loja.");

  const { tenant, ...resto } = chave;
  if (!lojaNoAr(tenant.status)) {
    throw new ErroApi("loja_fora_do_ar", `A loja "${tenant.nome}" não está no ar (status ${tenant.status}).`);
  }
  // A chave foi criada quando o plano permitia; um rebaixamento depois desliga
  // a chave secreta sem precisar revogar, e religar o plano a traz de volta.
  if (!planoPermite(chave.tipo, tenant.plano)) {
    throw new ErroApi("plano_sem_api", "A chave secreta da API é recurso do plano Loja Pro.");
  }

  if (!chave.ultimoUsoEm || Date.now() - chave.ultimoUsoEm.getTime() > INTERVALO_ULTIMO_USO_MS) {
    // Fora do caminho da resposta: falhar em anotar o uso não pode falhar a leitura.
    prisma.chaveApi.update({ where: { id: chave.id }, data: { ultimoUsoEm: new Date() } }).catch(() => {});
  }
  return { tenant, chave: resto };
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Api-Key, Content-Type",
  "Access-Control-Expose-Headers": "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, X-Requisicao-Id",
  "Access-Control-Max-Age": "86400",
};

export interface OpcoesDaRota {
  escopo: Escopo;
  /**
   * Rota de vitrine: aceita chamada do navegador de qualquer origem. Só faz
   * sentido junto com `vitrine:ler` — rota secreta sem CORS é o que impede um
   * site de embutir a chave secreta no JavaScript e funcionar "por enquanto".
   */
  navegador?: boolean;
}

type Manipulador<P> = (ctx: ContextoApi & { params: P }) => Promise<unknown>;

export function rotaDaApi<P = Record<string, never>>(opcoes: OpcoesDaRota, fazer: Manipulador<P>) {
  return async function (request: Request, segmento: { params: Promise<P> }): Promise<Response> {
    const requisicao = randomUUID();
    const cabecalhos: Record<string, string> = {
      "Cache-Control": "no-store",
      "X-Requisicao-Id": requisicao,
      ...(opcoes.navegador ? CORS : {}),
    };
    // A loja vem da chave, não do host: até autenticar, a métrica não tem de quem ser.
    const inicio = performance.now();
    let hostDaLoja: string = HOST_SEM_LOJA;
    const medida = (resposta: Response): Response => {
      registrarSemDerrubar({ host: hostDaLoja, grupo: "api-v1", status: resposta.status, duracaoMs: performance.now() - inicio });
      return resposta;
    };

    try {
      const { tenant, chave } = await autenticar(request);
      hostDaLoja = hostDoSlug(tenant.slug) ?? HOST_SEM_LOJA;
      if (!chave.escopos.includes(opcoes.escopo)) {
        throw new ErroApi(
          "escopo_insuficiente",
          chave.tipo === "PUBLICAVEL"
            ? "Chave publicável só lê a vitrine. Esta rota exige uma chave secreta (`lojas_sk_`)."
            : `Esta chave não tem o escopo \`${opcoes.escopo}\`. Crie outra chave com ele no painel.`,
        );
      }

      const limite = limitador.consumir(chave.id, LIMITE_POR_MINUTO[chave.tipo]);
      Object.assign(cabecalhos, cabecalhosDoLimite(limite));
      if (!limite.permitido) {
        throw new ErroApi("limite_excedido", `Limite de ${limite.limite} requisições por minuto atingido.`, {
          "Retry-After": String(limite.reiniciaEm),
        });
      }

      const corpo = await fazer({ request, tenant, chave, url: new URL(request.url), params: await segmento.params });
      return medida(Response.json(corpo, { headers: cabecalhos }));
    } catch (e) {
      if (e instanceof ErroApi) {
        return medida(Response.json(corpoDeErro(e.codigo, e.message, requisicao), {
          status: e.status,
          headers: { ...cabecalhos, ...e.cabecalhos },
        }));
      }
      // O detalhe vai para o log com o id; para fora vai só o id, que é o que
      // o desenvolvedor manda ao suporte para a gente achar a linha.
      console.error(`[api/v1] requisicao=${requisicao}`, e);
      return medida(Response.json(corpoDeErro("erro_interno", "Erro interno. Informe o id da requisição ao suporte.", requisicao), {
        status: 500,
        headers: cabecalhos,
      }));
    }
  };
}

/** Pré-voo do navegador nas rotas de vitrine. Não autentica: o navegador não manda a chave no OPTIONS. */
export function preVooDaVitrine(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
