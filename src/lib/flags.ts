import { LAYOUTS, lerTema, type TemaLoja } from "./tema";

/**
 * Bandeiras de vitrine. O modelo entra no contrato, mas fica fora do painel,
 * do conector e da loja publicada até a variável ligar. Desligada é o padrão:
 * loja que não escolheu o modelo não muda de cara.
 */
export function templateAtelieLigado(env: Record<string, string | undefined> = process.env): boolean {
  const valor = (env.LOJAS_TEMPLATE_ATELIE ?? "").trim().toLowerCase();
  return valor === "1" || valor === "true" || valor === "on";
}

/** O que o painel e o conector oferecem agora. */
export function layoutsOferecidos(env: Record<string, string | undefined> = process.env): typeof LAYOUTS {
  if (templateAtelieLigado(env)) return LAYOUTS;
  return LAYOUTS.filter((layout) => layout.valor !== "atelie");
}

/**
 * Recusa trocar o layout para Ateliê com a bandeira desligada. Loja que já
 * está nele continua podendo salvar o resto do tema: desligar a bandeira
 * esconde a vitrine, não trava o cadastro.
 */
export function recusarLayoutBloqueado(
  temaAtual: unknown,
  layoutNovo: string | undefined,
  ligado = templateAtelieLigado(),
): string | null {
  if (layoutNovo !== "atelie" || ligado) return null;
  if (lerTema(temaAtual).layout === "atelie") return null;
  return "O modelo Ateliê não está disponível.";
}

/** O layout que a loja publicada desenha. Ateliê desligado volta ao Clássico. */
export function temaNaVitrine(tema: TemaLoja, ligado = templateAtelieLigado()): TemaLoja {
  if (tema.layout !== "atelie" || ligado) return tema;
  return { ...tema, layout: "classico" };
}
