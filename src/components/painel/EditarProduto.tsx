"use client";

import { useEffect, useState } from "react";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";
import { ANO_MAX, ANO_MIN, MOTOS_BRASIL, lerCompatibilidade, type Compatibilidade } from "@/lib/motos";

/** Campo vazio não vira 0: sem medida, o frete usa a caixa padrão da loja. */
const medida = (chave: string, valor: string) =>
  valor.trim() ? { [chave]: Number.parseFloat(valor.replace(",", ".")) } : {};

interface Form { nome: string; categoria: string; marca: string; sku: string; gtin: string; preco: string; precoDe: string; descricaoCurta: string; descricao: string; imagens: string[]; destaque: boolean; ativo: boolean; disponibilidade: string; estoque: string; pesoKg: string; alturaCm: string; larguraCm: string; comprimentoCm: string; codigoOriginal: string; codigosEquivalentes: string; compatibilidade: LinhaCompat[] }
/** Linha do editor de compatibilidade: texto livre até salvar (ano vazio = sem limite). */
interface LinhaCompat { marca: string; modelo: string; anoDe: string; anoAte: string }

const paraLinhas = (bruto: unknown): LinhaCompat[] => lerCompatibilidade(bruto).map((c) => ({ marca: c.marca, modelo: c.modelo, anoDe: c.anoDe != null ? String(c.anoDe) : "", anoAte: c.anoAte != null ? String(c.anoAte) : "" }));
const paraCompat = (linhas: LinhaCompat[]): Compatibilidade[] =>
  linhas
    .filter((l) => l.marca.trim() && l.modelo.trim())
    .map((l) => {
      const de = Number.parseInt(l.anoDe, 10);
      const ate = Number.parseInt(l.anoAte, 10);
      return { marca: l.marca.trim(), modelo: l.modelo.trim(), ...(de >= ANO_MIN && de <= ANO_MAX ? { anoDe: de } : {}), ...(ate >= ANO_MIN && ate <= ANO_MAX ? { anoAte: ate } : {}) };
    });

