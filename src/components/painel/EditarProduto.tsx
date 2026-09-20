"use client";

import { useEffect, useState } from "react";
import { Campo, inputClasse } from "./campos";
import EnviarImagem from "./EnviarImagem";
import Recolhivel from "./Recolhivel";
import { ANO_MAX, ANO_MIN, MOTOS_BRASIL, lerCompatibilidade, type Compatibilidade } from "@/lib/motos";
import { PRINCIPIOS_COMUNS, TARJAS, TIPOS_MEDICAMENTO, pendenciasDe } from "@/lib/farmacia";
import { AJUDA_TIPO, lerDefinicoes, lerValores, type CampoPersonalizado } from "@/lib/campos-personalizados";

/** Campo vazio não vira 0: sem medida, o frete usa a caixa padrão da loja. */
const medida = (chave: string, valor: string) =>
  valor.trim() ? { [chave]: Number.parseFloat(valor.replace(",", ".")) } : {};

interface Form { tarja: string; principioAtivo: string; apresentacao: string; registroAnvisa: string; tipoMedicamento: string; versaoCatalogo:number; temVariacoes:boolean; mpn:string; identificadoresEstado:string; googleProductCategory:string; imagemOrigem:string; imagemFamilia:string; imagemConfirmada:boolean; correspondenciaImagem:"nao_confirmada"|"confirmada"|"rejeitada"; nome: string; categoria: string; marca: string; sku: string; gtin: string; preco: string; precoDe: string; descricaoCurta: string; descricao: string; imagens: string[]; destaque: boolean; ativo: boolean; disponibilidade: string; estoque: string; pesoKg: string; alturaCm: string; larguraCm: string; comprimentoCm: string; codigoOriginal: string; codigosEquivalentes: string; compatibilidade: LinhaCompat[]; camposPersonalizados: Record<string, string> }
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

/**
 * Formulário completo de um produto existente.
 *
 * Aberto fica o que se mexe todo dia — nome, categoria, preço, estoque, fotos;
 * identificação, frete, descrição e compatibilidade entram em blocos fechados.
 * Eram 22 campos numa coluna só: no celular, trocar um preço exigia rolar por
 * GTIN, MPN e "Identificadores" antes de chegar nele, e o botão de salvar
 * ficava depois de tudo. O que falta em cada bloco continua escrito na linha
 * fechada, senão a tela fica curta escondendo pendência.
 *
 * A tela era uma camada por cima da lista e trouxe a moldura junto (título
 * repetido, "Fechar", borda azul). Hoje é uma página com endereço próprio: o
 * nome está no cabeçalho e a volta é o "← Produtos".
 */
