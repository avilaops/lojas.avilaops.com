/**
 * Uma passada por vez, e nenhuma para sempre.
 *
 * O agendador guarda a passada com uma trava neste processo, para uma rotina
 * demorada não empilhar tiques até o Postgres ficar sem conexão. A trava
 * resolve o empilhamento e cria um problema pior: **passada que nunca termina
 * não falha, emudece.** Sem erro, sem `falhasSeguidas`, sem nada na tela de
 * operação — o relógio simplesmente para, e quem olha lê "ainda não venceu".
 *
 * Não é hipótese de manual. Toda chamada de rede daqui tem prazo próprio
 * (`AbortSignal.timeout`), mas consulta ao banco não tem: um lock no Postgres
 * segura o `await` pelo tempo que durar. Um `await` desses no meio de uma
 * rotina desliga o agendador inteiro até o container ser reiniciado — que é
 * exatamente a falha calada que esta plataforma existe para não ter.
 *
 * Vencido o prazo, o trabalho pendurado **não** é cancelado: não há como
 * cancelá-lo. O que acontece é a guarda ser solta, para o próximo tique andar.
 * Quem impede a rotina pendurada de rodar duas vezes continua sendo a trava no
 * banco (`executandoDesde` + `travaMinutos`), que já trata container morto no
 * meio do caminho exatamente assim — e passada pendurada é indistinguível de
 * container morto, do ponto de vista da linha na tabela.
 */

export interface EstadoDaPassada {
  /** Há uma passada correndo neste processo? */
  emAndamento?: boolean;
}

export interface RelatoDaPassada {
  /** Outra passada já estava correndo: esta nem começou. */
  pulada: boolean;
  /** O prazo venceu antes de a passada terminar; a guarda foi solta. */
  perdida: boolean;
}

/**
 * Roda `trabalho` sob a guarda de `estado`, desistindo de esperar em `prazoMs`.
 *
 * Desistir de esperar não é desistir do trabalho: quem devolve `perdida` está
 * dizendo "não sei se terminou", e é isso que vai para o log. Dizer "falhou"
 * seria inventar um desfecho que ninguém observou.
 */
export async function passadaUnica(
  estado: EstadoDaPassada,
  prazoMs: number,
  trabalho: () => Promise<void>,
): Promise<RelatoDaPassada> {
  if (estado.emAndamento) return { pulada: true, perdida: false };
  estado.emAndamento = true;

  // A guarda é solta por quem chegar primeiro, o trabalho ou o prazo, e uma
  // vez só: soltar de novo liberaria uma passada que já é de outro tique.
  let solta = false;
  const soltar = () => {
    if (solta) return;
    solta = true;
    estado.emAndamento = false;
  };

  // O vigia não leva `unref`, ao contrário do tique que o chama. Timer com
  // `unref` só dispara enquanto o laço de eventos tem outra coisa segurando o
  // processo — e um vigia que pode ser calado justamente quando tudo o mais
  // parou não é vigia. Ele vive no máximo até o prazo e é desarmado no
  // `finally`, então o custo é nenhum: o encerramento do container espera, na
  // pior das hipóteses, o que já estava pendurado de qualquer jeito.
  let vigia: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<"prazo">((resolve) => {
    vigia = setTimeout(() => resolve("prazo"), prazoMs);
  });

  const feito = trabalho().then(() => "feito" as const);
  // O trabalho segue pendurado depois do prazo. O que não pode é a rejeição
  // dele chegar sem dono mais tarde e derrubar o processo inteiro — e ela
  // chegaria sem dono, porque a corrida já terá ido embora.
  feito.catch(() => {});

  try {
    return { pulada: false, perdida: (await Promise.race([feito, prazo])) === "prazo" };
  } finally {
    if (vigia) clearTimeout(vigia);
    soltar();
  }
}
