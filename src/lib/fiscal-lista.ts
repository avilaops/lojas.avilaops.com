export type DocumentoDaListaFiscal = {
  id: string;
  chave: string | null;
  nsu: string;
  tipo: string;
  situacao: string;
  completoId?: string | null;
  recebidoEm: string;
};

function identidadeFiscal(documento: DocumentoDaListaFiscal) {
  if (documento.chave) return `chave:${documento.chave}`;
  if (documento.nsu) return `nsu:${documento.tipo}:${documento.nsu}`;
  return `id:${documento.id}`;
}

function prioridade(documento: DocumentoDaListaFiscal) {
  if (documento.situacao === "COMPLETA") return 3;
  if (documento.completoId) return 2;
  return 1;
}

export function deduplicarDocumentosFiscais<T extends DocumentoDaListaFiscal>(documentos: T[]) {
  const unicos = new Map<string, T>();

  for (const documento of documentos) {
    const identidade = identidadeFiscal(documento);
    const atual = unicos.get(identidade);
    if (!atual || prioridade(documento) > prioridade(atual)) {
      unicos.set(identidade, documento);
    }
  }

  return [...unicos.values()];
}
