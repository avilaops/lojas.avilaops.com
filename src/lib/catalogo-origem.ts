/**
 * Quem alterou o produto, do jeito que vai para `HistoricoCatalogo.origem`.
 *
 * O histórico dizia só "painel": o caminho, não a pessoa. Agora a origem de
 * uma alteração feita por gente leva quem foi, num formato que quem lê
 * consegue separar sem adivinhar:
 *
 *   painel:dono                 login principal da loja
 *   painel:<e-mail>             operador ou gerente convidado
 *   avilaops:<nome>             equipe da Ávila Ops, pelo painel dela
 *
 * O que é automático continua dizendo o que é: `importacao`, `api:<chave>`,
 * `migracao:…`. Registro antigo, gravado como `painel`, fica como está — não
 * se inventa autor para o que não foi registrado.
 */
export function origemDoPainel(sessao: { operador: { email: string } | null }): string {
  return sessao.operador ? `painel:${sessao.operador.email.trim().toLowerCase().slice(0, 120)}` : "painel:dono";
}

/** A equipe da Ávila Ops, identificada pelo nome que o painel dela conhece. */
export function origemDaAvilaOps(autor: string): string {
  return `avilaops:${autor.replace(/\s+/g, " ").trim().slice(0, 60)}`;
}
