import type { DefinicaoProvedor, ProvedorId } from "./types.ts";

/**
 * Registro de provedores de pagamento.
 *
 * Quem acrescenta um provedor escreve um adaptador (`PaymentProvider`), uma
 * `DefinicaoProvedor` e registra aqui. Nada no app compara nome de provedor:
 * pergunta ao registro e às capacidades.
 */
export class RegistroDeProvedores {
  private readonly definicoes = new Map<ProvedorId, DefinicaoProvedor>();

  registrar(def: DefinicaoProvedor): this {
    if (this.definicoes.has(def.id)) throw new Error(`Provedor de pagamento registrado duas vezes: ${def.id}`);
    this.definicoes.set(def.id, def);
    return this;
  }

  obter(id: ProvedorId): DefinicaoProvedor {
    const def = this.definicoes.get(id);
    if (!def) throw new Error(`Provedor de pagamento não registrado: ${id}`);
    return def;
  }

  tem(id: string): id is ProvedorId {
    return this.definicoes.has(id as ProvedorId);
  }

  listar(): DefinicaoProvedor[] {
    return [...this.definicoes.values()];
  }
}
