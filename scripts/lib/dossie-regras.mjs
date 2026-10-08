/**
 * O que um item do dossiê de complemento de catálogo pode afirmar ao Merchant.
 *
 * O aplicador (`scripts/completar-catalogo-sem-foto.mjs`) confiava no que o
 * dossiê declarava. A revisão do PR #12 da Vedashow (07/10/2026) achou dois
 * caminhos em que a declaração contradizia a própria ressalva: GTIN da unidade
 * em blister em SKUs que o dossiê diz serem caixas, e foto de anúncio do
 * Mercado Livre marcada como própria. Estas regras são puras e valem para
 * qualquer loja; o teste está em `src/lib/dossie-regras.test.ts`.
 */

/**
 * Dúvida sobre o que a loja vende (unidade, caixa, metro, rolo). "Conferir na
 * caixa se há sufixo" não é isso: ali a caixa é fonte de leitura, não unidade.
 */
const DUVIDA_DE_UNIDADE = /caixas? com|caixa fechada|unidade de venda|por metro|rolo de \d|quantidade de rolos|quantidades diferentes/i;

const MARKETPLACES = ["mercadolivre.com", "magazineluiza.com", "amazon.com", "shopee.com", "americanas.com", "casasbahia.com"];

/** @param {{ duvidas?: string[] }} item */
export function duvidaDeUnidadeDeVenda(item) {
  return (item.duvidas ?? []).some((d) => typeof d === "string" && DUVIDA_DE_UNIDADE.test(d));
}

/**
 * GTIN e MPN identificam a unidade do fabricante. Com dúvida de unidade de
 * venda, só entram quando alguém confirmou (`unidadeVendaConfirmada: true`).
 * @param {{ duvidas?: string[]; unidadeVendaConfirmada?: boolean }} item
 */
export function identificadoresPermitidos(item) {
  return !duvidaDeUnidadeDeVenda(item) || item.unidadeVendaConfirmada === true;
}

/** @param {{ fontes?: Array<{ tipo?: string; url?: string }>; paginaDasFotos?: string | null; paginasDasFotos?: string[] }} item */
export function fonteSoDeMarketplace(item) {
  const fontes = item.fontes ?? [];
  const paginas = [item.paginaDasFotos, ...(item.paginasDasFotos ?? [])].filter((p) => typeof p === "string");
  const paginaDeMarketplace = paginas.some((p) => MARKETPLACES.some((m) => p.includes(m)));
  return (fontes.length > 0 && fontes.every((f) => f.tipo === "marketplace")) || paginaDeMarketplace;
}

/**
 * Foto como `propria` exige foto exata declarada (`fotoExata: true`) E fonte
 * que não seja só anúncio de terceiro, salvo `imagemLicenciada: true`.
 *
 * Ausência não é confirmação: o dossiê da Brilhax saiu sem o campo em 95
 * itens, e `!== false` deixava passar como própria a foto de varejista de um
 * item cuja apresentação o próprio dossiê manda conferir (revisão do PR #66).
 * @param {{ fotoExata?: boolean; imagemOrigem?: string | null; imagemLicenciada?: boolean } & Parameters<typeof fonteSoDeMarketplace>[0]} item
 */
export function fotoPodeSerPropria(item) {
  const exata = item.fotoExata === true && item.imagemOrigem !== "representativa";
  if (!exata) return false;
  return !fonteSoDeMarketplace(item) || item.imagemLicenciada === true;
}