export default function EditarProduto({ produtoId, segmento = "geral", aoSalvar }: { produtoId: string; segmento?: string; aoSalvar: (msg: string) => void }) {
  // Os campos do medicamento só existem para quem é farmácia. Numa loja de
  // roupa eles seriam cinco campos vazios que ninguém entende — e o formulário
  // já é longo. Ver src/lib/farmacia.ts.
  const farmacia = segmento === "farmacia";
  const [f, setF] = useState<Form | null>(null);
  /** O produto como ele veio do banco, para saber se há o que salvar. */
  const [inicial, setInicial] = useState<Form | null>(null);
  /** O que esta loja pergunta além do padrão. Vem junto do produto no GET. */
  const [definicoes, setDefinicoes] = useState<CampoPersonalizado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    fetch(`/api/painel/produtos?id=${produtoId}`).then((r) => r.json()).then((p) => {
      if (p?.erro) return setErro(p.erro);
      setDefinicoes(lerDefinicoes(p.definicoesCampos));
      const carregado: Form = {
        camposPersonalizados: lerValores(p.camposPersonalizados), imagemOrigem:p.imagemOrigem??"propria", imagemFamilia:p.imagemFamilia??"", imagemConfirmada:p.midias?.[0]?.correspondencia === "confirmada", correspondenciaImagem:p.midias?.[0]?.correspondencia ?? "nao_confirmada",
        versaoCatalogo:p.versaoCatalogo, temVariacoes:p.opcoes.length>0, mpn:p.mpn??"", identificadoresEstado:p.identificadoresEstado??"desconhecido", googleProductCategory:p.googleProductCategory??"",
        nome: p.nome, categoria: p.categoria ?? "", marca: p.marca ?? "", sku: p.sku ?? "", gtin: p.gtin ?? "",
        preco: (p.precoCentavos / 100).toFixed(2).replace(".", ","), precoDe: p.precoDeCentavos != null ? (p.precoDeCentavos / 100).toFixed(2).replace(".", ",") : "",
        descricaoCurta: p.descricaoCurta ?? "", descricao: p.descricao ?? "", imagens: p.imagens ?? [], destaque: p.destaque, ativo: p.ativo,
        disponibilidade: p.disponibilidade, estoque: p.estoque != null ? String(p.estoque) : "", pesoKg: p.pesoKg != null ? String(p.pesoKg) : "",
        alturaCm: p.alturaCm != null ? String(p.alturaCm) : "", larguraCm: p.larguraCm != null ? String(p.larguraCm) : "", comprimentoCm: p.comprimentoCm != null ? String(p.comprimentoCm) : "",
        codigoOriginal: p.codigoOriginal ?? "", codigosEquivalentes: (p.codigosEquivalentes ?? []).join(", "), compatibilidade: paraLinhas(p.compatibilidade),
        tarja: p.tarja ?? "nenhuma", principioAtivo: p.principioAtivo ?? "", apresentacao: p.apresentacao ?? "",
        registroAnvisa: p.registroAnvisa ?? "", tipoMedicamento: p.tipoMedicamento ?? "",
      };
      setF(carregado);
      setInicial(carregado);
    });
  }, [produtoId]);

  const sujo = Boolean(f && inicial && JSON.stringify(f) !== JSON.stringify(inicial));

  // Fechar a aba com preço alterado e não salvo é perder o trabalho sem aviso.
  // Só o navegador pergunta; a navegação interna continua livre, e a barra de
  // salvar fica à vista enquanto houver mudança.
  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

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
          id: produtoId, versaoCatalogo:f.versaoCatalogo, mpn:f.temVariacoes?undefined:(f.mpn||null), identificadoresEstado:f.temVariacoes?undefined:f.identificadoresEstado, googleProductCategory:f.googleProductCategory.trim() || null, nome: f.nome, categoria: f.categoria, marca: f.marca || undefined, sku: f.temVariacoes?undefined:f.sku, gtin:f.temVariacoes?undefined:f.gtin.trim(), precoCentavos:f.temVariacoes?undefined:preco,
          ...(!f.temVariacoes ? { precoDeCentavos: precoDe ?? null } : {}),
          descricaoCurta: f.descricaoCurta || undefined, descricao: f.descricao || undefined, imagens: f.imagens, imagemOrigem:f.imagemOrigem, imagemFamilia:f.imagemFamilia.trim()||null, destaque: f.destaque, ativo: f.ativo,
          ...(f.imagemOrigem === "propria" && f.imagens.length ? { correspondenciaImagem: f.correspondenciaImagem } : {}),
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
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao salvar.");
      setInicial(f);
      aoSalvar("Produto atualizado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  if (!f) return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-6">{erro ?? "Carregando…"}</div>;
  const set = (k: keyof Form, v: unknown) => setF({ ...f, [k]: v });
  const setImagens = (imagens: string[]) => setF({ ...f, imagens, imagemConfirmada: false, correspondenciaImagem: "nao_confirmada" });

  // O que falta aparece na linha fechada do bloco: recolher não pode esconder
  // pendência, senão a tela fica curta mentindo.
  const semIdentificador = !f.gtin.trim() && !f.mpn.trim() && f.identificadoresEstado !== "sem_identificador";
  const semDescricao = !f.descricaoCurta.trim() && !f.descricao.trim();
  const semMedida = [f.pesoKg, f.alturaCm, f.larguraCm, f.comprimentoCm].some((v) => !v.trim());
  const motos = f.compatibilidade.filter((l) => l.marca.trim() && l.modelo.trim()).length;
  const pendenciasFarmacia = farmacia
    ? pendenciasDe({ tarja: f.tarja, principioAtivo: f.principioAtivo, apresentacao: f.apresentacao, registroAnvisa: f.registroAnvisa, tipoMedicamento: f.tipoMedicamento })
    : [];

  return (
    // `min-w-0`: item de grade não encolhe abaixo do conteúdo por padrão, e um
    // campo largo esticava o cartão inteiro para fora da tela no celular — o
    // mesmo defeito já corrigido em `Secao` e em `.padm-conteudo`.
    <section className="grid min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      {f.temVariacoes && <p className="text-sm text-muted-foreground">Identificação, preço, estoque e embalagem são definidos por apresentação. Use “Grade de variações” para editar esses dados.</p>}

      {/* Aberto: o que se mexe todo dia. O resto entra em bloco fechado, na
          ordem em que o lojista precisa, não na ordem do banco. */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Campo label="Nome"><input id="catalogo-nome" className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Categoria"><input id="catalogo-categoria" className={inputClasse} value={f.categoria} onChange={(e) => set("categoria", e.target.value)} /></Campo>
        <Campo label="Categoria Google (opcional)" ajuda="Use o ID ou caminho completo da taxonomia oficial. Vazio mantém a classificação automática do Google."><input id="catalogo-google-category" className={inputClasse} value={f.googleProductCategory} onChange={(e) => set("googleProductCategory", e.target.value)} placeholder="ID ou caminho oficial confirmado" /></Campo>
        <Campo label="Preço (R$)"><input id="catalogo-preco" readOnly={f.temVariacoes} className={inputClasse} value={f.preco} onChange={(e) => set("preco", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Preço “de” (R$)" ajuda="Riscado na loja, ao lado do preço."><input id="catalogo-precoDe" readOnly={f.temVariacoes} className={inputClasse} value={f.precoDe} onChange={(e) => set("precoDe", e.target.value)} inputMode="decimal" /></Campo>
        <Campo label="Estoque físico" ajuda="Quantidade física; as reservas são descontadas automaticamente. Vazio = não controla."><input id="catalogo-estoque" readOnly={f.temVariacoes} className={inputClasse} value={f.estoque} onChange={(e) => set("estoque", e.target.value)} inputMode="numeric" /></Campo>
        <Campo label="Disponibilidade">
          <select id="catalogo-disponibilidade" disabled={f.temVariacoes} className={inputClasse} value={f.disponibilidade} onChange={(e) => set("disponibilidade", e.target.value)}><option value="in_stock">Em estoque</option><option value="backorder">Sob encomenda</option><option value="out_of_stock">Esgotado</option></select>
        </Campo>
      </div>

      {/* Alvo de 44px como no resto do painel: a caixa crua do navegador é
          pequena demais para o dedo, e estas duas mudam o que vai ao ar. */}
      <div className="flex flex-wrap gap-x-6 text-sm">
        <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="size-5 accent-primary" checked={f.destaque} onChange={(e) => set("destaque", e.target.checked)} /> Destaque</label>
        <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" className="size-5 accent-primary" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativo (visível)</label>
      </div>

      <div id="catalogo-imagens" tabIndex={-1} />
      <Campo label="Fotos" ajuda="A primeira é a principal. Arraste não; use os botões.">
        <div className="flex flex-wrap gap-2">
          {f.imagens.map((url, i) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-20 rounded-lg border border-border object-cover" />
              <div className="mt-1 flex gap-1 text-[10px]">
                {i > 0 && <button className="underline" onClick={() => { const a = [...f.imagens]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setImagens(a); }}>← principal</button>}
                <button className="text-red-700 underline" onClick={() => setImagens(f.imagens.filter((_, j) => j !== i))}>remover</button>
              </div>
            </div>
          ))}
          <EnviarImagem aoEnviar={(url) => setImagens([...f.imagens, url])} rotulo="+ foto" />
        </div>
      </Campo>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Campo label="Tipo da imagem principal" ajuda="Foto própria só quando mostra este produto exato. Imagem representativa exige a família da peça.">
          <select id="catalogo-imagem-origem" className={inputClasse} value={f.imagemOrigem} onChange={(e) => setF({ ...f, imagemOrigem: e.target.value, imagemConfirmada: e.target.value === f.imagemOrigem ? f.imagemConfirmada : false, correspondenciaImagem: e.target.value === f.imagemOrigem ? f.correspondenciaImagem : "nao_confirmada" })}><option value="propria">Foto própria do produto exato</option><option value="representativa">Imagem representativa da família</option><option value="ilustracao">Ilustração ou diagrama</option></select>
        </Campo>
        {f.imagemOrigem === "representativa" && <Campo label="Família representada"><input id="catalogo-imagem-familia" className={inputClasse} value={f.imagemFamilia} onChange={(e) => set("imagemFamilia", e.target.value)} placeholder="Ex.: série 6200" maxLength={40} /></Campo>}
      </div>
      <Campo label="Correspondência da foto com o SKU"><select className={inputClasse} value={f.correspondenciaImagem} disabled={!f.imagens.length || f.imagemOrigem !== "propria"} onChange={(e) => setF({ ...f, correspondenciaImagem: e.target.value as Form["correspondenciaImagem"], imagemConfirmada: e.target.value === "confirmada" })}><option value="nao_confirmada">Ainda não conferida</option><option value="confirmada">Confirmada para este SKU</option><option value="rejeitada">Incorreta para este SKU</option></select></Campo>

      <Recolhivel titulo="Identificação" resumo="marca, SKU, GTIN, MPN" aviso={semIdentificador ? "sem GTIN nem MPN" : null}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Campo label="Marca"><input id="catalogo-marca" className={inputClasse} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Campo>
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
        </div>
      </Recolhivel>

      <Recolhivel titulo="Descrição" resumo="curta e completa" aviso={semDescricao ? "vazia" : null}>
        {/* Textarea, não `input`: são 300 caracteres, e num campo de uma linha
            o texto some para fora da tela enquanto se digita. */}
        <Campo label="Descrição curta" ajuda={`Aparece no card e no Google · ${f.descricaoCurta.length}/300`}>
          <textarea className={`${inputClasse} h-auto py-2`} rows={2} value={f.descricaoCurta} onChange={(e) => set("descricaoCurta", e.target.value)} maxLength={300} />
        </Campo>
        <Campo label="Descrição completa" ajuda="Parágrafos separados por linha em branco"><textarea id="catalogo-descricao" className={`${inputClasse} h-32 py-2`} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} /></Campo>
      </Recolhivel>

      {/* Medida que falta é frete pela caixa padrão da loja, quase sempre mais
          caro que o real: o aviso fica na linha fechada. */}
      <Recolhivel titulo="Frete e embalagem" resumo="peso e medidas" aviso={semMedida ? "frete pela caixa padrão" : null}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Campo label="Peso (kg)" ajuda="Do produto embalado"><input id="catalogo-pesoKg" readOnly={f.temVariacoes} className={inputClasse} value={f.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} inputMode="decimal" /></Campo>
          <Campo label="Altura da embalagem (cm)"><input id="catalogo-alturaCm" readOnly={f.temVariacoes} className={inputClasse} value={f.alturaCm} onChange={(e) => set("alturaCm", e.target.value)} inputMode="decimal" /></Campo>
          <Campo label="Largura da embalagem (cm)"><input id="catalogo-larguraCm" readOnly={f.temVariacoes} className={inputClasse} value={f.larguraCm} onChange={(e) => set("larguraCm", e.target.value)} inputMode="decimal" /></Campo>
          <Campo label="Comprimento da embalagem (cm)"><input id="catalogo-comprimentoCm" readOnly={f.temVariacoes} className={inputClasse} value={f.comprimentoCm} onChange={(e) => set("comprimentoCm", e.target.value)} inputMode="decimal" /></Campo>
        </div>
      </Recolhivel>

      {farmacia && (
        // Aberto quando há pendência: o lojista tem que ver o que falta antes
        // de publicar, não depois de um fiscal perguntar.
        <Recolhivel titulo="Medicamento" resumo="tarja, princípio ativo, registro" aviso={pendenciasFarmacia.length ? `${pendenciasFarmacia.length} pendência(s)` : null} aberto={pendenciasFarmacia.length > 0}>
          <p className="text-xs text-muted-foreground">
            Deixe a tarja em “Não é medicamento” para fralda, shampoo e dermocosmético.
            Para medicamento, a tarja é o que decide se o item pode ser vendido pela internet.
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
          {pendenciasFarmacia.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700">
              {pendenciasFarmacia.map((x) => <li key={x}>{x}</li>)}
            </ul>
          )}
        </Recolhivel>
      )}

      <Recolhivel titulo="Compatibilidade e códigos" resumo={motos ? `${motos} moto(s)` : "universal · OEM, equivalentes"}>
        <Campo label="Compatibilidade (peças por moto)" ajuda="Em que motos esta peça serve. Vazio = universal (capacete, óleo, serviço). Anos vazios = todos.">
          <div className="grid gap-2">
            {f.compatibilidade.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_5rem_5rem_auto]">
                <input className={inputClasse} list="marcas-de-moto" placeholder="Marca (Honda)" value={l.marca} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, marca: e.target.value } : x)))} />
                <input className={inputClasse} list={`modelos-${i}`} placeholder="Modelo (CG 160 Titan)" value={l.modelo} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, modelo: e.target.value } : x)))} />
                <datalist id={`modelos-${i}`}>{(MOTOS_BRASIL[l.marca] ?? []).map((m) => <option key={m} value={m} />)}</datalist>
                <input className={inputClasse} placeholder="De" inputMode="numeric" value={l.anoDe} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, anoDe: e.target.value } : x)))} />
                <input className={inputClasse} placeholder="Até" inputMode="numeric" value={l.anoAte} onChange={(e) => set("compatibilidade", f.compatibilidade.map((x, j) => (j === i ? { ...x, anoAte: e.target.value } : x)))} />
                <button type="button" className="inline-flex min-h-[44px] items-center text-xs text-red-700 underline" onClick={() => set("compatibilidade", f.compatibilidade.filter((_, j) => j !== i))}>remover</button>
              </div>
            ))}
            <datalist id="marcas-de-moto">{Object.keys(MOTOS_BRASIL).map((m) => <option key={m} value={m} />)}</datalist>
            <button type="button" className="btn-secundario h-11 w-fit px-3 text-xs" onClick={() => set("compatibilidade", [...f.compatibilidade, { marca: f.compatibilidade.at(-1)?.marca ?? "", modelo: "", anoDe: "", anoAte: "" }])}>+ moto</button>
          </div>
        </Campo>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Campo label="Código original (OEM)" ajuda="Referência de aplicação na moto. Não é automaticamente o MPN da peça vendida."><input className={inputClasse} value={f.codigoOriginal} onChange={(e) => set("codigoOriginal", e.target.value)} placeholder="15410-MCJ-505" /></Campo>
          <Campo label="Códigos equivalentes" ajuda="Separados por vírgula. O cliente que busca pelo código do concorrente acha esta peça."><input className={inputClasse} value={f.codigosEquivalentes} onChange={(e) => set("codigosEquivalentes", e.target.value)} placeholder="HF204, PH6017A" /></Campo>
        </div>
      </Recolhivel>

      {/* Campos da loja. Só aparece quando ela definiu algum: numa loja que
          não usa o recurso, um bloco vazio seria só ruído no formulário. */}
      {definicoes.length > 0 && (
        <Recolhivel titulo="Campos da loja" resumo={`${definicoes.length} campo(s) definidos em Configurações`}>
          <p className="text-xs text-muted-foreground">
            Definidos em Configurações › Campos do produto. Campo em rascunho é preenchido aqui e só aparece na loja
            quando você o ativa lá.
          </p>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
        </Recolhivel>
      )}

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</p>}

      {/* A barra só existe quando há o que salvar, e gruda no rodapé do
          cartão: com o formulário em blocos, o fim da página fica longe de
          onde a mudança foi feita, e ninguém deve rolar para guardar um preço.
          `sticky` e não `fixed`: não disputa a barra de navegação do painel
          nem sobra em cima de outra tela. */}
      {sujo ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
          <button className="btn-primario h-11" disabled={ocupado} onClick={salvar}>{ocupado ? "Salvando…" : "Salvar produto"}</button>
          <button type="button" className="btn-secundario h-11 px-4" disabled={ocupado} onClick={() => setF(inicial)}>Desfazer</button>
          <span className="text-xs text-muted-foreground">Alterações não salvas</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Sem alterações para salvar.</p>
      )}
    </section>
  );
}
