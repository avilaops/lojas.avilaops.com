/** A mesma versão vale para o bootstrap em linha e para a decisão no React. */
export const VERSAO = 1;
export const CHAVE = "loja_consentimento";
/** O CSS esconde o aviso respondido antes da hidratação. */
export const ATRIBUTO_RESPONDIDO = "data-cookies-respondido";

/** Valores antigos continuam válidos na versão 1; os novos separam as finalidades. */
export type Escolha = "aceito" | "essencial" | "medicao" | "publicidade";
export function escolhaValida(valor: unknown): valor is Escolha {
  return valor === "aceito" || valor === "essencial" || valor === "medicao" || valor === "publicidade";
}
export function permissoesDaEscolha(escolha: Escolha | null | undefined) {
  return { medicao: escolha === "aceito" || escolha === "medicao", publicidade: escolha === "aceito" || escolha === "publicidade" };
}
export function escolhaDasPermissoes(medicao: boolean, publicidade: boolean): Escolha {
  return medicao ? publicidade ? "aceito" : "medicao" : publicidade ? "publicidade" : "essencial";
}
export function consentimentoGoogle(escolha: Escolha | null | undefined) {
  const { medicao, publicidade } = permissoesDaEscolha(escolha);
  return {
    analytics_storage: medicao ? "granted" : "denied",
    ad_storage: publicidade ? "granted" : "denied",
    ad_user_data: publicidade ? "granted" : "denied",
    ad_personalization: publicidade ? "granted" : "denied",
  };
}
