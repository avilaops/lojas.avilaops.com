import { z } from "zod";

const referencia = z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const texto = (max: number) => z.string().trim().min(1).max(max);
const centavos = z.number().int().safe().nonnegative();

const EnderecoEmpresaB2BSchema = z.object({
  tipo: texto(40),
  cep: z.string().transform((valor) => valor.replace(/\D/g, "")).pipe(z.string().length(8)),
  logradouro: texto(160),
  numero: texto(30),
  complemento: z.string().trim().max(100).nullish(),
  bairro: texto(100),
  cidade: texto(100),
  uf: z.string().trim().length(2).transform((valor) => valor.toUpperCase()),
  principal: z.boolean().optional(),
}).strict();
export const EntradaEmpresaB2BSchema = z.object({
  referencia,
  razaoSocial: texto(160),
  nomeFantasia: z.string().trim().max(160).nullish(),
  unidades: z.array(z.object({
    referencia,
    nome: texto(160),
    cnpj: z.string().min(14).max(18),
    inscricaoEstadual: z.string().trim().max(30).nullish(),
    enderecos: z.array(EnderecoEmpresaB2BSchema).max(20),
  }).strict()).min(1).max(100),
  contatos: z.array(z.object({
    tipo: texto(40),
    nome: texto(160),
    cargo: z.string().trim().max(100).nullish(),
    email: z.string().trim().email().max(254).nullish(),
    telefone: z.string().trim().max(30).nullish(),
    referenciaUnidade: referencia.nullish(),
    principal: z.boolean().optional(),
  }).strict()).max(200),
  centrosCusto: z.array(z.object({
    codigo: referencia,
    nome: texto(160),
    orcamentoMensalCentavos: centavos,
    ativo: z.boolean().optional(),
  }).strict()).max(500),
  compradores: z.array(z.object({
    nome: texto(160),
    email: z.string().trim().email().max(254),
    centrosCusto: z.array(referencia).max(500),
    autorizacoes: z.array(z.object({
      papel: z.enum(["ADMINISTRADOR", "COMPRADOR", "APROVADOR", "FINANCEIRO", "VENDEDOR"]),
      referenciaUnidade: referencia.nullable(),
      limiteAprovacaoCentavos: centavos.nullable(),
    }).strict()).min(1).max(500),
  }).strict()).max(1000),
}).strict();
