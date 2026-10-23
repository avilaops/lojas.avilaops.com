import { z } from "zod";

export const AtorCotacaoSchema = z.object({ tipo: z.string().trim().min(1).max(40), id: z.string().trim().min(1).max(200).nullable().optional(), email: z.string().trim().email().nullable().optional() }).strict();
const Item = z.object({ produtoId: z.string().trim().min(1), varianteId: z.string().trim().min(1), quantidade: z.number().int().positive(), precoUnitarioCentavos: z.number().int().min(0).optional() }).strict();
const Anexo = z.object({ nome: z.string().trim().min(1).max(240), url: z.string().url().max(2_000), tipoMime: z.string().trim().min(1).max(160), tamanhoBytes: z.number().int().min(0).max(50_000_000) }).strict();
export const VersaoCotacaoSchema = z.object({
  itens: z.array(Item).min(1).max(500), descontoCentavos: z.number().int().min(0).optional(), freteCentavos: z.number().int().min(0).optional(),
  condicoes: z.record(z.unknown()).optional(), justificativa: z.string().trim().max(2_000).nullable().optional(), ator: AtorCotacaoSchema,
}).strict();
export const CriarCotacaoSchema = VersaoCotacaoSchema.extend({
  empresaId: z.string().trim().min(1), unidadeId: z.string().trim().min(1).nullable().optional(), compradorEmpresaId: z.string().trim().min(1).nullable().optional(),
  centroCustoId: z.string().trim().min(1).nullable().optional(), pedidoCompra: z.string().trim().max(160).nullable().optional(), responsavelEmail: z.string().trim().email(),
  validaAte: z.coerce.date(), anexos: z.array(Anexo).max(20).optional(),
}).strict();
export const AcaoSimplesCotacaoSchema = z.object({ ator: AtorCotacaoSchema, motivo: z.string().trim().max(2_000).optional() }).strict();
export const AprovarCotacaoSchema = z.object({ ator: AtorCotacaoSchema, aprovadorEmpresaId: z.string().trim().min(1) }).strict();
export const ConverterCotacaoSchema = z.object({ ator: AtorCotacaoSchema, chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
export const RecomprarCotacaoSchema = z.object({ ator: AtorCotacaoSchema, validaAte: z.coerce.date() }).strict();
