type DocumentoComSchema = { schema: string };

export function separarDocumentosFiscais<T extends DocumentoComSchema>(documentos: T[]) {
  return {
    notas: documentos.filter((documento) => /^(resNFe|procNFe)/i.test(documento.schema)),
    eventos: documentos.filter((documento) => /evento/i.test(documento.schema)),
    outros: documentos.filter((documento) => !/^(resNFe|procNFe)/i.test(documento.schema) && !/evento/i.test(documento.schema)),
  };
}

export function totalizarDocumentosFiscais(contagens: Array<{ schema: string; quantidade: number }>) {
  const totais = { documentos: 0, notas: 0, eventos: 0, outros: 0 };
  for (const contagem of contagens) {
    totais.documentos += contagem.quantidade;
    if (/^(resNFe|procNFe)/i.test(contagem.schema)) totais.notas += contagem.quantidade;
    else if (/evento/i.test(contagem.schema)) totais.eventos += contagem.quantidade;
    else totais.outros += contagem.quantidade;
  }
  return totais;
}
