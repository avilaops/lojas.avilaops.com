import type { TemaLoja } from "@/lib/tema";

const IMAGENS_MOVEIS: Record<string, string> = {
  "/media/vedashow/campanha-geral-v2.webp": "/media/vedashow/campanha-geral-mobile-v1.webp",
  "/media/vedashow/campanha-orings-v1.webp": "/media/vedashow/campanha-orings-mobile-v1.webp",
  "/media/vedashow/campanha-rolamentos-v1.webp": "/media/vedashow/campanha-rolamentos-mobile-v1.webp",
};

/** Mantém as artes específicas do celular junto da arte desktop cadastrada. */
export function campanhasDaLoja(tema: TemaLoja) {
  return (tema.campanhasHome ?? [])
    .filter((campanha) => campanha.imagemUrl)
    .map((campanha) => ({
      ...campanha,
      imagemMobileUrl: campanha.imagemMobileUrl || mobileDaUrl(campanha.imagemUrl) || "",
    }));
}

function mobileDaUrl(imagemUrl: string): string | undefined {
  if (imagemUrl.startsWith("/")) return IMAGENS_MOVEIS[imagemUrl];
  try {
    const url = new URL(imagemUrl);
    if (url.hostname !== "vedashow.com.br" && url.hostname !== "www.vedashow.com.br") return undefined;
    return IMAGENS_MOVEIS[url.pathname];
  } catch {
    return undefined;
  }
}
