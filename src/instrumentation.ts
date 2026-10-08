import type { Instrumentation } from "next";

/**
 * Gancho de boot do servidor (Next.js). Roda uma vez por processo.
 *
 * É daqui que a plataforma passa a se agendar sozinha. Antes as rotinas
 * dependiam de o n8n chamar os endpoints de tempos em tempos; agora o relógio
 * mora no mesmo container que serve a loja, e quem impede dois containers de
 * fazerem o mesmo trabalho é a trava no banco (`src/lib/rotinas-executor.ts`).
 */
export async function register(): Promise<void> {
  // O runtime Edge não tem timers longos nem Prisma; só o nodejs agenda.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Importação tardia para o build e o runtime Edge não carregarem o Prisma.
  const { iniciarAgendador } = await import("./lib/rotinas-agendador");
  iniciarAgendador();
}

/**
 * Erro que o Next capturou fora de uma rota medida: conta como erro da loja no
 * grupo do que quebrou (página, server action ou o resto).
 *
 * Lê só o host e o tipo de rota. `request.path` traz a query — é onde moram
 * token de webhook e e-mail de recuperação — e a mensagem do erro pode trazer
 * dado do pedido: nenhum dos dois é lido aqui. Ver docs/METRICAS.md.
 */
export const onRequestError: Instrumentation.onRequestError = async (erro, request, contexto) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { erroJaContado } = await import("./lib/metricas-rota");
    // O `medirRota` já contou este erro no grupo certo, com a duração.
    if (erroJaContado(erro)) return;
    const { registroGlobal } = await import("./lib/metricas-tenant");
    const cabecalho = request.headers["x-forwarded-host"] ?? request.headers["host"];
    const grupo = contexto.routeType === "render" ? "render" : contexto.routeType === "action" ? "acao" : "outra";
    registroGlobal().registrarErro({ host: Array.isArray(cabecalho) ? cabecalho[0] : cabecalho, grupo });
  } catch {
    // Métrica que falha não pode virar um segundo erro em cima do primeiro.
  }
};
