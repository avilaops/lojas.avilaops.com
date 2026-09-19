"use client";

import { useEffect, useState } from "react";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";
import { ANO_MAX, ANO_MIN, MOTOS_BRASIL, lerCompatibilidade, type Compatibilidade } from "@/lib/motos";
import { PRINCIPIOS_COMUNS, TARJAS, TIPOS_MEDICAMENTO, pendenciasDe } from "@/lib/farmacia";
import { AJUDA_TIPO, lerDefinicoes, lerValores, type CampoPersonalizado } from "@/lib/campos-personalizados";
import { ORIGENS_DE_IMAGEM, SELO_IMAGEM, declaracaoDaImagem } from "@/lib/imagem-origem";
import { detalharErro } from "@/lib/erro-de-formulario";

/** Campo vazio não vira 0: sem medida, o frete usa a caixa padrão da loja. */
const medida = (chave: string, valor: string) =>
  valor.trim() ? { [chave]: Number.parseFloat(valor.replace(",", ".")) } : {};

interface Form { tarja: string; principioAtivo: string; apresentacao: string; registroAnvisa: string; tipoMedicamento: string; versaoCatalogo:number; temVariacoes:boolean; mpn:string; identificadoresEstado:string; nome: string; categoria: string; marca: string; sku: string; gtin: string; preco: string; precoDe: string; descricaoCurta: string; descricao: string; imagens: string[]; imagemOrigem: string; imagemFamilia: string; destaque: boolean; ativo: boolean; disponibilidade: string; estoque: string; pesoKg: string; alturaCm: string; larguraCm: string; comprimentoCm: string; codigoOriginal: string; codigosEquivalentes: string; compatibilidade: LinhaCompat[]; camposPersonalizados: Record<string, string> }
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
export default function EditarProduto({ produtoId, segmento = "geral", aoFechar, aoSalvar }: { produtoId: string; segmento?: string; aoFechar: () => void; aoSalvar: (msg: string) => void }) {
  // Os campos do medicamento só existem para quem é farmácia. Numa loja de
  // roupa eles seriam cinco campos vazios que ninguém entende — e o formulário
  // já é longo. Ver src/lib/farmacia.ts.
  const farmacia = segmento === "farmacia";
  const [f, setF] = useState<Form | null>(null);
  /** O que esta loja pergunta além do padrão. Vem junto do produto no GET. */
  const [definicoes, setDefinicoes] = useState<CampoPersonalizado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    fetch(`/api/painel/produtos?id=${produtoId}`).then((r) => r.json()).then((p) => {
      if (p?.erro) return setErro(p.erro);
      setDefinicoes(lerDefinicoes(p.definicoesCampos));
      setF({
        camposPersonalizados: lerValores(p.camposPersonalizados),
        versaoCatalogo:p.versaoCatalogo, temVariacoes:p.opcoes.length>0, mpn:p.mpn??"", identificadoresEstado:p.identificadoresEstado??"desconhecido",
        nome: p.nome, categoria: p.categoria ?? "", marca: p.marca ?? "", sku: p.sku ?? "", gtin: p.gtin ?? "",
        preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), precoDe: p.precoDeCentavos != null ? (p.precoDeCentavos / 100).toFixed(2).replace(".", ",") : "",
        descricaoCurta: p.descricaoCurta ?? "", descricao: p.descricao ?? "", imagens: p.imagens ?? [],
        imagemOrigem: p.imagemOrigem ?? "propria", imagemFamilia: p.imagemFamilia ?? "",
        destaque: p.destaque, ativo: p.ativo,
        disponibilidade: p.disponibilidade, estoque: p.estoque != null ? String(p.estoque) : "", pesoKg: p.pesoKg != null ? String(p.pesoKg) : "",
        alturaCm: p.alturaCm != null ? String(p.alturaCm) : "", larguraCm: p.larguraCm != null ? String(p.larguraCm) : "", comprimentoCm: p.comprimentoCm != null ? String(p.comprimentoCm) : "",
        codigoOriginal: p.codigoOriginal ?? "", codigosEquivalentes: (p.codigosEquivalentes ?? []).join(", "), compatibilidade: paraLinhas(p.compatibilidade),
        tarja: p.tarja ?? "nenhuma", principioAtivo: p.principioAtivo ?? "", apresentacao: p.apresentacao ?? "",
        registroAnvisa: p.registroAnvisa ?? "", tipoMedicamento: p.tipoMedicamento ?? "",
      });
    });
  }, [produtoId]);

  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(",", ".")) * 100);

  async function salvar() {
    if (!f) return;
    const preco = centavos(f.preco);
    if (!f.nome.trim() || !Number.isFinite(preco)) return setErro("Nome e preço são obrigatórios.");
    // O banco recusaria isso com um 422 genérico. A cobrança tem que ser aqui,
    // dizendo para que serve: sem a série não há como achar todos os produtos
    // que usam a foto no dia em que ela for trocada.
    if (f.imagens.length && f.imagemOrigem === "representativa" && !f.imagemFamilia.trim())
      return setErro("Diga de que série a foto veio — é o que permite trocar a imagem de toda a família depois.");
    setErro(null); setOcupado(true);
    try {
      const precoDe = f.precoDe.trim() ? centavos(f.precoDe) : undefined;
      const r = await fetch("/api/painel/produtos", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: produtoId, versaoCatalogo:f.versaoCatalogo, mpn:f.temVariacoes?undefined:(f.mpn||null), identificadoresEstado:f.temVariacoes?undefined:f.identificadoresEstado, nome: f.nome, categoria: f.categoria, marca: f.marca || undefined, sku: f.temVariacoes?undefined:f.sku, gtin:f.temVariacoes?undefined:f.gtin.trim(), precoCentavos:f.temVariacoes?undefined:preco,
          ...(!f.temVariacoes ? { precoDeCentavos: precoDe ?? null } : {}),
          descricaoCurta: f.descricaoCurta || undefined, descricao: f.descricao || undefined, imagens: f.imagens, destaque: f.destaque, ativo: f.ativo,
          // A regra de o que pode ser declarado mora no lib, com o resto da
          // política de imagem — não aqui.
          ...declaracaoDaImagem(f.imagens, f.imagemOrigem, f.imagemFamilia),
          disponibilidade:f.temVariacoes?undefined:f.disponibilidade, ...(!f.temVariacoes ? { estoque:f.estoque.trim()?Number(f.estoque):null } : {}), ...(f.pesoKg.trim() ? { pesoKg: Number.parseFloat(f.pesoKg.replace(",", ".")) } : {}),
        ...medida("alturaCm", f.alturaCm), ...medida("larguraCm", f.larguraCm), ...medida("comprimentoCm", f.comprimentoCm),
          codigoOriginal: f.codigoOriginal.trim() || null,
          codigosEquivalentes: f.codigosEquivalentes.split(/[,;\n]/).map((c) => c.trim()).filter(Boolean),
          compatibilidade: paraCompat(f.compatibilidade),
          // Só quando a loja definiu algum: enviar {} apagaria os valores de
          // quem ainda não usa o recurso.
          ...(definicoes.length ? { camposPersonalizados: f.camposPersonalizados } : {}),
          ...(farmacia ? {
            tarja: f.tarja,
            principioAtivo: f.principioAtivo.trim() || null,
            apresentacao: f.apresentacao.trim() || null,
            registroAnvisa: f.registroAnvisa.trim() || null,
            tipoMedicamento: f.tipoMedicamento || null,
          } : {}),
        }),
      });
      const d = await r.json();
      // "Dados inválidos." sozinho é beco sem saída: a resposta diz QUAL campo
      // recusou, e essa parte ficava no console. Num formulário com trinta
      // campos, saber que é a foto ou o GTIN é a diferença entre corrigir e
      // desistir.
      if (!r.ok) throw new Error(detalharErro(d));
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
        {f.temVariacoes && <p className="sm:col-span-2 text-sm text-muted-foreground">Identificação, preço, estoque e embalagem são definidos por apresentação. Use “Grade de variações” para editar esses dados.</p>}
        <Campo label="Nome"><input id="catalogo-nome" className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Categoria"><input id="catalogo-categoria" className={inputClasse} value={f.categoria} onChange={(e) => set("categoria", e.target.value)} /></Campo>
        <Campo label="Marca"><input className={inputClasse} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Campo>
        <Campo label="SKU"><input id="catalogo-sku" readOnly={f.temVariacoes} className={inputClasse} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Campo>
        {/* O GTIN é o que faz o Google e o Mercado Livre reconhecerem que a
            peça é a mesma que o concorrente anuncia. Sem ele o produto fica
            fora do catálogo unificado do ML e perde alcance no Shopping.
            Quem emite é o fabricante: vem na caixa ou com o fornecedor. */}
        <Campo label="GTIN / código de barras" ajuda="Código atribuído pelo fabricante: GTIN-8, UPC-12, EAN-13 ou GTIN-14. Confira na embalagem.">
          <input id="catalogo-gtin" readOnly={f.temVariacoes} className={inputClasse} value={f.gtin} onChange={(e) => set("gtin", e.target.value)} inputMode="numeric" placeholder="7891234567895" maxLength={14} />
        </Campo>
        <Campo label="MPN / código do fabricante" ajuda="Código do item vendido, sem confundir com referência de compatibilidade."><input className={inputClasse} readOnly={f.temVariacoes} value={f.mpn} onChange={e=>set("mpn",e.target.value)} /></Campo>
        <Campo label="Identificadores"><select className={inputClasse} disabled={f.temVariacoes} value={f.identificadoresEstado} onChange={e=>set("identificadoresEstado",e.target.value)}><option value="desconhecido">Ainda não confirmado</option><option value="informado">Informado no cadastro</option><option value="sem_identificador">Fabricante não atribuiu identificador</option></select></Campo>
        <Campo label="Preço (R$)"><input id="catalogo-preco" readOnly={f.temVariacoes} className={inputClasse} value={f.preco} onChange={(e) => set("preco", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Preço “de” (R$)"><input id="catalogo-precoDe" readOnly={f.temVariacoes} className={inputClasse} value={f.precoDe} onChange={(e) => set("precoDe", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Estoque físico" ajuda="Quantidade física; as reservas são descontadas automaticamente. Vazio = não controla."><input id="catalogo-estoque" readOnly={f.temVariacoes} className={inputClasse} value={f.estoque} onChange={(e) => set("estoque", e.target.value)} inputMode="numeric" /></Campo>
        <Campo label="Peso (kg)" ajuda="Do produto embalado"><input id="catalogo-pesoKg" readOnly={f.temVariacoes} className={inputClasse} value={f.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Altura da embalagem (cm)"><input id="catalogo-alturaCm" readOnly={f.temVariacoes} className={inputClasse} value={f.alturaCm} onChange={(e) => set("alturaCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Largura da embalagem (cm)"><input id="catalogo-larguraCm" readOnly={f.temVariacoes} className={inputClasse} value={f.larguraCm} onChange={(e) => set("larguraCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Comprimento da embalagem (cm)"><input id="catalogo-comprimentoCm" readOnly={f.temVariacoes} className={inputClasse} value={f.comprimentoCm} onChange={(e) => set("comprimentoCm", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Disponibilidade">
          <select id="catalogo-disponibilidade" disabled={f.temVariacoes} className={inputClasse} value={f.disponibilidade} onChange={(e) => set("disponibilidade", e.target.value)}><option value="in_stock">Em estoque</option><option value="backorder">Sob encomenda</option><option value="out_of_stock">Esgotado</option></select>
        </Campo>
        <div className="flex items-end gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.destaque} onChange={(e) => set("destaque", e.target.checked)} /> Destaque</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (visível)</label>
        </div>
      </div>
      <div className="mt-4 grid gap-4">
        <Campo label="Descrição curta" ajuda="Aparece no card e no Google"><input className={inputClasse} value={f.descricaoCurta} onChange={(e) => set("descricaoCurta", e.target.value)} maxLength={300} /></Campo>
        <Campo label="Descrição completa" ajuda="Parágrafos separados por linha em branco"><textarea id="catalogo-descricao" className={`${inputClasse} h-32 py-2`} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
        {farmacia && (() => {
          const pendencias = pendenciasDe({ tarja: f.tarja, principioAtivo: f.principioAtivo, apresentacao: f.apresentacao, registroAnvisa: f.registroAnvisa, tipoMedicamento: f.tipoMedicamento });
          return (
            <section className="rounded-xl border border-border p-4">
              <h4 className="text-sm font-semibold">Medicamento</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe a tarja em “Não é medicamento” para fralda, shampoo e dermocosmético.
                Para medicamento, a tarja é o que decide se o item pode ser vendido pela internet.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Campo label="Tarja" ajuda="Tarja preta e tarja vermelha com retenção são de controle especial: a venda pela internet é proibida (RDC 44/2009) e o item fica sem botão de comprar.">
                  <select className={inputClasse} value={f.tarja} onChange={(e) => set("tarja", e.target.value)}>
                    {TARJAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </Campo>
                <Campo label="Tipo">
                  <select className={inputClasse} value={f.tipoMedicamento} onChange={(e) => set("tipoMedicamento", e.target.value)}>
                    <option value="">Não informado</option>
                    {TIPOS_MEDICAMENTO.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </Campo>
                <Campo label="Princípio ativo" ajuda="A substância, como está na caixa. É por ela que o cliente acha o genérico do que o médico receitou.">
                  <input className={inputClasse} list="principios-ativos" value={f.principioAtivo} onChange={(e) => set("principioAtivo", e.target.value)} placeholder="Dipirona monoidratada" />
                  <datalist id="principios-ativos">{PRINCIPIOS_COMUNS.map((x) => <option key={x} value={x} />)}</datalist>
                </Campo>
                <Campo label="Apresentação" ajuda="Dose e quantidade. Sem ela não dá para afirmar que um genérico equivale a este.">
                  <input className={inputClasse} value={f.apresentacao} onChange={(e) => set("apresentacao", e.target.value)} placeholder="500 mg · 20 comprimidos" />
                </Campo>
                <Campo label="Registro na Anvisa" ajuda="13 dígitos, como está na caixa.">
                  <input className={inputClasse} value={f.registroAnvisa} onChange={(e) => set("registroAnvisa", e.target.value)} inputMode="numeric" placeholder="1.0298.0123.001-5" />
                </Campo>
              </div>
              {pendencias.length > 0 && (
                // O lojista tem que ver o que falta antes de publicar, não
                // depois de um fiscal perguntar.
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-700">
                  {pendencias.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
            </section>
          );
        })()}
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
          <Campo label="Código original (OEM)" ajuda="Referência de aplicação na moto. Não é automaticamente o MPN da peça vendida."><input className={inputClasse} value={f.codigoOriginal} onChange={(e) => set("codigoOriginal", e.target.value)} placeholder="15410-MCJ-505" /></Campo>
          <Campo label="Códigos equivalentes" ajuda="Separados por vírgula. O cliente que busca pelo código do concorrente acha esta peça."><input className={inputClasse} value={f.codigosEquivalentes} onChange={(e) => set("codigosEquivalentes", e.target.value)} placeholder="HF204, PH6017A" /></Campo>
        </div>
        {/* Campos da loja. Só aparece quando ela definiu algum: numa loja que
            não usa o recurso, um bloco vazio seria só ruído no formulário. */}
        {definicoes.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="text-sm font-semibold">Campos da loja</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Definidos em Configurações › Campos do produto. Campo em rascunho é preenchido aqui e só aparece na loja
              quando você o ativa lá.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {definicoes.map((c) => {
                const valor = f.camposPersonalizados[c.chave] ?? "";
                const mudar = (v: string) => set("camposPersonalizados", { ...f.camposPersonalizados, [c.chave]: v });
                const rotulo = c.estado === "rascunho" ? `${c.rotulo} (rascunho)` : c.rotulo;
                const ajuda = c.ajuda ?? AJUDA_TIPO[c.tipo];
                if (c.tipo === "escolha") {
                  return (
                    <Campo key={c.chave} label={rotulo} ajuda={ajuda}>
                      <select className={inputClasse} value={valor} onChange={(e) => mudar(e.target.value)}>
                        <option value="">—</option>
                        {(c.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Campo>
                  );
                }
                if (c.tipo === "booleano") {
                  return (
                    <Campo key={c.chave} label={rotulo} ajuda={ajuda}>
                      <select className={inputClasse} value={valor} onChange={(e) => mudar(e.target.value)}>
                        <option value="">—</option>
                        <option value="sim">Sim</option>
                        <option value="nao">Não</option>
                      </select>
                    </Campo>
                  );
                }
                if (c.tipo === "texto-longo") {
                  return (
                    <Campo key={c.chave} label={rotulo} ajuda={ajuda}>
                      <textarea className={`${inputClasse} h-auto py-2`} rows={4} value={valor} onChange={(e) => mudar(e.target.value)} />
                    </Campo>
                  );
                }
                return (
                  <Campo key={c.chave} label={rotulo} ajuda={ajuda}>
                    <input
                      className={inputClasse}
                      type={c.tipo === "data" ? "date" : c.tipo === "numero" ? "text" : "text"}
                      inputMode={c.tipo === "numero" ? "decimal" : undefined}
                      value={valor}
                      onChange={(e) => mudar(e.target.value)}
                      placeholder={c.tipo === "video" ? "https://youtu.be/…" : c.tipo === "url" || c.tipo === "imagem" ? "https://…" : c.unidade ? `em ${c.unidade}` : ""}
                    />
                  </Campo>
                );
              })}
            </div>
          </div>
        )}
        <div id="catalogo-imagens" tabIndex={-1} /><Campo label="Fotos" ajuda="A primeira é a principal. Arraste não; use os botões.">
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

        {/* De que é a foto.
            Em catálogo técnico a mesma imagem cobre uma série inteira — é o
            que o plano de foto prevê, uma por família — e reaproveitar é
            honesto; fingir que a foto é do SKU exato não é. O campo existe
            desde que a política virou CHECK no banco, mas só a importação e a
            API sabiam preenchê-lo: quem faz a sessão de foto não tinha por
            onde dizer. Some sem foto, porque declarar a origem de uma imagem
            que não existe é o que a escrita recusa. */}
        {f.imagens.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="De que é a foto" ajuda={ORIGENS_DE_IMAGEM.find((o) => o.valor === f.imagemOrigem)?.ajuda}>
              <select className={inputClasse} value={f.imagemOrigem} onChange={(e) => set("imagemOrigem", e.target.value)}>
                {ORIGENS_DE_IMAGEM.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
            </Campo>
            {f.imagemOrigem === "representativa" && (
              <Campo label="Série de que a foto veio" obrigatorio ajuda="Como a série é chamada no catálogo: 6200, UCP, 32000.">
                <input className={inputClasse} value={f.imagemFamilia} onChange={(e) => set("imagemFamilia", e.target.value)} placeholder="6200" maxLength={40} />
              </Campo>
            )}
            {SELO_IMAGEM[f.imagemOrigem] && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O card da vitrine vai mostrar <strong>{SELO_IMAGEM[f.imagemOrigem]}</strong> sobre a foto, e a página do produto e o anúncio no Mercado Livre trazem a frase inteira.
              </p>
            )}
          </div>
        )}
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4"><button className="btn-primario" disabled={ocupado} onClick={salvar}>Salvar produto</button></div>
    </div>
  );
}
