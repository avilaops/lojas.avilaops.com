import { z } from "zod";

export const VERSAO_CONFIGURADOR_SOB_MEDIDA = 1;
export const LIMITES_EDITOR_SOB_MEDIDA = { dimensaoMinimaCm: 20, dimensaoMaximaCm: 300, quantidadeMaxima: 100, divisoriasMaximas: 10 } as const;

export const OPCOES_CONFIGURADOR = {
  materialExterno: {
    aco_galvanizado: "Aço galvanizado",
    aco_pintado: "Aço pintado",
    aco_inoxidavel: "Aço inoxidável",
    aluminio: "Alumínio",
  },
  acabamento: {
    natural: "Natural",
    pintura_eletrostatica: "Pintura eletrostática",
    escovado: "Escovado",
  },
  tampa: {
    superior: "Tampa superior",
    frontal: "Porta frontal",
    dupla: "Tampa dupla",
  },
  mobilidade: {
    pes: "Pés fixos",
    rodizios: "Rodízios",
    sem_base: "Sem base elevada",
  },
} as const;

const texto = (maximo: number) => z.string().trim().max(maximo);
const numeroInteiro = (minimo: number, maximo: number) => z.coerce.number().int().min(minimo).max(maximo);
const chaves = <T extends Record<string, string>>(opcoes: T) => Object.keys(opcoes) as [keyof T & string, ...(keyof T & string)[]];

export const ConfiguracaoSobMedidaSchema = z.object({
  dimensoes: z.object({
    larguraCm: numeroInteiro(LIMITES_EDITOR_SOB_MEDIDA.dimensaoMinimaCm, LIMITES_EDITOR_SOB_MEDIDA.dimensaoMaximaCm),
    alturaCm: numeroInteiro(LIMITES_EDITOR_SOB_MEDIDA.dimensaoMinimaCm, LIMITES_EDITOR_SOB_MEDIDA.dimensaoMaximaCm),
    profundidadeCm: numeroInteiro(LIMITES_EDITOR_SOB_MEDIDA.dimensaoMinimaCm, LIMITES_EDITOR_SOB_MEDIDA.dimensaoMaximaCm),
  }),
  materialExterno: z.enum(chaves(OPCOES_CONFIGURADOR.materialExterno)),
  acabamento: z.enum(chaves(OPCOES_CONFIGURADOR.acabamento)),
  tampa: z.enum(chaves(OPCOES_CONFIGURADOR.tampa)),
  mobilidade: z.enum(chaves(OPCOES_CONFIGURADOR.mobilidade)),
  divisorias: numeroInteiro(0, LIMITES_EDITOR_SOB_MEDIDA.divisoriasMaximas),
  quantidade: numeroInteiro(1, LIMITES_EDITOR_SOB_MEDIDA.quantidadeMaxima),
  observacoes: texto(1_000).default(""),
});

const emailOpcional = texto(160).transform((valor) => valor.toLowerCase()).refine((valor) => !valor || z.string().email().safeParse(valor).success, "E-mail inválido.");
const telefoneOpcional = texto(24).refine((valor) => !valor || /^\d{10,15}$/.test(valor.replace(/\D/g, "")), "Telefone inválido.");

export const EntradaSolicitacaoSobMedidaSchema = z.object({
  configuracao: ConfiguracaoSobMedidaSchema,
  nome: texto(120).min(2),
  email: emailOpcional.default(""),
  telefone: telefoneOpcional.default(""),
  consentimento: z.literal(true),
  codigoRetomadaOrigem: texto(80).optional(),
}).superRefine((entrada, contexto) => {
  if (!entrada.email && !entrada.telefone) contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Informe e-mail ou telefone." });
});

export type ConfiguracaoSobMedida = z.infer<typeof ConfiguracaoSobMedidaSchema>;
export type EntradaSolicitacaoSobMedida = z.infer<typeof EntradaSolicitacaoSobMedidaSchema>;

export function resumoDaConfiguracao(configuracao: ConfiguracaoSobMedida): string {
  const { larguraCm, alturaCm, profundidadeCm } = configuracao.dimensoes;
  const divisorias = configuracao.divisorias === 1 ? "1 divisória" : `${configuracao.divisorias} divisórias`;
  const unidades = configuracao.quantidade === 1 ? "1 unidade" : `${configuracao.quantidade} unidades`;
  return [
    `${larguraCm} × ${alturaCm} × ${profundidadeCm} cm`,
    OPCOES_CONFIGURADOR.materialExterno[configuracao.materialExterno],
    OPCOES_CONFIGURADOR.acabamento[configuracao.acabamento],
    OPCOES_CONFIGURADOR.tampa[configuracao.tampa],
    divisorias,
    OPCOES_CONFIGURADOR.mobilidade[configuracao.mobilidade],
    unidades,
  ].join(" · ");
}
