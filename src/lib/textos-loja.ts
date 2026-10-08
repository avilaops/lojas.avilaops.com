import type { Tenant } from "@prisma/client";
import { resumoParaMeta } from "./seo-texto";
import type { TipoPolitica } from "./politicas";

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

/** As páginas institucionais que toda loja tem: as duas fixas e as políticas. */
export type PaginaInstitucional = "sobre" | "contato" | TipoPolitica;

type LojaDaPagina = Pick<Tenant, "nome" | "endereco"> & Partial<Pick<Tenant, "whatsapp" | "telefone" | "emailContato" | "horario">>;

/** "A, B e C". */
function enumerar(itens: string[]): string {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * A meta description de cada página institucional.
 *
 * Sem ela, `/sobre`, `/contato` e as quatro políticas herdavam a descrição da
 * loja (`descricaoDaLoja`) e saíam as seis com o mesmo texto da home. Para o
 * buscador, descrição repetida é descrição ausente: ele ignora e recorta um
 * trecho qualquer da página.
 *
 * Cada frase diz o assunto da página e de quem é, com a cidade quando a loja
 * a cadastrou. Nada aqui promete o que a página não tem: o contato só cita o
 * canal que existe, e nenhuma política fala de prazo ou valor, que mudam no
 * painel e fariam o resultado de busca desmentir a página.
 *
 * Cabe em 155 caracteres: a cidade sai primeiro quando o nome da loja é
 * longo, e `resumoParaMeta` corta o que ainda sobrar.
 */
export function descricaoDaPagina(t: LojaDaPagina, pagina: PaginaInstitucional): string {
  const nome = t.nome.trim();
  const e = (t.endereco ?? {}) as { cidade?: unknown; uf?: unknown };
  const cidade = typeof e.cidade === "string" ? e.cidade.trim() : "";
  const uf = typeof e.uf === "string" ? e.uf.trim().toUpperCase() : "";
  const lugar = cidade ? (uf ? `${cidade}/${uf}` : cidade) : "";

  const canais = [t.whatsapp && "WhatsApp", t.telefone && "telefone", t.emailContato && "e-mail", t.horario && "horário de atendimento"].filter((c): c is string => Boolean(c));

  /** `onde` entra entre o nome e o resto: ", de Cidade/UF" ou vazio. */
  const frases: Record<PaginaInstitucional, (onde: string) => string> = {
    sobre: (onde) => `Conheça a ${nome}${onde && `, ${onde}`}: quem somos, o que oferecemos e como atendemos.`,
    contato: (onde) => `Fale com a ${nome}${onde && `, ${onde}`}: ${canais.length ? enumerar(canais) : "canais de atendimento"}.`,
    envio: (onde) => `Política de envio da ${nome}${onde && `, ${onde}`}: despacho, formas de entrega, frete e acompanhamento do pedido.`,
    devolucao: () => `Trocas, devolução e reembolso na ${nome}: direito de arrependimento, condições e como solicitar.`,
    privacidade: () => `Como a ${nome} coleta, usa e protege seus dados pessoais, e como exercer seus direitos previstos na LGPD.`,
    termos: () => `Termos de serviço da ${nome}: condições de uso do site, pedidos, atendimento e responsabilidades.`,
    "aviso-legal": () => `Aviso legal da ${nome}: informações sobre o uso do site e do conteúdo publicado.`,
  };

  const preposicao = pagina === "envio" ? "a partir de" : "em";
  const comLugar = frases[pagina](lugar ? `${preposicao} ${lugar}` : "");
  const frase = comLugar.length <= 155 ? comLugar : frases[pagina]("");
  return resumoParaMeta(frase) ?? frase;
}
