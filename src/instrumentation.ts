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
