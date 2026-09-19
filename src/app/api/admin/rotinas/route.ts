import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { agendadorLigado } from "@/lib/rotinas-agendador";
import {
  ROTINAS,
  NOMES_DE_ROTINA,
  atrasada,
  descreverCadencia,
  proximaExecucao,
} from "@/lib/rotinas";

/**
 * GET /api/admin/rotinas — o que roda sozinho e se ainda está rodando.
 *
 * Substitui a lista de execuções do n8n: sem ela, uma rotina que para de
 * funcionar não avisa ninguém. Cada linha diz quando rodou, quanto demorou, o
 * que devolveu e há quantas execuções está falhando.
 *
 * `saudavel: false` na resposta é a pergunta que um monitor deve fazer.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const agora = new Date();
  const linhas = new Map(
    (await prisma.rotina.findMany({ where: { nome: { in: NOMES_DE_ROTINA } } })).map((r) => [r.nome, r]),
  );

  const rotinas = NOMES_DE_ROTINA.map((nome) => {
    const definicao = ROTINAS[nome];
    const linha = linhas.get(nome);
    // Sem linha, a rotina ainda não teve a primeira passada do agendador.
    const proximaEm = linha?.proximaEm ?? proximaExecucao(definicao.cadencia, agora);
    const emAtraso = Boolean(linha) && atrasada(definicao.cadencia, proximaEm, agora);
    const falhando = (linha?.falhasSeguidas ?? 0) >= definicao.falhasAteAlerta;
    return {
      nome,
      titulo: definicao.titulo,
      descricao: definicao.descricao,
      cadencia: descreverCadencia(definicao.cadencia),
      proximaEm: proximaEm.toISOString(),
      ultimaEm: linha?.ultimaEm?.toISOString() ?? null,
      ultimaDuracaoMs: linha?.ultimaDuracaoMs ?? null,
      ultimoResumo: linha?.ultimoResumo ?? null,
      ultimoErro: linha?.ultimoErro ?? null,
      falhasSeguidas: linha?.falhasSeguidas ?? 0,
      execucoes: linha?.execucoes ?? 0,
      executandoDesde: linha?.executandoDesde?.toISOString() ?? null,
      // Nunca executada não é "com problema": é só uma rotina que ainda não
      // venceu. O que é problema é ter vencido e não ter rodado.
      emAtraso,
      falhando,
      saudavel: !emAtraso && !falhando,
    };
  });

  return Response.json(
    {
      agendador: { ligado: agendadorLigado(), passadaSegundos: 60 },
      saudavel: rotinas.every((r) => r.saudavel),
      rotinas,
      verificadoEm: agora.toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
