export class ErroCotacaoB2B extends Error {
  constructor(message: string, readonly status = 422) { super(message); this.name = "ErroCotacaoB2B"; }
}
