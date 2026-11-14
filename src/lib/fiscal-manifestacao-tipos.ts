export const TIPOS_MANIFESTACAO = {
  CIENCIA: { codigo: "210210", descricao: "Ciencia da Operacao" },
  CONFIRMACAO: { codigo: "210200", descricao: "Confirmacao da Operacao" },
  DESCONHECIMENTO: { codigo: "210220", descricao: "Desconhecimento da Operacao" },
  NAO_REALIZADA: { codigo: "210240", descricao: "Operacao nao Realizada" },
} as const;
export type TipoManifestacao = keyof typeof TIPOS_MANIFESTACAO;
