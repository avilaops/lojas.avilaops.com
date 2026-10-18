import { z } from "zod";

const referencia = z.string().trim().min(1).max(100);
const inteiroPositivo = (mensagem: string) => z.number({ invalid_type_error: mensagem }).int(mensagem).safe(mensagem).positive(mensagem);
const data = z.string().datetime({ message: "Informe uma data ISO válida." }).transform((valor) => new Date(valor));

const camposComuns = {
  produtoReferencia: referencia,
  varianteReferencia: referencia.nullable(),
  quantidadeMinima: inteiroPositivo("A quantidade mínima deve ser um inteiro positivo."),
  quantidadeMaxima: inteiroPositivo("A quantidade máxima deve ser um inteiro positivo.").nullable(),
  multiploVenda: inteiroPositivo("O múltiplo de venda deve ser um inteiro positivo."),
  quantidadePorEmbalagem: inteiroPositivo("A quantidade por embalagem deve ser um inteiro positivo."),
  unidadeComercial: z.string().trim().min(1).max(20),
  unidadesBaseNumerador: inteiroPositivo("A razão de unidades-base deve usar inteiros positivos."),
  unidadesBaseDenominador: inteiroPositivo("A razão de unidades-base deve usar inteiros positivos."),
  componentes: z.array(z.object({
    varianteReferencia: referencia,
    quantidadeBaseNumerador: inteiroPositivo("A razão do componente deve usar inteiros positivos."),
    quantidadeBaseDenominador: inteiroPositivo("A razão do componente deve usar inteiros positivos."),
  }).strict()).max(500),
};

const itemFixo = z.object({
  ...camposComuns,
  acao: z.literal("INCLUIR"),
  estrategiaPreco: z.literal("FIXO"),
  precoFixoCentavos: z.number().int().safe().nonnegative(),
  descontoPontosBase: z.never().optional(),
}).strict();

const itemDesconto = z.object({
  ...camposComuns,
  acao: z.literal("INCLUIR"),
  estrategiaPreco: z.literal("DESCONTO"),
  precoFixoCentavos: z.never().optional(),
  descontoPontosBase: z.number().int().min(0).max(10_000),
}).strict();

const itemExcluido = z.object({
  ...camposComuns,
  acao: z.literal("EXCLUIR"),
  estrategiaPreco: z.never({ invalid_type_error: "Uma exclusão não aceita estratégia de preço." }).optional(),
  precoFixoCentavos: z.never({ invalid_type_error: "Uma exclusão não aceita preço." }).optional(),
  descontoPontosBase: z.never({ invalid_type_error: "Uma exclusão não aceita preço." }).optional(),
}).strict();

const item = z.union([itemFixo, itemDesconto, itemExcluido], {
  errorMap: () => ({ message: "Informe exatamente uma estratégia de preço válida; uma exclusão não aceita preço." }),
}).superRefine((valor, contexto) => {
  if (valor.quantidadeMaxima !== null && valor.quantidadeMaxima < valor.quantidadeMinima) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: "A quantidade máxima deve ser maior ou igual à mínima.", path: ["quantidadeMaxima"] });
  }
});

export const EntradaCatalogoB2BSchema = z.object({
  referencia,
  nome: z.string().trim().min(1).max(160),
  versao: z.number().int().positive(),
  moeda: z.literal("BRL", { errorMap: () => ({ message: "A moeda aceita nesta versão é BRL." }) }),
  vigenteDesde: data,
  vigenteAte: data.nullable(),
  atribuicoes: z.array(z.object({
    empresaReferencia: referencia,
    unidadeReferencia: referencia.nullable(),
    prioridade: z.number().int().safe().nonnegative(),
  }).strict()).min(1).max(500),
  itens: z.array(item).min(1).max(10_000),
}).strict().superRefine((valor, contexto) => {
  if (valor.vigenteAte !== null && valor.vigenteAte.getTime() <= valor.vigenteDesde.getTime()) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: "A vigência final deve ser posterior à inicial.", path: ["vigenteAte"] });
  }
});

export type EntradaCatalogoB2B = z.infer<typeof EntradaCatalogoB2BSchema>;
