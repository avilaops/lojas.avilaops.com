"use client";

import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import Link from "@/components/LinkLoja";
import { useCart } from "@/components/cart/CartProvider";
import { LinkContatoMedido } from "@/components/EventoFunil";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { adicionarLinhaDomiRio, importarCarrinhoDomiRio, mensagemListaDomiRio, restaurarListaDomiRio, type LinhaCotacaoDomiRio, type OfertaCotacaoDomiRio } from "@/lib/domirio-cotacao";

const CHAVE = "loja:domi-rio:cotacao";
const rotulo = (o: OfertaCotacaoDomiRio) => `${o.nome}${o.apresentacao ? ` · ${o.apresentacao}` : ""}${o.sku ? ` · ${o.sku}` : ""}`;

export default function CotacaoLista({ ofertas, baseUrl, whatsapp, inicial }: { ofertas: OfertaCotacaoDomiRio[]; baseUrl: string; whatsapp: string | null; inicial?: string }) {
  const { itens, pronto: carrinhoPronto } = useCart();
  const [lista, setLista] = useState<LinhaCotacaoDomiRio[]>([]);
  const [pronto, setPronto] = useState(false);
  const [escolha, setEscolha] = useState(inicial ?? "");
  const [busca, setBusca] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [cep, setCep] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  /* eslint-disable react-hooks/set-state-in-effect -- restaura somente IDs públicos e quantidades do armazenamento externo */
  useEffect(() => {
    try { setLista(restaurarListaDomiRio(JSON.parse(localStorage.getItem(CHAVE) ?? "[]"), ofertas)); } catch { /* Storage indisponível: mantém a lista da sessão. */ }
    setPronto(true);
  }, [ofertas]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (pronto) { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* Lista disponível na sessão. */ } } }, [lista, pronto]);

  function adicionar(e: FormEvent) {
    e.preventDefault(); setErro(""); setAviso("");
    if (!ofertas.some(o => o.id === escolha)) { setErro("Escolha um produto e sua apresentação."); return; }
    try { setLista(adicionarLinhaDomiRio(lista, escolha, Number(quantidade))); setAviso("Produto adicionado à cotação."); } catch (e) { setErro(e instanceof Error ? e.message : "Revise a quantidade."); }
  }
  function importar() {
    setErro("");
    const importados = importarCarrinhoDomiRio(itens, ofertas);
    try {
      let nova = [...lista]; for (const i of importados) nova = adicionarLinhaDomiRio(nova, i.id, i.quantidade);
      setLista(nova); setAviso(`${importados.length} apresentações importadas do carrinho.${importados.length < itens.length ? " Alguns itens não estão mais disponíveis no catálogo; confira a lista." : ""}`);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível importar a lista."); }
  }
  let mensagem = ""; let erroMensagem = "";
  if (lista.length) { try { mensagem = mensagemListaDomiRio(lista, ofertas, baseUrl, cep); } catch (e) { erroMensagem = e instanceof Error ? e.message : "Revise a lista."; } }
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const filtradas = ofertas.filter(o => normalizar(rotulo(o)).includes(normalizar(busca)) || o.id === escolha);
  return <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-6"><form onSubmit={adicionar} className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6" aria-label="Adicionar à cotação">
      <h2 className="text-xl font-semibold">Escolha os produtos</h2>
      <label className="grid gap-2 text-sm font-medium">Buscar no catálogo<input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou código, como ISO015" className="min-h-11 min-w-0 rounded-lg border border-border bg-background p-3 text-base" /></label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">Produto e apresentação<select required value={escolha} onChange={e => setEscolha(e.target.value)} className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background p-3 text-base"><option value="" disabled>Selecione uma apresentação</option>{filtradas.map(o => <option key={o.id} value={o.id}>{rotulo(o)}{!o.disponivel ? " · consultar disponibilidade" : ""}</option>)}</select></label>
      {!filtradas.length && <p className="text-sm text-muted-foreground">Nenhum produto encontrado. Tente outro nome ou código.</p>}
      <div className="flex flex-wrap items-end gap-3"><label className="grid gap-2 text-sm font-medium">Quantidade<input type="number" required min={1} max={99999} step={1} value={quantidade} onChange={e => setQuantidade(e.target.value)} inputMode="numeric" className="min-h-11 w-32 rounded-lg border border-border bg-background p-3 text-base" /></label><button type="submit" disabled={!pronto || !escolha} className="btn-primario min-h-11"><Plus size={18} aria-hidden="true" />Adicionar à lista</button></div>
      {carrinhoPronto && itens.length > 0 && <button type="button" onClick={importar} disabled={!pronto} className="btn-secundario min-h-11">Importar produtos do carrinho</button>}
    </form>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}{aviso && <p role="status" className="text-sm text-primary">{aviso}</p>}
    <section aria-labelledby="lista-domirio" className="rounded-2xl border border-border bg-card p-5 sm:p-6"><h2 id="lista-domirio" className="text-xl font-semibold">Sua lista de cotação</h2>
      {!pronto ? <p className="mt-4 text-sm">Carregando sua lista…</p> : !lista.length ? <p className="mt-4 text-sm text-muted-foreground">Adicione o primeiro produto. Você pode reunir até 50 apresentações.</p> : <ul className="mt-4 divide-y divide-border">{lista.map(l => {
        const o = ofertas.find(o => o.id === l.id)!;
        return <li key={l.id} className="grid min-w-0 gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_100px_44px]"><div className="min-w-0"><Link href={`/produtos/${encodeURIComponent(o.slug)}${o.varianteId ? `?variante=${encodeURIComponent(o.varianteId)}` : ""}`} className="text-sm font-semibold hover:underline">{o.nome}</Link><p className="mt-1 text-xs text-muted-foreground">{[o.apresentacao, o.sku].filter(Boolean).join(" · ")}</p>{(!o.disponivel || (o.estoque !== null && l.quantidade > o.estoque)) && <p className="mt-2 text-xs text-amber-800">Quantidade ou disponibilidade a confirmar com o comercial.</p>}</div><label className="grid gap-1 text-xs">Quantidade<input type="number" min={1} max={99999} step={1} required value={l.quantidade} onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 1 && n <= 99999) setLista(lista.map(i => i.id === l.id ? { ...i, quantidade: n } : i)); }} className="min-h-11 w-24 rounded-lg border border-border bg-background p-2 text-base" /></label><button type="button" className="flex min-h-11 w-11 items-center justify-center rounded-lg border border-border" aria-label={`Remover ${o.nome} ${o.apresentacao ?? ""}`} onClick={() => { setLista(lista.filter(i => i.id !== l.id)); setAviso("Produto removido da cotação."); }}><Trash2 size={17} aria-hidden="true" /></button></li>;
      })}</ul>}
      <Link href="/produtos" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline">Continuar pesquisando produtos</Link>
    </section></div>
    <aside className="h-fit min-w-0 rounded-2xl border border-border bg-muted p-5 lg:sticky lg:top-28"><h2 className="text-xl font-semibold">Revise e fale com o comercial</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{lista.length} apresentações na lista. O comercial confirma os valores e as condições antes de você decidir.</p>
      <label className="mt-5 grid gap-2 text-sm font-medium">CEP para entrega (opcional)<input type="text" inputMode="numeric" autoComplete="postal-code" maxLength={9} value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" className="min-h-11 min-w-0 rounded-lg border border-border bg-card p-3 text-base" /></label>
      {erroMensagem && <p role="alert" className="mt-3 text-sm text-red-800">{erroMensagem}</p>}
      {mensagem && whatsapp ? <LinkContatoMedido href={linkWhatsApp(whatsapp, mensagem)} target="_blank" rel="noopener noreferrer" className="btn-primario mt-5 min-h-11 w-full"><MessageCircle size={18} aria-hidden="true" />Levar lista ao WhatsApp</LinkContatoMedido> : !whatsapp ? <Link href="/contato" className="btn-primario mt-5 w-full">Ver canais de atendimento</Link> : <button type="button" disabled className="btn-primario mt-5 w-full opacity-50">Adicione produtos para cotar</button>}
      {mensagem && <details className="mt-4 text-sm"><summary className="cursor-pointer py-2 font-medium">Conferir mensagem</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-card p-3 font-sans text-xs leading-relaxed">{mensagem}</pre></details>}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Você revisa e envia a mensagem no WhatsApp. A lista fica neste navegador; o CEP não é salvo. Cotar não reserva estoque nem cria um pedido.</p>
    </aside>
  </div>;
}
