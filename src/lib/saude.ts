/**
 * Saúde do processo para quem decide manter ou derrubar a versão no ar:
 * `deploy/deploy.sh` (30 tentativas antes do rollback), o healthcheck do
 * `docker-compose.yml` e o smoke HTTP do pipeline.
 *
 * Fica aqui, fora da rota, por dois motivos: o contrato da resposta é testável
 * sem subir Next nem Postgres, e quem lê o JSON do deploy precisa saber o que
 * cada campo promete. `/v1/health` e `/v1/ready` (CT-17/CT-18) continuam sendo
 * o par do coletor de aplicações; este é o probe do container.
 */
export interface Saude {
  ok: boolean;
  servico: string;
  /** "ok" quando o SELECT 1 voltou; "indisponivel" quando o banco recusou. */
  banco: "ok" | "indisponivel";
  /** Ida e volta do SELECT 1, em milissegundos com duas casas. Sobe antes de cair. */
  latenciaBancoMs: number;
  agora: string;
}

export const SERVICO = "lojas-avilaops";

/**
 * Nunca lança: o probe que estoura vira "sem resposta", e sem resposta o
 * deploy não sabe distinguir banco fora do ar de processo morto. Erro de
 * banco vira 503 com corpo, que é informação.
 */
export async function conferirSaude(
  consultarBanco: () => Promise<unknown>,
  agora: () => Date = () => new Date(),
): Promise<{ corpo: Saude; status: number }> {
  const inicio = performance.now();
  const base = { servico: SERVICO, agora: agora().toISOString() };
  try {
    await consultarBanco();
    return { corpo: { ok: true, banco: "ok", latenciaBancoMs: milissegundos(inicio), ...base }, status: 200 };
  } catch {
    return { corpo: { ok: false, banco: "indisponivel", latenciaBancoMs: milissegundos(inicio), ...base }, status: 503 };
  }
}

function milissegundos(inicio: number): number {
  return Math.round((performance.now() - inicio) * 100) / 100;
}
