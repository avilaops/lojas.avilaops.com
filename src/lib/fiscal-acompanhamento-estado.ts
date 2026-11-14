export const ROTULOS_RECEBIMENTO = {
  AGUARDANDO_MANIFESTACAO: "Aguardando manifestação",
  AGUARDANDO_RESULTADO: "Aguardando resultado da manifestação",
  AGUARDANDO_XML: "Aguardando XML completo",
  PRONTA: "Pronta para conferir",
  ENTRADA_REGISTRADA: "Entrada registrada",
  CANCELADA: "Nota cancelada",
  REVISAO_NECESSARIA: "Revisão necessária",
  GERENCIADA_ERP: "Conferência no ERP",
} as const;
export type EstadoRecebimentoFiscal = keyof typeof ROTULOS_RECEBIMENTO;
