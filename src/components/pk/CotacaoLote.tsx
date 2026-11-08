"use client";

import { useState } from "react";
import Link from "@/components/LinkLoja";
import { csvCotacao, lerListaCotacao, LIMITES_COTACAO, mensagemCotacao, ROTULOS_COTACAO, type ResultadoCotacao } from "@/lib/pk-cotacao-lote";

export default function CotacaoLote({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<ResultadoCotacao[] | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [consultadoEm, setConsultadoEm] = useState("");
  const alterar = (valor: string) => { setTexto(valor); setResultado(null); setErro(""); };

  async function consultar(event: React.FormEvent) {
    event.preventDefault();
    setErro(""); setResultado(null);
    try {
      const itens = lerListaCotacao(texto);
      setOcupado(true);
      const resposta = await fetch("/api/pk/cotacao-lote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens }), cache: "no-store" });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não foi possível consultar agora.");
      setResultado(dados.itens); setConsultadoEm(dados.consultadoEm);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível consultar agora."); }
    finally { setOcupado(false); }
  }

  function exportar() {
    if (!resultado) return;
    const url = URL.createObjectURL(new Blob([csvCotacao(resultado)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "cotacao-pk.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="mt-8 space-y-6">
    <form onSubmit={consultar} className="space-y-4 rounded-xl border p-5">
      <label htmlFor="lista-cotacao" className="block font-semibold">Cole os códigos e as quantidades</label>
      <p id="ajuda-cotacao" className="text-sm text-muted-foreground">Uma linha por item: código;quantidade. CSV com ; ou vírgula, aspas e cabeçalho código;quantidade opcional. Até 100 itens, arquivo de 32 KB e 10.000 unidades por item. Use códigos cadastrados; medidas ou descrições livres não identificam uma peça.</p>
      <textarea id="lista-cotacao" aria-describedby="ajuda-cotacao" value={texto} onChange={e => alterar(e.target.value)} rows={8} maxLength={LIMITES_COTACAO.bytes} placeholder={'código;quantidade\nSEU-CODIGO;10'} className="w-full rounded-lg border bg-background p-3 font-mono text-sm" disabled={ocupado} />
      <label className="block text-sm">Importar arquivo CSV<input type="file" accept=".csv,text/csv" disabled={ocupado} className="mt-2 block w-full" onChange={async e => {
        const arquivo = e.target.files?.[0]; e.target.value = "";
        if (!arquivo) return;
        if (arquivo.size > LIMITES_COTACAO.bytes) { setResultado(null); setErro("O arquivo deve ter até 32 KB."); return; }
        try { alterar(await arquivo.text()); } catch { setErro("Não foi possível ler o arquivo."); }
      }} /></label>
      <p className="text-sm text-muted-foreground">Informe apenas códigos e quantidades. A consulta não cria pedido e não pede dados pessoais.</p>
      <button disabled={ocupado} className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{ocupado ? "Consultando catálogo…" : "Conferir lista"}</button>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    </form>
    <div aria-live="polite" aria-busy={ocupado}>
      {resultado && <div className="space-y-4">
        <h2 className="text-xl font-bold">Revise sua cotação</h2>
        <p className="text-sm text-muted-foreground">Consulta em {new Date(consultadoEm).toLocaleString("pt-BR")}. Valores e disponibilidade sujeitos à confirmação. Para corrigir código ou quantidade, edite a lista acima e confira novamente. Códigos com mais de um resultado precisam de confirmação; nenhuma peça foi escolhida automaticamente.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Resultados por código e quantidade solicitada</caption><thead><tr className="border-b"><th className="p-3">Código / quantidade</th><th className="p-3">Situação</th><th className="p-3">Produto / preço unitário atual</th></tr></thead><tbody>{resultado.map((item, i) => <tr key={i} className="border-b align-top"><td className="p-3 break-all">{item.codigo}<br />{item.quantidade} unidades</td><td className="p-3">{ROTULOS_COTACAO[item.estado]}{item.quantidadeAConfirmar && <p>Quantidade solicitada acima do saldo: confirmar disponibilidade.</p>}</td><td className="p-3">{item.produtos.map(p => <div key={p.slug} className="mb-2"><Link className="underline" href={`/produtos/${encodeURIComponent(p.slug)}`}>{p.nome}</Link>{p.codigo && <span> · {p.codigo}</span>}<p>{p.precoCentavos !== null ? (p.precoCentavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Preço sob consulta"}</p></div>)}{!item.produtos.length && "Confira a grafia do código ou consulte o atendimento."}</td></tr>)}</tbody></table></div>
        <p className="text-sm">Confira material, perfil, medidas e aplicação na ficha do produto. Referência cruzada não comprova intercambiabilidade.</p>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={exportar} className="rounded-lg border px-4 py-3">Exportar conferência em CSV</button>{whatsappUrl ? <a href={`${whatsappUrl}?text=${encodeURIComponent(mensagemCotacao(resultado))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground">Levar lista ao WhatsApp</a> : <Link href="/contato" className="underline">Ver canais de atendimento</Link>}</div>
        <p className="text-sm text-muted-foreground">O WhatsApp abre somente ao clicar. A mensagem inclui os códigos, quantidades e pendências; o envio é confirmado por você no aplicativo.</p>
      </div>}
    </div>
  </section>;
}
