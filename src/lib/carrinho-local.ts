export interface ItemCarrinhoLocal {
  id: string;
  slug: string;
  nome: string;
  precoCentavos: number;
  imagem?: string;
  quantidade: number;
}

/** Conserva quantidades existentes e usa o retrato mais recente da oferta. */
export function somarAoCarrinho(atual: ItemCarrinhoLocal[], item: Omit<ItemCarrinhoLocal, "quantidade">, quantidade: number): ItemCarrinhoLocal[] {
  const existente = atual.find(x => x.id === item.id);
  if (!existente) return [...atual, { ...item, quantidade }];
  return atual.map(x => x.id === item.id ? { ...item, quantidade: x.quantidade + quantidade } : x);
}
