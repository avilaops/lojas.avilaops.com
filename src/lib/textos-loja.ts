import type { Tenant } from "@prisma/client";

/**
 * "no mesmo dia útil" / "em até 1 dia útil" / "em até 3 dias úteis".
 *
 * Existia como `${dias} dia(s) útil(eis)` em três telas, e `dia(s) útil(eis)`
 * é texto de template vazando para o comprador — o detalhe que faz o site
 * parecer inacabado bem na hora em que ele promete um prazo. O plural é do
 * número, então quem sabe o número é quem escreve a frase.
 *
 * Zero não é "em até 0 dias": é despacho no mesmo dia, que é promessa melhor
 * e precisa ser dita como tal. A Vedashow está configurada assim.
 */
export function prazoDeDespacho(dias: number): string {
  if (dias <= 0) return "no mesmo dia útil";
  return dias === 1 ? "em até 1 dia útil" : `em até ${dias} dias úteis`;
}

/**
 * "pelo contato@loja.com" / "pelo WhatsApp da loja" / "pelos nossos canais".
 *
 * A preposição vem junto porque ela concorda com o que vier depois: com
 * `pelo ${contato}` fixo, o caso sem canal configurado escrevia "fale conosco
 * **pelo nossos** canais de atendimento" nas três políticas — erro de
 * concordância em página jurídica.
 *
 * Quando a loja não tem canal nenhum, a frase fica correta mas continua
 * apontando para o vazio: isso é dado de tenant faltando, não texto a
 * consertar. Ver `contatoConfigurado`.
 */
export function porOndeFalarCom(t: Pick<Tenant, "emailContato" | "whatsapp">): string {
  if (t.emailContato) return `pelo ${t.emailContato}`;
  if (t.whatsapp) return "pelo WhatsApp da loja";
  return "pelos nossos canais de atendimento";
}
