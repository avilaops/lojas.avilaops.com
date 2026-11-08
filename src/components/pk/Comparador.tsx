"use client";

import Link from "@/components/LinkLoja";
import { useEffect, useState } from "react";
import { chaveComparacaoPk, eventoComparacaoPk, lerSelecaoPk, TENANT_PK } from "@/lib/pk-produtos";
import { CompararProduto } from "./CompararProduto";

export interface ProdutoComparavelPk { slug: string; nome: string; medidas: string; material: string; perfil: string; aplicacao: string }

export function Comparador({ tenantSlug, produtos }: { tenantSlug: string; produtos: ProdutoComparavelPk[] }) {
  const [selecao, setSelecao] = useState<string[]>([]);
  useEffect(() => {
    const atualizar = () => { try { setSelecao(lerSelecaoPk(sessionStorage.getItem(chaveComparacaoPk))); } catch { setSelecao([]); } };
    atualizar(); window.addEventListener(eventoComparacaoPk, atualizar);
    return () => window.removeEventListener(eventoComparacaoPk, atualizar);
  }, []);
  if (tenantSlug !== TENANT_PK) return null;
  const href = `/comparar${selecao.length ? `?${new URLSearchParams(selecao.map(s => ["produto", s])).toString()}` : ""}`;
  return <div className="space-y-6"><p>Selecione até 3 produtos nas fichas ou no catálogo. A seleção fica salva nesta sessão do navegador.</p><div className="flex flex-wrap items-center gap-3"><span role="status">{selecao.length} de 3 selecionados</span><Link href={href} className="rounded-lg border px-4 py-2 font-semibold">Atualizar comparação com a seleção</Link><button type="button" className="rounded-lg border px-4 py-2" onClick={() => { try { sessionStorage.removeItem(chaveComparacaoPk); window.dispatchEvent(new Event(eventoComparacaoPk)); } catch { setSelecao([]); } }}>Limpar seleção</button></div>{produtos.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse text-left"><caption className="sr-only">Comparação dos dados cadastrados de produtos PK</caption><thead><tr><th scope="col" className="border p-3">Característica</th>{produtos.map(p => <th scope="col" key={p.slug} className="border p-3"><Link href={`/produtos/${p.slug}`} className="underline">{p.nome}</Link></th>)}</tr></thead><tbody>{([ ["Medidas", "medidas"], ["Material", "material"], ["Perfil", "perfil"], ["Aplicação cadastrada", "aplicacao"] ] as const).map(([titulo, campo]) => <tr key={campo}><th scope="row" className="border p-3">{titulo}</th>{produtos.map(p => <td key={p.slug} className="border p-3">{p[campo]}</td>)}</tr>)}<tr><th scope="row" className="border p-3">Seleção</th>{produtos.map(p => <td key={p.slug} className="border p-3"><CompararProduto tenantSlug={tenantSlug} slug={p.slug} nome={p.nome}/></td>)}</tr></tbody></table></div> : <p>Nenhum produto público foi carregado. Adicione produtos à seleção e atualize a comparação.</p>}<p className="text-sm text-gray-600">Dados iguais não comprovam intercambiabilidade. Confirme perfil, material, alojamento e condições de trabalho antes da compra.</p><Link href="/produtos" className="underline">Escolher produtos no catálogo</Link></div>;
}
