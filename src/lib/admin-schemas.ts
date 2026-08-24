import { z } from "zod";
import { TemaSchema } from "./tema";

/**
 * Contratos da API administrativa. É o que o formulário de onboarding do
 * portal e o fluxo n8n enviam. Tudo opcional além de slug e nome, de
 * propósito: a loja nasce com o mínimo e vai sendo completada.
 */

const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, "slug: letras minúsculas, números e hífen");
const digitos = (min: number, max: number) => z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(min).max(max));

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
  tema: TemaSchema.partial().optional(),
  slogan: z.string().max(140).optional(),
  sobre: z.string().max(4000).optional(),
  whatsapp: digitos(12, 13).optional(),
  telefone: z.string().max(30).optional(),
  emailContato: z.string().email().optional(),
  instagram: z.string().url().optional(),
  endereco: EnderecoSchema.optional(),
  horario: z.string().max(140).optional(),
  cepOrigem: digitos(8, 8).optional(),
  retiradaNaLoja: z.boolean().optional(),
  despachoDiasUteis: z.number().int().min(0).max(30).optional(),
  pesoPadraoKg: z.number().positive().max(100).optional(),
  tabelaFrete: z
    .array(z.object({ ufs: z.array(z.string()), preco: z.number().int().nonnegative(), prazoDiasUteis: z.number().int().positive(), nome: z.string().optional() }))
    .optional(),
  freteGratisAcima: z.number().int().nonnegative().nullable().optional(),
  meiosPagamento: z.array(z.enum(["pix", "cartao", "boleto"])).min(1).optional(),
  gtmId: z.string().regex(/^GTM-[A-Z0-9]+$/).optional(),
  /** Credenciais do Mercado Pago da loja. Só o access token é cifrado; a public key vai no HTML. */
  mercadoPago: z
    .object({ publicKey: z.string().min(10), accessToken: z.string().min(10), webhookSecret: z.string().min(10).optional() })
    .optional(),
});

export const TenantAtualizacaoSchema = TenantEntradaSchema.partial().extend({
  status: z.enum(["PROVISIONANDO", "ATIVA", "SUSPENSA", "CANCELADA"]).optional(),
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
});

export type TenantEntrada = z.infer<typeof TenantEntradaSchema>;
export type ProdutoEntrada = z.infer<typeof ProdutoEntradaSchema>;
