import { executarRotinasDevidas } from "./rotinas-executor";
import { passadaUnica, type EstadoDaPassada } from "./passada-unica";

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

/**
 * Quanto tempo esperar por uma passada antes de dá-la por perdida.
 *
 * Folgado de propósito: nenhuma passada saudável chega perto — todas são
 * lotes com teto, e a mais cara delas, a do Mercado Livre, mede segundos. O
 * prazo não existe para apertar rotina lenta, existe para o relógio não
 * emudecer quando uma passada não voltar nunca. Ver `passada-unica.ts`.
 */
const PRAZO_DA_PASSADA_MS = 10 * 60_000;

const globalParaAgendador = globalThis as unknown as {
  agendadorDeRotinas?: NodeJS.Timeout;
  passada?: EstadoDaPassada;
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
  // Uma passada por vez neste processo, e com prazo: uma rotina longa não pode
  // empilhar tiques até o Postgres ficar sem conexão, e uma passada que não
  // volta não pode desligar o relógio em silêncio.
  const estado = (globalParaAgendador.passada ??= {});
  const { perdida } = await passadaUnica(estado, PRAZO_DA_PASSADA_MS, async () => {
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
    }
  });
  if (perdida) {
    // Não é "falhou": é "não voltou". A rotina que ficou pendurada continua
    // com a linha travada no banco até a `travaMinutos` dela vencer; as outras
    // já andam no próximo tique.
    console.error(
      `[rotina] passada não voltou em ${PRAZO_DA_PASSADA_MS / 60_000} min e foi dada por perdida; o relógio segue`,
    );
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