/** Formulário completo de um produto existente: várias fotos, descrição longa, estoque, ativo/destaque. */
export default function EditarProduto({ produtoId, aoFechar, aoSalvar }: { produtoId: string; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  const [f, setF] = useState<Form | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    fetch(`/api/painel/produtos?id=${produtoId}`).then((r) => r.json()).then((p) => {
      if (p?.erro) return setErro(p.erro);
      setF({
        nome: p.nome, categoria: p.categoria ?? "", marca: p.marca ?? "", sku: p.sku ?? "", gtin: p.gtin ?? "",
        preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), precoDe: p.precoDeCentavos != null ? (p.precoDeCentavos / 100).toFixed(2).replace(".", ",") : "",
        descricaoCurta: p.descricaoCurta ?? "", descricao: p.descricao ?? "", imagens: p.imagens ?? [], destaque: p.destaque, ativo: p.ativo,
        disponibilidade: p.disponibilidade, estoque: p.estoque != null ? String(p.estoque) : "", pesoKg: p.pesoKg != null ? String(p.pesoKg) : "",
        alturaCm: p.alturaCm != null ? String(p.alturaCm) : "", larguraCm: p.larguraCm != null ? String(p.larguraCm) : "", comprimentoCm: p.comprimentoCm != null ? String(p.comprimentoCm) : "",
        codigoOriginal: p.codigoOriginal ?? "", codigosEquivalentes: (p.codigosEquivalentes ?? []).join(", "), compatibilidade: paraLinhas(p.compatibilidade),
      });
    });
  }, [produtoId]);

  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  async function salvar() {
    if (!f) return;
    const preco = centavos(f.preco);
    if (!f.nome.trim() || !Number.isFinite(preco)) return setErro("Nome e preço são obrigatórios.");
    setErro(null); setOcupado(true);
    try {
      const precoDe = f.precoDe.trim() ? centavos(f.precoDe) : undefined;
      const r = await fetch("/api/painel/produtos", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: produtoId, nome: f.nome, categoria: f.categoria, marca: f.marca || undefined, sku: f.sku || undefined, gtin: f.gtin.replace(/\D/g, "") || undefined, precoCentavos: preco,
          ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
          descricaoCurta: f.descricaoCurta || undefined, descricao: f.descricao || undefined, imagens: f.imagens, destaque: f.destaque, ativo: f.ativo,
          disponibilidade: f.disponibilidade, ...(f.estoque.trim() ? { estoque: Number(f.estoque) } : {}), ...(f.pesoKg.trim() ? { pesoKg: Number.parseFloat(f.pesoKg.replace(",", ".")) } : {}),
        ...medida("alturaCm", f.alturaCm), ...medida("larguraCm", f.larguraCm), ...medida("comprimentoCm", f.comprimentoCm),
          codigoOriginal: f.codigoOriginal.trim() || null,
          codigosEquivalentes: f.codigosEquivalentes.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean),
          compatibilidade: paraCompat(f.compatibilidade),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      aoSalvar("Produto atualizado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  if (!f) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{erro ?? "Carregando…"}</div>;
  const set = (k: keyof Form, v: unknown) => setF({ ...f, [k]: v });

  return (
    <div className="rounded-2xl border border-primary/40 bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-semibold">Editar {f.nome}</h3>
        <button className="btn-secundario h-9 px-3 text-xs" onClick={aoFechar}>Fechar</button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Campo label="Nome"><input className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Categoria"><input className={inputClasse} value={f.categoria} onChange={(e) => set("categoria", e.target.value)} /></Campo>
        <Campo label="Marca"><input className={inputClasse} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Campo>
        <Campo label="SKU"><input className={inputClasse} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Campo>
        {/* O GTIN é o que faz o Google e o Mercado Livre reconhecerem que a
            peça é a mesma que o concorrente anuncia. Sem ele o produto fica
            fora do catálogo unificado do ML e perde alcance no Shopping.
            Quem emite é o fabricante: vem na caixa ou com o fornecedor. */}
        <Campo label="GTIN / código de barras" ajuda="Os 13 dígitos impressos na caixa (EAN). Sem ele o produto não entra no catálogo do Mercado Livre.">
          <input className={inputClasse} value={f.gtin} onChange={(e) => set("gtin", e.target.value)} inputMode="numeric" placeholder="7891234567895" maxLength={14} />
        </Campo>
        <Campo label="Preço (R$)"><input className={inputClasse} value={f.preco} onChange={(e) => set("preco", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Preço “de” (R$)"><input className={inputClasse} value={f.precoDe} onChange={(e) => set("precoDe", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Estoque" ajuda="Vazio = não controla"><input className={inputClasse} value={f.estoque} onChange={(e) => set("estoque", e.target.value)} inputMode="numeric" /></Campo>
        <Campo label="Peso (kg)" ajuda="Do produto embalado"><input className={inputClasse} value={f.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Altura da embalagem (cm)"><input className={inputClasse} value={f.alturaCm} onChange={(e) => set("alturaCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Largura da embalagem (cm)"><input className={inputClasse} value={f.larguraCm} onChange={(e) => set("larguraCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Comprimento da embalagem (cm)"><input className={inputClasse} value={f.comprimentoCm} onChange={(e) => set("comprimentoCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Disponibilidade">
          <select className={inputClasse} value={f.disponibilidade} onChange={(e) => set("disponibilidade", e.target.value)}><option value="in_stock">Em estoque</option><option value="backorder">Sob encomenda</option><option value="out_of_stock">Esgotado</option></select>
        </Campo>
        <div className="flex items-end gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.destaque} onChange={(e) => set("destaque", e.target.checked)} /> Destaque</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (visível)</label>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <Campo label="Descrição curta" ajuda="Aparece no card e no Google"><input className={inputClasse} value={f.descricaoCurta} onChange={(e) => set("descricaoCurta", e.target.value)} maxLength={300} /></Campo>
        <Campo label="Descrição completa" ajuda="Parágrafos separados por linha em branco"><textarea className={`${inputClasse} h-32 py-2`} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
        <Campo label="Compatibilidade (peças por moto)" ajuda="Em que motos esta peça serve. Vazio = universal (capacete, óleo, serviço). Anos vazios = todos.">
          <div className="grid gap-2">
            {f.compatibilidade.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_5rem_5rem_auto]">
                <input className={inputClasse} list="marcas-de-moto" placeholder="Marca (Honda)" value={l.marca} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, marca: e.target.value } : x)))} />
                <input className={inputClasse} list={`modelos-${i}`} placeholder="Modelo (CG 160 Titan)" value={l.modelo} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, modelo: e.target.value } : x)))} />
                <datalist id={`modelos-${i}`}>{(MOTOS_BRASIL[l.marca] ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                <input className={inputClasse} placeholder="De" inputMode="numeric" value={l.anoDe} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, anoDe: e.target.value } : x)))} />
                <input className={inputClasse} placeholder="Até" inputMode="numeric" value={l.anoAte} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, anoAte: e.target.value } : x)))} />
                <button type="button" className="text-xs text-red-700 underline" onClick={() => set("compatibilidade", f.compatibilidade.filter((_, j) => j !== i))}>remover</button>
              </div>
            ))}
            <datalist id="marcas-de-moto">{Object.keys(MOTOS_BRASIL).map((m) => <option key={m} value={m} />)}</datalist>
            <button type="button" className="btn-secundario h-9 w-fit px-3 text-xs" onClick={() => set("compatibilidade", [...f.compatibilidade, { marca: f.compatibilidade.at(-1)?.marca ?? "", modelo: "", anoDe: "", anoAte: "" }])}>+ moto</button>
          </div>
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Código original (OEM)" ajuda="Código da peça no fabricante da moto. Entra na busca e no Google Shopping (mpn)."><input className={inputClasse} value={f.codigoOriginal} onChange={(e) => set("codigoOriginal", e.target.value)} placeholder="15410-MCJ-505" /></Campo>
          <Campo label="Códigos equivalentes" ajuda="Separados por vírgula. O cliente que busca pelo código do concorrente acha esta peça."><input className={inputClasse} value={f.codigosEquivalentes} onChange={(e) => set("codigosEquivalentes", e.target.value)} placeholder="HF204, PH6017A" /></Campo>
        </div>
        <Campo label="Fotos" ajuda="A primeira é a principal. Arraste não; use os botões.">
          <div className="flex flex-wrap gap-2">
            {f.imagens.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
                <div className="mt-1 flex gap-1 text-[10px]">
                  {i > 0 && <button className="underline" onClick={() => { const a = [...f.imagens]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("imagens", a); }}>← principal</button>}
                  <button className="text-red-700 underline" onClick={() => set("imagens", f.imagens.filter((_, j) => j !== i))}>remover</button>
                </div>
              </div>
            ))}
            <EnviarImagem aoEnviar={(url) => set("imagens", [...f.imagens, url])} rotulo="+ foto" />
          </div>
        </Campo>
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4"><button className="btn-primario" disabled={ocupado} onClick={salvar}>Salvar produto</button></div>
    </div>
  );
}
