type DocumentoComSchema = { schema: string };

export function separarDocumentosFiscais<T extends DocumentoComSchema>(documentos: T[]) {
  return {
    notas: documentos.filter((documento) => /^(resNFe|procNFe)/i.test(documento.schema)),
    eventos: documentos.filter((documento) => /evento/i.test(documento.schema)),
    outros: documentos.filter((documento) => !/^(resNFe|procNFe)/i.test(documento.schema) && !/evento/i.test(documento.schema)),
  };
}
