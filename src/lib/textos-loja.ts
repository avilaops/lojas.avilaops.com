import type { Tenant } from "@prisma/client";
import { resumoParaMeta } from "./seo-texto";

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

/**
 * O que a loja diz de si numa frase: a meta description, o Open Graph e o
 * resumo do llms.txt.
 *
 * Antes era `slogan ?? "Loja virtual <nome>"`, e a PK Vedações, sem slogan,
 * saía no Google como "Loja virtual PK Vedações" enquanto o "Sobre" dela
 * dizia "Gaxetas e raspadores para cilindros hidráulicos e pneumáticos".
 * "Loja virtual X" descreve a plataforma, não a loja: fica por último, só
 * quando o lojista não escreveu nada em lugar nenhum.
 *
 * A ordem é a da intenção: slogan (escrito para isso), diferencial da marca
 * (o diagnóstico), primeiro parágrafo do "Sobre" (resumido ao tamanho que o
 * resultado de busca mostra). Campo em branco conta como ausente: `""` não
 * é slogan.
 */
export function descricaoDaLoja(t: Pick<Tenant, "nome" | "slogan" | "sobre">, diferencial?: string | null): string {
  const slogan = t.slogan?.trim();
  if (slogan) return slogan;
  const marca = resumoParaMeta(diferencial);
  if (marca) return marca;
  const sobre = resumoParaMeta((t.sobre ?? "").split(/\n{2,}/)[0]);
  if (sobre) return sobre;
  return `Loja virtual ${t.nome}`;
}
