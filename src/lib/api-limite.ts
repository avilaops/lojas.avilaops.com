/**
 * Limite de requisições por chave, em janela fixa de um minuto.
 *
 * Na memória do processo, de propósito: a plataforma roda num container só
 * (ver deploy/deploy.sh), e um Redis para contar requisição seria a primeira
 * peça de infraestrutura que existe só para isto. Quando houver mais de uma
 * réplica, o limite efetivo vira N vezes o declarado — o contrato com quem
 * integra (os cabeçalhos `RateLimit-*`) não muda, só o lugar onde se conta.
 */

export interface ResultadoLimite {
  permitido: boolean;
  limite: number;
  restante: number;
  /** Segundos até a janela recomeçar. */
  reiniciaEm: number;
}

const JANELA_MS = 60_000;
const MAXIMO_DE_CHAVES = 10_000;

export class LimitadorPorJanela {
  private contagens = new Map<string, { inicio: number; usadas: number }>();

  constructor(
    private agora: () => number = Date.now,
    /** Um minuto é o contrato dos cabeçalhos `RateLimit-*`; janela maior é para contar erro, não requisição. */
    private janelaMs: number = JANELA_MS,
  ) {}

  /** O limite já foi atingido? Não consome: é para contar só o que deu errado depois. */
  esgotado(chave: string, limite: number): { esgotado: boolean; reiniciaEm: number } {
    const agora = this.agora();
    const atual = this.contagens.get(chave);
    if (!atual || agora - atual.inicio >= this.janelaMs) return { esgotado: false, reiniciaEm: 0 };
    return { esgotado: atual.usadas >= limite, reiniciaEm: Math.max(1, Math.ceil((atual.inicio + this.janelaMs - agora) / 1000)) };
  }

  consumir(chave: string, limite: number): ResultadoLimite {
    const agora = this.agora();
    let atual = this.contagens.get(chave);
    if (!atual || agora - atual.inicio >= this.janelaMs) {
      if (this.contagens.size >= MAXIMO_DE_CHAVES) this.varrer(agora);
      atual = { inicio: agora, usadas: 0 };
      this.contagens.set(chave, atual);
    }
    const reiniciaEm = Math.max(1, Math.ceil((atual.inicio + this.janelaMs - agora) / 1000));
    if (atual.usadas >= limite) return { permitido: false, limite, restante: 0, reiniciaEm };
    atual.usadas += 1;
    return { permitido: true, limite, restante: limite - atual.usadas, reiniciaEm };
  }

  /** Esquece janelas vencidas; sem isto, chave que parou de chamar ficaria para sempre. */
  private varrer(agora: number) {
    for (const [k, v] of this.contagens) if (agora - v.inicio >= this.janelaMs) this.contagens.delete(k);
  }
}

export function cabecalhosDoLimite(r: ResultadoLimite): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limite),
    "RateLimit-Remaining": String(r.restante),
    "RateLimit-Reset": String(r.reiniciaEm),
  };
}
