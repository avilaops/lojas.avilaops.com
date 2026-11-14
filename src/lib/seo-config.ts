import { z } from "zod";

const texto = (maximo: number) => z.string().trim().max(maximo)
  .refine(valor => !/[<>]/.test(valor), "Use texto sem marcação HTML.")
  .transform(valor => valor.replace(/\s+/gu, " "));

const campos = {
  tituloInicio: texto(120),
  descricaoInicio: texto(320),
  incluirDestaques: z.boolean(),
  limiteDestaques: z.number().int().min(1).max(20),
};

/** Entrada parcial: valores ausentes nunca apagam uma configuração salva. */
export const SeoConfiguracaoEntradaSchema = z.object(campos).partial().strict();

export type ConfiguracaoSeo = {
  tituloInicio: string;
  descricaoInicio: string;
  incluirDestaques: boolean;
  limiteDestaques: number;
};

export function lerConfiguracaoSeo(entrada: unknown): ConfiguracaoSeo {
  const dados = entrada && typeof entrada === "object" && !Array.isArray(entrada)
    ? entrada as Record<string, unknown> : {};
  return {
    tituloInicio: campos.tituloInicio.catch("").parse(dados.tituloInicio),
    descricaoInicio: campos.descricaoInicio.catch("").parse(dados.descricaoInicio),
    incluirDestaques: campos.incluirDestaques.catch(true).parse(dados.incluirDestaques),
    limiteDestaques: campos.limiteDestaques.catch(12).parse(dados.limiteDestaques),
  };
}

export function mesclarConfiguracaoSeo(atual: unknown, alteracoes: unknown): ConfiguracaoSeo {
  return { ...lerConfiguracaoSeo(atual), ...SeoConfiguracaoEntradaSchema.parse(alteracoes) };
}

export type MetadadosSeo = { titulo: string; descricao: string };

export function metadadosSeo(entrada: unknown, automaticos: MetadadosSeo): MetadadosSeo {
  const config = lerConfiguracaoSeo(entrada);
  return { titulo: config.tituloInicio || automaticos.titulo, descricao: config.descricaoInicio || automaticos.descricao };
}

export function opcoesResumoIa(entrada: unknown): { limiteDestaques: number } {
  const config = lerConfiguracaoSeo(entrada);
  return { limiteDestaques: config.incluirDestaques ? config.limiteDestaques : 0 };
}

export type OrientacaoSeo = { id: string; estado: "ok" | "atencao"; titulo: string; texto: string };

/** Orientações de redação, sem atribuir uma nota ou alegar indexação. */
export function orientacoesSeo(meta: MetadadosSeo): OrientacaoSeo[] {
  const titulo = Array.from(meta.titulo).length;
  const descricao = Array.from(meta.descricao).length;
  return [
    { id: "titulo", estado: titulo >= 10 && titulo <= 70 ? "ok" : "atencao", titulo: "Título da página inicial",
      texto: titulo < 10 ? "Acrescente o que a loja oferece para deixar o título mais descritivo." : titulo > 70 ? "Considere um título mais conciso. O espaço exibido varia conforme o dispositivo." : "O título tem espaço para identificar a loja e apresentar sua oferta." },
    { id: "descricao", estado: descricao >= 70 && descricao <= 180 ? "ok" : "atencao", titulo: "Descrição da página inicial",
      texto: descricao < 70 ? "Conte o que a pessoa encontra na loja e o que pode fazer ao visitá-la." : descricao > 180 ? "Considere resumir as informações principais. O buscador pode mostrar outro trecho da página." : "A descrição apresenta um resumo que pode ajudar a pessoa a decidir pela visita." },
  ];
}
