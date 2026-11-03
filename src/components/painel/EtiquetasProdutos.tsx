"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_ETIQUETAS, quantidadeValida, type ItemEtiqueta, type TipoCodigoEtiqueta } from "@/lib/etiquetas";
import { inputClasse } from "./campos";
import "./etiquetas.css";

type Resposta = { itens: ItemEtiqueta[]; total: number; pagina: number; paginas: number };
type Selecionada = { item: ItemEtiqueta; quantidade: number };
const brl = (valor: number) => (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Etiqueta({ item, preco }: { item: ItemEtiqueta; preco: boolean }) {
  const interno = item.codigo!.startsWith("V:");
  const largura = interno ? 94 : item.codigo!.length === 8 ? 30 : item.codigo!.length === 14 ? 85 : 40;
  return <article className="etiqueta-produto">
    <strong className="etiqueta-nome">{item.nome}</strong>
    <span className="etiqueta-variacao">{[item.variacao, item.sku ? `SKU ${item.sku}` : null].filter(Boolean).join(" · ")}</span>
    {/* SVG produzido no servidor pela biblioteca; img isola o documento da página. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="etiqueta-barras" style={{ width: `${largura}mm`, height: interno ? "20mm" : "25mm" }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg!)}`} alt={`Código de barras ${item.codigo}`} />
    <span className="etiqueta-codigo">{item.codigo}</span>
    {preco && <strong>{item.precoCentavos ? brl(item.precoCentavos) : "Sob consulta"}</strong>}
  </article>;
}

export default function EtiquetasProdutos({ produtoId }: { produtoId?: string }) {
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState({ q: "", pagina: 1, tentativa: 0 });
  const [tipo, setTipo] = useState<TipoCodigoEtiqueta>("interno");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [selecionadas, setSelecionadas] = useState<Record<string, Selecionada>>({});
  const [preco, setPreco] = useState(false);
  const [papel, setPapel] = useState<"a4" | "termica">("a4");
  const [impressao, setImpressao] = useState(false);
  const areaImpressao = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: consulta.q, pagina: String(consulta.pagina), tipo });
    if (produtoId) params.set("produtoId", produtoId);
    fetch(`/api/painel/etiquetas?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar as etiquetas.");
        if (!controller.signal.aborted) setDados(d);
      })
      .catch(e => { if (!controller.signal.aborted) setErro(e instanceof Error ? e.message : "Falha ao carregar etiquetas."); })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [consulta, produtoId, tipo]);

  useEffect(() => {
    if (!impressao) return;
    let cancelada = false;
    const finalizar = () => setImpressao(false);
    window.addEventListener("afterprint", finalizar);
    const imagens = Array.from(areaImpressao.current?.querySelectorAll("img") ?? []);
    Promise.all(imagens.map(img => img.decode())).then(() => {
      if (!cancelada) window.print();
    }).catch(() => {
      if (!cancelada) { setErro("Falha ao preparar as barras para impressão. Tente novamente."); setImpressao(false); }
    });
    return () => { cancelada = true; window.removeEventListener("afterprint", finalizar); };
  }, [impressao]);

  const lista = Object.values(selecionadas);
  const total = lista.reduce((soma, s) => soma + s.quantidade, 0);
  const podeImprimir = lista.length > 0 && lista.every(s => quantidadeValida(s.quantidade)) && total <= MAX_ETIQUETAS;

  function carregar(q: string, pagina = 1) {
    setCarregando(true); setErro(""); setDados(null);
    setConsulta(c => ({ q, pagina, tentativa: c.tentativa + 1 }));
  }

  function selecionar(item: ItemEtiqueta, marcada: boolean) {
    setSelecionadas(anteriores => {
      const novas = { ...anteriores };
      if (marcada) novas[item.id] = { item, quantidade: 1 };
      else delete novas[item.id];
      return novas;
    });
  }

  return <div className="grid min-w-0 gap-5">
    <Link className="text-sm underline" href={produtoId ? `/painel/produtos/${produtoId}` : "/painel/produtos"}>Voltar aos produtos</Link>
    <p className="text-sm text-muted-foreground">Selecione produtos ou variações, escolha as quantidades e imprima. Para localizar um item, use o leitor no campo de busca e pressione Enter.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); carregar(texto.trim()); }}>
      <label className="grid min-w-0 basis-full gap-1 text-sm sm:flex-1">Nome, SKU ou código de barras
        <input className={inputClasse} value={texto} onChange={e => setTexto(e.target.value)} maxLength={100} autoComplete="off" placeholder="Digite ou escaneie o código" />
      </label>
      <button className="btn-secundario" type="submit" disabled={carregando}>Buscar</button>
      <label className="grid gap-1 text-sm">Código da etiqueta
        <select className={inputClasse} value={tipo} onChange={e => {
          setTipo(e.target.value as TipoCodigoEtiqueta); setSelecionadas({}); carregar(consulta.q);
        }}>
          <option value="interno">Código interno da loja</option>
          <option value="gtin">GTIN do fabricante</option>
        </select>
      </label>
    </form>
    <p className="text-sm text-muted-foreground">{tipo === "interno" ? "O código interno identifica esta variação no Lojas e permanece igual quando nome ou preço mudam. Não substitui o GTIN comercial." : "Usa o GTIN já cadastrado, sem criar numeração comercial. A validação de dígitos não comprova o registro na GS1. Corrija códigos ausentes, inválidos ou repetidos antes de imprimir."}</p>
    {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{erro}</p>}
    {carregando && <p role="status">Carregando produtos…</p>}
    {dados && <>
      <p role="status" className="text-sm">{dados.total} itens encontrados. {dados.total > 1 && consulta.q && "Confira a variação antes de selecionar."}</p>
      <div className="grid gap-2">
        {dados.itens.map(item => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
          <label className="flex min-w-0 flex-1 items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={Boolean(item.erro)} checked={Boolean(selecionadas[item.id])} onChange={e => selecionar(item, e.target.checked)} />
            <span className="min-w-0 break-words"><strong>{item.nome}</strong>{item.variacao && <span className="block">{item.variacao}</span>}<span className="block text-sm text-muted-foreground">{item.sku ? `SKU ${item.sku} · ` : ""}{item.codigo}</span>{item.erro && <span className="block text-sm text-red-800">{item.erro}</span>}</span>
          </label>
          <Link className="text-sm underline" href={`/painel/produtos/${item.produtoId}`}>Abrir produto</Link>
        </div>)}
      </div>
      {!dados.total && <p>Nenhum item ativo encontrado nesta loja. Confira o código ou altere a busca.</p>}
      <nav aria-label="Páginas de etiquetas" className="flex items-center gap-3">
        <button className="btn-secundario" disabled={consulta.pagina <= 1} onClick={() => carregar(consulta.q, consulta.pagina - 1)}>Anterior</button>
        <span>{dados.pagina} / {dados.paginas}</span>
        <button className="btn-secundario" disabled={consulta.pagina >= dados.paginas} onClick={() => carregar(consulta.q, consulta.pagina + 1)}>Próxima</button>
      </nav>
    </>}
    <section className="grid gap-4 rounded-xl border border-border p-4" aria-label="Etiquetas selecionadas">
      <h2 className="font-semibold">Etiquetas selecionadas ({lista.length} itens)</h2>
      {lista.map(({ item, quantidade }) => <div key={item.id} className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 break-words">{item.nome}{item.variacao ? ` · ${item.variacao}` : ""}</span>
        <label className="grid gap-1 text-sm">Quantidade
          <input aria-label={`Quantidade de ${item.nome}${item.variacao ? ` ${item.variacao}` : ""}`} className={`${inputClasse} w-24`} type="number" min={1} max={MAX_ETIQUETAS} step={1} value={Number.isNaN(quantidade) ? "" : quantidade} onChange={e => setSelecionadas(s => ({ ...s, [item.id]: { item, quantidade: e.target.valueAsNumber } }))} />
        </label>
        <button className="text-sm underline" onClick={() => selecionar(item, false)}>Remover</button>
      </div>)}
      <div className="flex flex-wrap items-center gap-4">
        <label className="grid gap-1 text-sm">Papel
          <select className={inputClasse} value={papel} onChange={e => setPapel(e.target.value as "a4" | "termica")}>
            <option value="a4">A4 — etiquetas 100 × 50 mm</option>
            <option value="termica">Térmica — 100 × 50 mm</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preco} onChange={e => setPreco(e.target.checked)} />Incluir preço</label>
        <button className="btn-primario" disabled={!podeImprimir || impressao} onClick={() => setImpressao(true)}>Imprimir / salvar PDF</button>
        {lista.length > 0 && <button className="text-sm underline" onClick={() => setSelecionadas({})}>Limpar seleção</button>}
      </div>
      <p className="text-sm text-muted-foreground">Até {MAX_ETIQUETAS} etiquetas por impressão. Use escala 100%, sem cabeçalho e rodapé. No A4, use folha sem espaços entre etiquetas, duas colunas e margem de 5 mm; confira o alinhamento em papel comum primeiro.</p>
      {lista.length > 0 && !podeImprimir && <p role="alert" className="text-sm text-red-800">Informe quantidades inteiras de 1 a {MAX_ETIQUETAS}, com total de até {MAX_ETIQUETAS} etiquetas.</p>}
    </section>
    {lista.length > 0 && <section className="grid gap-3" aria-label="Prévia das etiquetas">
      <h2 className="font-semibold">Prévia — uma etiqueta por item</h2>
      <div className="etiquetas-previa">{lista.map(({ item }) => <Etiqueta key={item.id} item={item} preco={preco} />)}</div>
    </section>}
    {impressao && createPortal(<div id="etiquetas-impressao" ref={areaImpressao} className={papel}>
      <style>{`@media print { @page { size: ${papel === "a4" ? "A4" : "100mm 50mm"}; margin: ${papel === "a4" ? "5mm" : "0"}; } }`}</style>
      {lista.flatMap(({ item, quantidade }) => Array.from({ length: quantidade }, (_, i) => <Etiqueta key={`${item.id}-${i}`} item={item} preco={preco} />))}
    </div>, document.body)}
  </div>;
}
