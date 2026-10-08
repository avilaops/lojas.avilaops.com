import { prisma } from "./db";
import type { OrigemMcp } from "./mcp-auth";
import { FERRAMENTAS, ferramentaAltera } from "./mcp-permissoes";

/**
 * O histórico do conector MCP: o que cada assistente fez na loja.
 *
 * Uma linha por chamada de ferramenta, sem argumentos e sem resultado. O que
 * um assistente manda para `criar_produto` ou recebe de `obter_cliente` é dado
 * da loja e de quem comprou nela; o histórico responde "quem fez o quê, quando
 * e em quê", e para isso basta o nome da ferramenta e um identificador.
 */

/** Os argumentos que identificam o que foi tocado, na ordem de preferência. */
const CAMPOS_DE_ALVO = ["sku", "slug", "numero", "referencia", "codigo", "id", "produtoId", "pedidoId", "categoriaId", "clienteId", "avaliacaoId", "cupomId"] as const;

/**
 * O identificador do que a chamada tocou, ou `null`.
 *
 * Só campo de identificação, só texto curto ou número, e só o que parece
 * identificador: nome de cliente ou trecho de descrição que viesse num campo
 * chamado `id` não entra. É o que impede o histórico de virar cópia dos dados.
 */
export function alvoDaChamada(args: Record<string, unknown>): string | null {
  for (const campo of CAMPOS_DE_ALVO) {
    const v = args[campo];
    const texto = typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? v.trim() : "";
    if (texto && texto.length <= 80 && /^[\w.\-/:#]+$/.test(texto)) return texto;
  }
  return null;
}

export interface ChamadaParaRegistrar {
  tenantId: string;
  origem: OrigemMcp;
  ferramenta: string;
  args: Record<string, unknown>;
  ok: boolean;
  duracaoMs: number;
}

/**
 * Anota a chamada. Nunca derruba a resposta: o assistente já fez o que fez, e
 * falhar aqui só esconderia isso do lojista sem desfazer nada.
 */
export async function registrarChamada(c: ChamadaParaRegistrar): Promise<void> {
  try {
    await prisma.chamadaMcp.create({
      data: {
        tenantId: c.tenantId,
        conexaoId: c.origem.tipo === "conexao" ? c.origem.id : null,
        chaveId: c.origem.tipo === "chave" ? c.origem.id : null,
        origem: c.origem.nome.slice(0, 80),
        ferramenta: c.ferramenta.slice(0, 80),
        alterou: ferramentaAltera(c.ferramenta),
        ok: c.ok,
        alvo: alvoDaChamada(c.args),
        duracaoMs: Math.max(0, Math.round(c.duracaoMs)),
      },
    });
  } catch (e) {
    console.error("[mcp] falha ao registrar chamada no histórico", e instanceof Error ? e.name : "erro");
  }
}

/** Três meses respondem "o que aconteceu com este produto"; mais que isso é arquivo. */
export const RETENCAO_DIAS = 90;

export interface ChamadaDoPainel {
  id: string;
  quando: string;
  origem: string;
  ferramenta: string;
  /** Nome legível da ferramenta, o mesmo que o assistente mostra. */
  titulo: string;
  alterou: boolean;
  ok: boolean;
  alvo: string | null;
}

/**
 * As últimas chamadas da loja. A faxina do que passou da retenção acontece
 * aqui, quando o lojista abre o painel: a tabela só é lida por esta tela, e
 * assim não é preciso uma rotina só para ela.
 */
export async function chamadasDaLoja(tenantId: string, opcoes: { soAlteracoes?: boolean; limite?: number } = {}): Promise<ChamadaDoPainel[]> {
  await prisma.chamadaMcp.deleteMany({
    where: { tenantId, criadaEm: { lt: new Date(Date.now() - RETENCAO_DIAS * 86_400_000) } },
  });
  const linhas = await prisma.chamadaMcp.findMany({
    where: { tenantId, ...(opcoes.soAlteracoes ? { alterou: true } : {}) },
    orderBy: { criadaEm: "desc" },
    take: Math.min(Math.max(opcoes.limite ?? 50, 1), 200),
  });
  return linhas.map((l) => ({
    id: l.id,
    quando: l.criadaEm.toISOString(),
    origem: l.origem,
    ferramenta: l.ferramenta,
    titulo: FERRAMENTAS[l.ferramenta]?.titulo ?? l.ferramenta,
    alterou: l.alterou,
    ok: l.ok,
    alvo: l.alvo,
  }));
}
