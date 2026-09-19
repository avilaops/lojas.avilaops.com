import { executarRotinasDevidas } from "./rotinas-executor";

/**
 * O relógio da plataforma.
 *
 * Acorda de minuto em minuto e roda o que venceu. Um minuto é a resolução: a
 * rotina de 5 min da fila do Mercado Livre dispara com até 60 s de folga, o
 * que é uma ordem de grandeza melhor do que qualquer agendador de fora
 * consegue garantir — e, ao contrário dele, não depende de nada estar de pé
 * além do próprio container que serve a loja.
 *
 * Quem coordena os containers é o banco, não este arquivo: a trava está em
 * `src/lib/rotinas-executor.ts`. Dois containers com este tique ligado nunca
 * rodam a mesma rotina duas vezes.
 */
const INTERVALO_MS = 60_000;

/** Um respiro depois do boot: o container precisa responder ao healthcheck. */
const ESPERA_INICIAL_MS = 15_000;

const globalParaAgendador = globalThis as unknown as {
  agendadorDeRotinas?: NodeJS.Timeout;
  rotinasEmAndamento?: boolean;
};

/**
 * O agendador está ligado?
 *
 * Ligado em produção; desligado em desenvolvimento, onde `next dev` reinicia o
 * processo a cada salvamento e disparar cobrança ou e-mail a partir daí seria
 * um acidente esperando acontecer. `ROTINAS_AGENDADOR` decide explicitamente
 * nos dois sentidos — é o que permite subir um segundo container só para
 * servir requisições, sem relógio.
 */
export function agendadorLigado(): boolean {
  const escolha = (process.env.ROTINAS_AGENDADOR ?? "").trim().toLowerCase();
  if (escolha === "1" || escolha === "true" || escolha === "sim") return true;
  if (escolha === "0" || escolha === "false" || escolha === "nao" || escolha === "não") return false;
  return process.env.NODE_ENV === "production";
}

async function tique(): Promise<void> {
  // Uma passada por vez neste processo. Uma rotina longa não pode empilhar
  // tiques até o Postgres ficar sem conexão.
  if (globalParaAgendador.rotinasEmAndamento) return;
  globalParaAgendador.rotinasEmAndamento = true;
  try {
    const feitas = await executarRotinasDevidas();
    for (const feita of feitas) {
      // Uma linha por execução, com o resumo. É o rastro que substitui a lista
      // de execuções do n8n enquanto a tela de operação não existe.
      const cauda = feita.erro ? `ERRO ${feita.erro}` : JSON.stringify(feita.resumo ?? null);
      console.log(`[rotina] ${feita.nome} ${feita.duracaoMs}ms ${cauda}`);
    }
  } catch (erro) {
    // Banco fora, por exemplo. O próximo tique tenta de novo.
    console.error("[rotina] passada falhou:", erro instanceof Error ? erro.message : erro);
  } finally {
    globalParaAgendador.rotinasEmAndamento = false;
  }
}

export function iniciarAgendador(): void {
  if (!agendadorLigado()) return;
  if (globalParaAgendador.agendadorDeRotinas) return;
  const relogio = setInterval(() => void tique(), INTERVALO_MS);
  // `unref` para o timer não segurar o processo no encerramento do container.
  relogio.unref?.();
  globalParaAgendador.agendadorDeRotinas = relogio;
  const primeira = setTimeout(() => void tique(), ESPERA_INICIAL_MS);
  primeira.unref?.();
  console.log(`[rotina] agendador ligado, passada a cada ${INTERVALO_MS / 1000}s`);
}
