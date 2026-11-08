import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CabecalhoSecao from "@/components/painel/CabecalhoSecao";
import { lojistaAtual } from "@/lib/sessao";
import { relatorioDemandasPk } from "@/lib/pk-demanda-consulta";

export const metadata: Metadata = { title: "Demandas de busca PK", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BuscasPkPage() {
  const loja = await lojistaAtual();
  if (!loja) return null;
  if (loja.slug !== "pkvedacoes") notFound();
  const demandas = await relatorioDemandasPk(loja);
  return <><CabecalhoSecao titulo="Buscas técnicas sem resultado" descricao="Até 50 demandas mais frequentes nos últimos 30 dias"/><section className="an-bloco"><p>Contagens agregadas por dia, sem visitantes identificados. Somente consultas técnicas permitidas, com consentimento e ausência de resultado confirmada no catálogo, entram no relatório. A retenção é de 90 dias.</p>{demandas.length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th scope="col">Consulta</th><th scope="col">Tipo</th><th scope="col">Ocorrências</th><th scope="col">Próximo passo</th></tr></thead><tbody>{demandas.map(d => <tr key={`${d.tipo}:${d.consulta}`}><th scope="row">{d.consulta}</th><td>{d.tipo === "codigo" ? "Código" : d.tipo === "medidas" ? "Medidas" : "Família / material"}</td><td>{(d._sum.ocorrencias ?? 0).toLocaleString("pt-BR")}</td><td><Link href="/painel/produtos" className="underline">{d.tipo === "medidas" ? "Conferir medidas cadastradas" : "Revisar cadastro e referências"}</Link></td></tr>)}</tbody></table></div> : <div className="an-vazio"><h2>Nenhuma demanda técnica medida nos últimos 30 dias.</h2><p>O relatório será preenchido após buscas sem resultado que atendam aos critérios de consentimento e normalização.</p></div>}<p className="mt-4 text-sm">Frequência não representa compradores únicos nem comprova demanda de compra. Confira disponibilidade, nomenclatura e medidas antes de ampliar o catálogo.</p></section></>;
}
