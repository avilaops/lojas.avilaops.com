import { z } from "zod";
import { CODIGOS_DE_ERRO, type CodigoDeErro } from "./api-resposta";

/** Mesma validação da API v1; trim acontece antes dos limites. */
export const ConsultaDeCupom = z.object({
  codigo: z.string().trim().min(1).max(40),
  itens: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    quantidade: z.number().int().min(1).max(999),
  }).strict()).min(1).max(50),
  // O formato específico do CEP continua sendo responsabilidade da cotação.
  cep: z.string().trim().min(8, "CEP com 8 dígitos").max(9).optional(),
}).strict();

export const RespostaDeCupom = z.object({
  dados: z.object({
    codigo: z.string(),
    tipo: z.string(),
    descontoCentavos: z.number().int().min(0),
    fretes: z.array(z.object({
      id: z.string(), nome: z.string(),
      precoCentavos: z.number().int().min(0),
      prazoDiasUteis: z.number().int().min(0),
    }).passthrough()).optional(),
  }).passthrough(),
}).passthrough();

export const ErroDeCupom = z.object({
  erro: z.object({
    codigo: z.enum(Object.keys(CODIGOS_DE_ERRO) as [CodigoDeErro, ...CodigoDeErro[]]),
    mensagem: z.string(), detalhe: z.string().optional(),
  }).passthrough(),
  requisicao: z.string().min(1),
}).passthrough();

/** Compartilhado com a rota e com o contrato exportado; não autentica sozinho. */
export const OpcoesDaConsultaDeCupom = {
  escopo: "vitrine:comprar", navegador: true,
  escrita: { exigeOrigem: true, porEnderecoPorMinuto: 10 },
} as const;
