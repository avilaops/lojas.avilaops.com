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
  dominioPrincipal: z.string().min(4).max(253).toLowerCase().optional(),
  dominios: z.array(z.string().min(4).max(253).toLowerCase()).optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  tema: TemaSchema.partial().optional(),
  identidade: IdentidadeSchema.partial().optional(),
  slogan: z.string().max(140).optional(),
  /** "geral" ou "motopecas" (garagem, compatibilidade, código original). Ver src/lib/motos.ts. */
  segmento: z.enum(["geral", "motopecas"]).optional(),
  avisoTopo: z.string().trim().max(120).nullable().optional(),
  sobre: z.string().max(4000).optional(),
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
  precoCentavos: z.number().int().nonnegative(),
  precoDeCentavos: z.number().int().nonnegative().optional(),
  descricaoCurta: z.string().max(300).optional(),
  descricao: z.string().max(8000).optional(),
  imagens: z.array(z.string().url()).max(10).optional(),
  destaque: z.boolean().optional(),
  ativo: z.boolean().optional(),
  disponibilidade: z.enum(["in_stock", "out_of_stock", "backorder"]).optional(),
  estoque: z.number().int().nonnegative().optional(),
  pesoKg: z.number().positive().optional(),
  alturaCm: z.number().positive().optional(),
  larguraCm: z.number().positive().optional(),
  comprimentoCm: z.number().positive().optional(),
  atributos: z.record(z.string(), z.unknown()).optional(),
  // Peças por moto (segmento motopecas). Vazio = universal.
  codigoOriginal: z.string().trim().max(60).nullable().optional(),
  codigosEquivalentes: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  compatibilidade: z
    .array(z.object({ marca: z.string().trim().min(1).max(40), modelo: z.string().trim().min(1).max(60), anoDe: z.number().int().min(1950).max(2100).optional(), anoAte: z.number().int().min(1950).max(2100).optional() }))
    .max(200)
    .optional(),
});

export type TenantEntrada = z.infer<typeof TenantEntradaSchema>;
export type ProdutoEntrada = z.infer<typeof ProdutoEntradaSchema>;
