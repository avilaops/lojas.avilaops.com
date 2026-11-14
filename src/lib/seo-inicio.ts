import type { Tenant } from "@prisma/client";
import { listarCategorias } from "./catalogo";
import { temaNaVitrine } from "./flags";
import { identidadeDa, temaDo } from "./tenant";
import { descricaoDaLoja } from "./textos-loja";
import { descricaoDoCatalogo } from "./seo-texto";
import { lerConfiguracaoSeo, metadadosSeo } from "./seo-config";

/** Mesma fonte para a home publicada e a prévia do painel. */
export async function seoInicioDaLoja(t: Tenant) {
  let descricao = descricaoDoCatalogo(t.nome, descricaoDaLoja(t, identidadeDa(t).diferencial), "inicio");
  if (t.slug === "domi-rio") {
    descricao = "Domi-Rio Distribuidora: compare produtos para controle de pragas, odores e roedores. Confira apresentações, compre pelo site ou peça uma cotação para sua empresa.";
  } else if (temaNaVitrine(temaDo(t)).layout === "industrial") {
    const categorias = await listarCategorias(t.id);
    const familias = categorias.slice(0, 3).map(categoria => categoria.nome).join(", ");
    descricao = `${t.nome}: ${familias ? `catálogo de ${familias}. ` : "Catálogo de peças industriais. "}Busque por código ou medidas e confira a ficha técnica de cada produto.`;
  }
  const automaticos = { titulo: t.slogan ? `${t.nome} • ${t.slogan}` : t.nome, descricao };
  const configuracao = lerConfiguracaoSeo(t.configuracaoSeo);
  return { configuracao, automaticos, atuais: metadadosSeo(configuracao, automaticos) };
}
