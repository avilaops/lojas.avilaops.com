import type { TemaLoja } from "@/lib/tema";

/** Normaliza apenas campanhas com arte. A versão móvel vem do cadastro do tenant. */
export function campanhasDaLoja(tema: TemaLoja) {
  return (tema.campanhasHome ?? [])
    .filter((campanha) => campanha.imagemUrl)
    .map((campanha) => campanha.imagemUrl.endsWith("/campanha-geral-v2.webp")
      ? {
        ...campanha,
        imagemUrl: "/media/vedashow/campanha-geral-v3-desktop.svg",
        imagemMobileUrl: "/media/vedashow/campanha-geral-v3-mobile.svg",
        alt: "Retentores, O-rings e rolamentos para manutenção industrial. Peças certas para manter sua operação em movimento.",
      }
      : { ...campanha, imagemMobileUrl: campanha.imagemMobileUrl || "" });
}
