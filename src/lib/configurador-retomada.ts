export interface ArmazenamentoRetomada {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

const FORMATO_CODIGO = /^CFG-[A-Z0-9]{12}\.[A-Za-z0-9_-]{22}$/;

function chaveDoTenant(slug: string): string {
  return `loja:${slug}:configurador:retomada`;
}

export function lerUltimoCodigoRetomada(slug: string, armazenamento: ArmazenamentoRetomada): string | null {
  try {
    const codigo = armazenamento.getItem(chaveDoTenant(slug));
    return codigo && FORMATO_CODIGO.test(codigo) ? codigo : null;
  } catch {
    return null;
  }
}

export function salvarUltimoCodigoRetomada(slug: string, codigo: string, armazenamento: ArmazenamentoRetomada): boolean {
  if (!FORMATO_CODIGO.test(codigo)) return false;
  try {
    armazenamento.setItem(chaveDoTenant(slug), codigo);
    return true;
  } catch {
    return false;
  }
}
