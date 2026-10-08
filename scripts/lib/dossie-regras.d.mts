export interface ItemDossie {
  duvidas?: string[];
  unidadeVendaConfirmada?: boolean;
  fontes?: Array<{ tipo?: string; url?: string }>;
  paginaDasFotos?: string | null;
  paginasDasFotos?: string[];
  fotoExata?: boolean;
  imagemOrigem?: string | null;
  imagemLicenciada?: boolean;
}
export function duvidaDeUnidadeDeVenda(item: ItemDossie): boolean;
export function identificadoresPermitidos(item: ItemDossie): boolean;
export function fonteSoDeMarketplace(item: ItemDossie): boolean;
export function fotoPodeSerPropria(item: ItemDossie): boolean;
