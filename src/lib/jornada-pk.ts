import { listarEditorialPk } from "./pk-editorial";

export const ENTRADAS_PK = [
  { id: "codigo", titulo: "Tenho um código", detalhe: "Uma referência, código da peça ou identificação do equipamento.", proximo: "Comece pela referência", orientacao: "Busque o código no catálogo. Abra a ficha para conferir medidas, perfil e material antes de comparar.", href: "/produtos", acao: "Buscar meu código", numero: "01" },
  { id: "amostra", titulo: "Tenho a peça usada", detalhe: "Uma amostra e as medidas do alojamento para conferir.", proximo: "Transforme a amostra em medidas", orientacao: "Confira como registrar DI, DE, altura e seção. Desgaste e deformação podem alterar as medidas da peça usada.", href: "/guias/medir-vedacoes", acao: "Aprender a medir", numero: "02" },
  { id: "aplicacao", titulo: "Conheço a aplicação", detalhe: "O equipamento, a posição da peça e as condições de trabalho.", proximo: "Encontre o contexto do seu equipamento", orientacao: "Explore os segmentos e identifique a função: conter fluido, retirar sujeira ou orientar o movimento. Depois confira a referência.", href: "/aplicacoes", acao: "Explorar aplicações", numero: "03" },
] as const;

export const GRUPOS_SEGMENTOS_PK = [
  { id: "produzir", titulo: "Produzir", descricao: "Continuidade dos processos e manutenção dos acionamentos.", slugs: ["industria-hidraulica", "embalagens-processos"] },
  { id: "cultivar", titulo: "Cultivar", descricao: "Movimento e posicionamento dos equipamentos no campo.", slugs: ["agricultura", "florestal"] },
  { id: "construir", titulo: "Construir", descricao: "Acionamentos que trabalham em operações com carga e resíduos.", slugs: ["construcao", "mineracao"] },
  { id: "movimentar", titulo: "Movimentar", descricao: "Elevação, basculamento e movimentação de materiais.", slugs: ["transporte-implementos", "logistica-movimentacao"] },
  { id: "infraestrutura", titulo: "Sustentar a infraestrutura", descricao: "Acionamentos auxiliares de energia, saneamento e infraestrutura.", slugs: ["energia", "saneamento"] },
] as const;

export function gruposSegmentosPk(tenantSlug: string) {
  const itens = listarEditorialPk(tenantSlug, "aplicacoes");
  if (!itens.length) return [];
  return GRUPOS_SEGMENTOS_PK.map(grupo => ({ ...grupo, itens: grupo.slugs.flatMap(slug => {
    const item = itens.find(candidato => candidato.slug === slug);
    return item ? [item] : [];
  }) }));
}
