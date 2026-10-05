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

  constructor(private agora: () => number = Date.now) {}

  consumir(chave: string, limite: number): ResultadoLimite {
    const agora = this.agora();
    let atual = this.contagens.get(chave);
    if (!atual || agora - atual.inicio >= JANELA_MS) {
      if (this.contagens.size >= MAXIMO_DE_CHAVES) this.varrer(agora);
      atual = { inicio: agora, usadas: 0 };
      this.contagens.set(chave, atual);
    }
    const reiniciaEm = Math.max(1, Math.ceil((atual.inicio + JANELA_MS - agora) / 1000));
    if (atual.usadas >= limite) return { permitido: false, limite, restante: 0, reiniciaEm };
    atual.usadas += 1;
    return { permitido: true, limite, restante: limite - atual.usadas, reiniciaEm };
  }

  /** Esquece janelas vencidas; sem isto, chave que parou de chamar ficaria para sempre. */
  private varrer(agora: number) {
    for (const [k, v] of this.contagens) if (agora - v.inicio >= JANELA_MS) this.contagens.delete(k);
  }
}

export function cabecalhosDoLimite(r: ResultadoLimite): Record<string, string> {
  return {
    "RateLimit-Limit": String(r.limite),
    "RateLimit-Remaining": String(r.restante),
    "RateLimit-Reset": String(r.reiniciaEm),
  };
}
