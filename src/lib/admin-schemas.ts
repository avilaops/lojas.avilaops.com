import { z } from "zod";
import { validarCnpj } from "@avilaops/checkout";
import { TemaSchema } from "./tema";
import { IdentidadeSchema } from "./identidade";

/**
 * Contratos da API administrativa. É o que o formulário de onboarding do
 * portal e o fluxo n8n enviam. Tudo opcional além de slug e nome, de
 * propósito: a loja nasce com o mínimo e vai sendo completada.
 */

const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, "slug: letras minúsculas, números e hífen");
const digitos = (min: number, max: number) => z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(min).max(max));
const whatsappBrasil = z.string().transform((s, ctx) => {
  const numeros = s.replace(/\D/g, "");
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`;
  if (numeros.length === 12 || numeros.length === 13) return numeros;
  ctx.addIssue({ code: "custom", message: "Informe um WhatsApp válido com DDD." });
  return z.NEVER;
});

export const EnderecoSchema = z.object({
  logradouro: z.string().max(120).optional(),
  numero: z.string().max(20).optional(),
  bairro: z.string().max(80).optional(),
  cidade: z.string().max(80).optional(),
  uf: z.string().length(2).optional(),
  cep: digitos(8, 8).optional(),
});

export const TenantEntradaSchema = z.object({
  slug,
  nome: z.string().min(2).max(80),
  plano: z.enum(["SITE", "LOJA", "LOJA_PRO"]).optional(),
  // Sempre o apex: o proxy manda www para cá com 308, e um principal em www
  // faria o redirecionamento apontar para si mesmo, em laço.
  dominioPrincipal: z
    .string()
    .min(4)
    .max(253)
    .toLowerCase()
    .transform((d) => d.replace(/^www\./, ""))
    .optional(),
  dominios: z.array(z.string().min(4).max(253).toLowerCase()).optional(),
  logoUrl: z.string().url().optional(),
  /**
   * Pasta dos ícones da loja, servida pela plataforma: `/uploads/<slug>` ou
   * `/<pasta>` em `public`. Dentro dela os nomes são fixos (favicon.ico,
   * favicon.svg, favicon-96x96.png, apple-touch-icon.png, site.webmanifest).
   * Caminho, não URL: o ícone tem que resolver no domínio próprio do lojista
   * também, e host fixo aqui quebraria isso.
   */
  faviconUrl: z
    .string()
    .regex(/^\/[A-Za-z0-9._\-/]*$/, "Informe um caminho como /uploads/minhaloja")
    .max(200)
    .nullable()
    .optional(),
  bannerUrl: z.string().url().nullable().optional(),
  tema: TemaSchema.partial().optional(),
  identidade: IdentidadeSchema.partial().optional(),
  slogan: z.string().max(140).optional(),
  /**
   * O ramo, que liga blocos de vitrine específicos sem código por loja:
   * "motopecas" (garagem, compatibilidade, código original — src/lib/motos.ts)
   * e "farmacia" (tarja, princípio ativo, equivalentes, responsável técnico —
   * src/lib/farmacia.ts). "geral" é a loja comum.
   */
  segmento: z.enum(["geral", "motopecas", "farmacia"]).optional(),
  avisoTopo: z.string().trim().max(120).nullable().optional(),
  sobre: z.string().max(4000).optional(),
  /** Crawlers de treinamento de IA. Não muda nada na busca; ver descoberta.ts. */
  permiteTreinamentoIa: z.boolean().optional(),
  // Aceita o formato brasileiro que o cliente conhece (DDD + número) e
  // normaliza para DDI 55, sem rejeitar quem já informou o código do país.
  whatsapp: whatsappBrasil.optional(),
  telefone: z.string().max(30).optional(),
  emailContato: z.string().email().optional(),
  // Identificação do fornecedor (Decreto 7.962/2013). Guardado sem máscara; o
  // dígito verificador é conferido aqui para o rodapé nunca exibir CNPJ falso.
  razaoSocial: z.string().trim().min(2).max(120).nullable().optional(),
  cnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(validarCnpj, "CNPJ inválido")
    .nullable()
    .optional(),
  /**
   * Responsável técnico da farmácia (RDC 44/2009, art. 55). Sem ele o rodapé
   * da loja de farmácia mostra só o aviso legal — nunca um nome inventado.
   */
  farmaceuticoResponsavel: z.string().trim().min(2).max(120).nullable().optional(),
  farmaceuticoCrf: z.string().trim().min(3).max(40).nullable().optional(),
  licencaSanitaria: z.string().trim().min(2).max(60).nullable().optional(),
  autorizacaoAnvisa: z.string().trim().min(2).max(40).nullable().optional(),
  instagram: z.string().url().optional(),
  endereco: EnderecoSchema.optional(),
  horario: z.string().max(140).optional(),
  cepOrigem: digitos(8, 8).optional(),
  retiradaNaLoja: z.boolean().optional(),
  enderecoPublico: z.boolean().optional(),
  despachoDiasUteis: z.number().int().min(0).max(30).optional(),
  estoqueBaixoEm: z.number().int().min(0).max(100).optional(),
  pesoPadraoKg: z.number().positive().max(100).optional(),
  tabelaFrete: z
    .array(z.object({ ufs: z.array(z.string()), preco: z.number().int().nonnegative(), prazoDiasUteis: z.number().int().positive(), nome: z.string().optional() }))
    .optional(),
  // Prefixo de CEP: 1 a 8 dígitos. O mínimo de 1 é o que impede uma faixa de
  // motoboy de valer para o Brasil inteiro — ver entregaLocal() em lib/frete.
  // Prazo aceita zero: entrega local costuma ser no mesmo dia.
  entregaLocal: z
    .array(z.object({
      prefixos: z.array(z.string().regex(/^\d{1,8}$/)).min(1),
      nome: z.string().trim().min(2).max(60),
      preco: z.number().int().nonnegative(),
      prazoDiasUteis: z.number().int().min(0).max(30),
      gratisAcima: z.number().int().nonnegative().nullable().optional(),
    }))
    .optional(),
  freteGratisAcima: z.number().int().nonnegative().nullable().optional(),
  meiosPagamento: z.array(z.enum(["pix", "cartao", "boleto"])).min(1).optional(),
  gtmId: z.string().regex(/^GTM-[A-Z0-9]+$/).nullable().optional(),
  metaPixelId: z.string().regex(/^\d{6,20}$/).nullable().optional(),
  ga4Id: z.string().regex(/^G-[A-Z0-9]{4,15}$/i).nullable().optional(),
  googleAdsId: z.string().regex(/^AW-\d{6,15}$/i).nullable().optional(),
  googleAdsRotuloCompra: z.string().trim().max(60).nullable().optional(),
  tiktokPixelId: z.string().regex(/^[A-Z0-9]{10,30}$/i).nullable().optional(),
  /** Credenciais do Mercado Pago da loja. Só o access token é cifrado; a public key vai no HTML. */
  mercadoPago: z
    .object({ publicKey: z.string().min(10), accessToken: z.string().min(10), webhookSecret: z.string().min(10).optional() })
    .optional(),
});

export const TenantAtualizacaoSchema = TenantEntradaSchema.partial().extend({
  status: z.enum(["PROVISIONANDO", "ATIVA", "SUSPENSA", "CANCELADA"]).optional(),
  /** Loja da casa (demo, vitrine própria): fora da régua de cobrança. */
  cobrancaIsenta: z.boolean().optional(),
});

export const ProdutoEntradaSchema = z.object({
  slug: z.string().max(80).optional(),
  nome: z.string().min(1).max(160),
  categoria: z.string().max(80).optional(), // nome; criada se não existir
  marca: z.string().max(80).optional(),
  sku: z.string().max(60).optional(),
  gtin: z.string().max(20).optional(),
  mpn: z.string().trim().max(60).nullable().optional(),
  identificadoresEstado: z.enum(["desconhecido", "informado", "sem_identificador"]).optional(),
  precoCentavos: z.number().int().nonnegative(),
  precoDeCentavos: z.number().int().nonnegative().nullable().optional(),
  descricaoCurta: z.string().max(300).optional(),
  descricao: z.string().max(8000).optional(),
  imagens: z.array(z.string().url()).max(10).optional(),
  /**
   * O que a imagem é deste item: `propria` (SKU exato), `representativa`
   * (família visual, a vitrine avisa) ou `ilustracao` (desenho das medidas).
   *
   * Imagem plausível de produto errado é pior que ausência de imagem. Quem
   * importa declara a origem; a vitrine só obedece.
   */
  imagemOrigem: z.enum(["propria", "representativa", "ilustracao"]).optional(),
  /** Família da imagem representativa ("6200", "UCP"): obrigatória nela. */
  imagemFamilia: z.string().trim().min(1).max(40).nullable().optional(),
  destaque: z.boolean().optional(),
  ativo: z.boolean().optional(),
  disponibilidade: z.enum(["in_stock", "out_of_stock", "backorder"]).optional(),
  estoque: z.number().int().nonnegative().nullable().optional(),
  pesoKg: z.number().positive().optional(),
  alturaCm: z.number().positive().optional(),
  larguraCm: z.number().positive().optional(),
  comprimentoCm: z.number().positive().optional(),
  atributos: z.record(z.string(), z.unknown()).optional(),
  // Farmácia (segmento farmacia). Ver src/lib/farmacia.ts.
  //
  // A tarja é o único campo aqui que restringe a venda, e por isso é enum
  // fechado: "vermelha-retencao" e "preta" tiram o item do carrinho em toda a
  // vitrine. Um typo de importação vira "nenhuma" e o painel cobra o acerto —
  // ver `pendenciasDe`.
  tarja: z.enum(["nenhuma", "livre", "vermelha", "vermelha-retencao", "preta"]).optional(),
  principioAtivo: z.string().trim().max(160).nullable().optional(),
  apresentacao: z.string().trim().max(120).nullable().optional(),
  /// 13 dígitos; guardado sem máscara, como o CNPJ.
  registroAnvisa: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || v.length === 13, "Registro Anvisa tem 13 dígitos")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  tipoMedicamento: z.enum(["referencia", "generico", "similar", "novo", "fitoterapico", "manipulado"]).nullable().optional(),
  // Peças por moto (segmento motopecas). Vazio = universal.
  codigoOriginal: z.string().trim().max(60).nullable().optional(),
  codigosEquivalentes: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  compatibilidade: z
    .array(z.object({ marca: z.string().trim().min(1).max(40), modelo: z.string().trim().min(1).max(60), anoDe: z.number().int().min(1950).max(2100).optional(), anoAte: z.number().int().min(1950).max(2100).optional() }))
    .max(200)
    .optional(),
});

/**
 * As duas regras de honestidade da imagem, aplicáveis a qualquer entrada
 * (produto inteiro na importação ou campos soltos na edição do painel).
 *
 * Ficam fora do `z.object` porque `.refine()` devolve um `ZodEffects`, e aí
 * `.partial()` deixa de existir — o painel edita campo a campo e precisa dele.
 */
export function conferirImagem<T extends { imagemOrigem?: string | null; imagemFamilia?: string | null; imagens?: string[] }>(
  schema: z.ZodType<T>,
): z.ZodEffects<z.ZodType<T>, T, unknown> {
  return schema
    // Imagem herdada tem que dizer de qual família herdou. Sem isso não há como
    // achar quem a usa no dia em que ela for trocada, e a foto de uma peça
    // errada fica espalhada pelo catálogo sem rastro.
    .refine((p) => p.imagemOrigem !== "representativa" || !!p.imagemFamilia, {
      message: "Imagem representativa exige imagemFamilia (a série de que ela veio).",
      path: ["imagemFamilia"],
    })
    // Declarar origem sem imagem é engano de cadastro: o aviso apareceria na
    // vitrine sem foto nenhuma para justificar.
    .refine((p) => !p.imagemOrigem || p.imagemOrigem === "propria" || (p.imagens?.length ?? 0) > 0, {
      message: "Origem de imagem declarada sem nenhuma imagem.",
      path: ["imagens"],
    });
}

/** Importação em lote: o produto vem inteiro, então as regras valem sempre. */
export const ProdutoImportadoSchema = conferirImagem(ProdutoEntradaSchema);

export type TenantEntrada = z.infer<typeof TenantEntradaSchema>;
export type ProdutoEntrada = z.infer<typeof ProdutoEntradaSchema>;
