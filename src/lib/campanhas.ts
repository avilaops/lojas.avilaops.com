import type { TemaLoja } from "@/lib/tema";

/** Normaliza apenas campanhas com arte. A versão móvel vem do cadastro do tenant. */
export function campanhasDaLoja(tema: TemaLoja) {
  return (tema.campanhasHome ?? [])
    .filter((campanha) => campanha.imagemUrl)
    .map((campanha) => ({ ...campanha, imagemMobileUrl: campanha.imagemMobileUrl || "" }));
}
