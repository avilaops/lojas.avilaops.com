"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Campo, Secao, inputClasse, lerCsvProdutos } from "./campos";
import { criarDirecaoVisual, PERSONALIDADES, SEGMENTOS, type DiagnosticoMarca, type IdentidadeLoja } from "@/lib/identidade";

const PASSOS = ["Negócio", "Essência", "Direção de marca", "Operação", "Catálogo e acesso"] as const;
const VOZES = [["direto", "Direto", "Claro, breve e orientado à ação."], ["proximo", "Próximo", "Humano, simples e acolhedor."], ["especialista", "Especialista", "Seguro, didático e preciso."], ["inspirador", "Inspirador", "Aspiracional, sensorial e positivo."]] as const;
const FOTOS = [["produto", "Produto"], ["editorial", "Editorial"], ["lifestyle", "Em uso"], ["natural", "Natural"], ["tecnico", "Técnico"]] as const;
type Personalidade = IdentidadeLoja["personalidade"][number];

export default function CriarLoja({ planoInicial }: { planoInicial: "SITE" | "LOJA" | "LOJA_PRO" }) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState({
    nome: "", slogan: "", whatsapp: "", instagram: "", emailContato: "", plano: planoInicial,
    segmento: "outro" as DiagnosticoMarca["segmento"], publico: "", diferencial: "",
    personalidade: ["sofisticada"] as Personalidade[], tomDeVoz: "direto" as DiagnosticoMarca["tomDeVoz"],
    objetivo: "vender" as DiagnosticoMarca["objetivo"], estiloFotografico: "produto" as DiagnosticoMarca["estiloFotografico"],
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", horario: "",
    retiradaNaLoja: true, despachoDiasUteis: 1, dominioPrincipal: "", senha: "", senha2: "",
  });
  const [csv, setCsv] = useState<{ nome: string; produtos: Array<Record<string, unknown>>; erros: string[] } | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((a) => ({ ...a, [k]: v }));
  const diagnostico = useMemo<DiagnosticoMarca>(() => ({ segmento: f.segmento, publico: f.publico, diferencial: f.diferencial, personalidade: f.personalidade, tomDeVoz: f.tomDeVoz, objetivo: f.objetivo, estiloFotografico: f.estiloFotografico }), [f.segmento, f.publico, f.diferencial, f.personalidade, f.tomDeVoz, f.objetivo, f.estiloFotografico]);
  const direcao = useMemo(() => criarDirecaoVisual(diagnostico, f.nome || "Sua marca"), [diagnostico, f.nome]);

  function alternarPersonalidade(valor: Personalidade) {
    setF((atual) => {
      const tem = atual.personalidade.includes(valor);
      if (tem && atual.personalidade.length === 1) return atual;
      return { ...atual, personalidade: tem ? atual.personalidade.filter((x) => x !== valor) : [...atual.personalidade, valor].slice(-3) };
    });
  }

  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    const r = await fetch(`/api/cep?cep=${limpo}`).then((x) => x.ok ? x.json() : null).catch(() => null);
    if (r) setF((a) => ({ ...a, logradouro: r.logradouro || a.logradouro, bairro: r.bairro || a.bairro, cidade: r.cidade || a.cidade, uf: r.uf || a.uf }));
  }

  async function criar() {
    setErro(null);
    if (f.senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (f.senha !== f.senha2) return setErro("As senhas não conferem.");
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/criar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        nome: f.nome, slogan: f.slogan || direcao.identidade.assinatura, whatsapp: f.whatsapp || undefined, instagram: f.instagram || undefined,
        emailContato: f.emailContato, senha: f.senha, plano: f.plano, identidade: direcao.identidade, tema: direcao.tema,
        endereco: { cep: f.cep || undefined, logradouro: f.logradouro || undefined, numero: f.numero || undefined, bairro: f.bairro || undefined, cidade: f.cidade || undefined, uf: f.uf || undefined },
        cepOrigem: f.cep || undefined, horario: f.horario || undefined, retiradaNaLoja: f.retiradaNaLoja, despachoDiasUteis: Number(f.despachoDiasUteis),
        dominioPrincipal: f.dominioPrincipal || undefined, produtos: csv?.produtos ?? [],
      }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível criar a loja.");
      router.push("/painel?nova=1"); router.refresh();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha inesperada."); }
    finally { setOcupado(false); }
  }

  const podeAvancar = [f.nome.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.emailContato), f.publico.trim().length >= 8 && f.diferencial.trim().length >= 8, true, true, true][passo];

  return <div className="brand-wizard grid gap-6">
    <div className="brand-progress" aria-label={`Etapa ${passo + 1} de ${PASSOS.length}`}><span style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} /></div>
    <ol className="brand-steps">{PASSOS.map((p, i) => <li key={p} className={i === passo ? "ativo" : i < passo ? "feito" : ""}><span>{i + 1}</span>{p}</li>)}</ol>

    {passo === 0 && <Secao titulo="Comece pelo negócio" descricao="A identidade nasce do que você vende e de quem precisa escolher sua marca.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome da loja"><input className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
        <Campo label="Segmento"><select className={inputClasse} value={f.segmento} onChange={(e) => set("segmento", e.target.value)}>{SEGMENTOS.map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
        <Campo label="Seu e-mail" ajuda="Será seu acesso ao estúdio da marca."><input className={inputClasse} type="email" value={f.emailContato} onChange={(e) => set("emailContato", e.target.value)} /></Campo>
        <Campo label="WhatsApp" ajuda="DDD + número"><input className={inputClasse} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="16 99999-0000" /></Campo>
      </div>
      <Campo label="Slogan atual" ajuda="Opcional. Se ficar vazio, criamos uma assinatura a partir do seu diferencial."><input className={inputClasse} value={f.slogan} onChange={(e) => set("slogan", e.target.value)} /></Campo>
      <Campo label="Instagram" ajuda="Link completo, opcional"><input className={inputClasse} value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/sualoja" /></Campo>
      <Campo label="Plano"><div className="brand-choice-grid three">{([['SITE','Site','Presença digital essencial'],['LOJA','Loja','Operação completa e escalável'],['LOJA_PRO','Loja Pro','Automação e crescimento']] as const).map(([v,t,d]) => <button key={v} type="button" onClick={() => set("plano",v)} className={f.plano === v ? "selecionado" : ""}><strong>{t}</strong><small>{d}</small></button>)}</div></Campo>
    </Secao>}

    {passo === 1 && <Secao titulo="Defina a essência" descricao="Suas respostas orientam cor, tipografia, composição, voz e fotografia.">
      <Campo label="Quem você quer conquistar?" ajuda="Descreva o público com suas palavras."><textarea className={`${inputClasse} h-24 py-3`} value={f.publico} onChange={(e) => set("publico",e.target.value)} placeholder="Ex.: pessoas que valorizam qualidade, praticidade e acabamento..." /></Campo>
      <Campo label="Por que escolher sua marca?" ajuda="Fale do diferencial real, sem frases genéricas."><textarea className={`${inputClasse} h-24 py-3`} value={f.diferencial} onChange={(e) => set("diferencial",e.target.value)} placeholder="Ex.: curadoria própria, produção local e entrega rápida..." /></Campo>
      <Campo label="Personalidade" ajuda="Escolha até três. A primeira define a direção principal."><div className="brand-choice-grid three">{PERSONALIDADES.map(([v,n]) => <button type="button" key={v} onClick={() => alternarPersonalidade(v)} className={f.personalidade.includes(v) ? "selecionado" : ""}><strong>{n}</strong></button>)}</div></Campo>
      <Campo label="Tom de voz"><div className="brand-choice-grid two">{VOZES.map(([v,n,d]) => <button type="button" key={v} onClick={() => set("tomDeVoz",v)} className={f.tomDeVoz === v ? "selecionado" : ""}><strong>{n}</strong><small>{d}</small></button>)}</div></Campo>
      <div className="grid gap-4 sm:grid-cols-2"><Campo label="Objetivo principal"><select className={inputClasse} value={f.objetivo} onChange={(e) => set("objetivo",e.target.value)}><option value="vender">Vender agora</option><option value="posicionar">Fortalecer a marca</option><option value="captar">Gerar contatos</option><option value="lancar">Lançar novidade</option></select></Campo><Campo label="Fotografia"><select className={inputClasse} value={f.estiloFotografico} onChange={(e) => set("estiloFotografico",e.target.value)}>{FOTOS.map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></Campo></div>
    </Secao>}

    {passo === 2 && <section className="brand-direction" style={{ "--brand-primary": direcao.tema.corPrimaria, "--brand-support": direcao.identidade.corApoio, "--brand-bg": direcao.tema.corFundo, "--brand-fg": direcao.tema.corTexto } as React.CSSProperties}>
      <div className="brand-direction-copy"><span>Direção visual gerada</span><h2>{f.nome || "Sua marca"}</h2><p>{f.slogan || direcao.identidade.assinatura}</p><div className="brand-keywords">{direcao.identidade.palavrasChave.map((x) => <em key={x}>{x}</em>)}</div></div>
      <div className="brand-preview"><div className="brand-preview-bar"><i /><span>{f.nome || "Sua marca"}</span><b>Menu</b></div><div className="brand-preview-hero"><small>NOVA COLEÇÃO</small><strong>{f.slogan || direcao.identidade.assinatura}</strong><button type="button">Conhecer produtos</button></div><div className="brand-preview-products"><i /><i /><i /></div></div>
      <div className="brand-specs"><div><small>Paleta</small><p><i style={{ background: direcao.tema.corPrimaria }} /><i style={{ background: direcao.identidade.corApoio }} /><i style={{ background: direcao.tema.corFundo }} /></p></div><div><small>Tipografia e layout</small><strong>{direcao.tema.fonte} · {direcao.tema.layout}</strong></div><div><small>Direção fotográfica</small><strong>{direcao.identidade.direcaoFotografica}</strong></div></div>
      <p className="brand-note">Aplicaremos esta direção à vitrine, aos componentes da loja e às comunicações. Você poderá refiná-la no painel.</p>
    </section>}

    {passo === 3 && <Secao titulo="Operação e presença" descricao="Informações usadas em contato, retirada, entrega e presença local.">
      <div className="grid gap-4 sm:grid-cols-3"><Campo label="CEP"><input className={inputClasse} value={f.cep} onChange={(e) => set("cep",e.target.value)} onBlur={(e) => buscarCep(e.target.value)} inputMode="numeric" /></Campo><Campo label="Cidade"><input className={inputClasse} value={f.cidade} onChange={(e) => set("cidade",e.target.value)} /></Campo><Campo label="UF"><input className={inputClasse} value={f.uf} maxLength={2} onChange={(e) => set("uf",e.target.value.toUpperCase())} /></Campo></div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]"><Campo label="Rua"><input className={inputClasse} value={f.logradouro} onChange={(e) => set("logradouro",e.target.value)} /></Campo><Campo label="Número"><input className={inputClasse} value={f.numero} onChange={(e) => set("numero",e.target.value)} /></Campo><Campo label="Bairro"><input className={inputClasse} value={f.bairro} onChange={(e) => set("bairro",e.target.value)} /></Campo></div>
      <Campo label="Horário de atendimento"><input className={inputClasse} value={f.horario} onChange={(e) => set("horario",e.target.value)} placeholder="Seg a Sex 8h–18h" /></Campo>
      <div className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.retiradaNaLoja} onChange={(e) => set("retiradaNaLoja",e.target.checked)} /> Cliente pode retirar na loja</label><Campo label="Despacho em dias úteis"><input className={inputClasse} type="number" min={0} max={30} value={f.despachoDiasUteis} onChange={(e) => set("despachoDiasUteis",e.target.value)} /></Campo></div>
      <Campo label="Domínio próprio" ajuda="Opcional. O endereço provisório funciona imediatamente."><input className={inputClasse} value={f.dominioPrincipal} onChange={(e) => set("dominioPrincipal",e.target.value)} placeholder="sualoja.com.br" /></Campo>
    </Secao>}

    {passo === 4 && <><Secao titulo="Catálogo" descricao="Importe o que você realmente vende. Não criamos produtos fictícios."><p className="text-xs text-muted-foreground">CSV: <code>nome, preco, categoria, marca, sku, preco_de, descricao_curta, descricao, imagem, destaque, peso_kg</code>.</p><input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0]?.text().then((t) => setCsv({ nome: e.target.files![0].name, ...lerCsvProdutos(t) }))} className="text-sm" />{csv && <div className="rounded-lg border border-border p-3 text-sm"><p><strong>{csv.nome}</strong>: {csv.produtos.length} produto(s) prontos.</p>{csv.erros.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">{csv.erros.slice(0,5).map((x) => <li key={x}>{x}</li>)}</ul>}</div>}</Secao><Secao titulo="Acesso ao estúdio" descricao={`Login: ${f.emailContato || "seu e-mail"}`}><div className="grid gap-4 sm:grid-cols-2"><Campo label="Senha" ajuda="Mínimo 8 caracteres"><input className={inputClasse} type="password" value={f.senha} onChange={(e) => set("senha",e.target.value)} /></Campo><Campo label="Repita a senha"><input className={inputClasse} type="password" value={f.senha2} onChange={(e) => set("senha2",e.target.value)} /></Campo></div></Secao></>}

    {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    <div className="flex justify-between"><button type="button" className="btn-secundario" disabled={passo === 0 || ocupado} onClick={() => { setErro(null); setPasso((p) => p - 1); }}>Voltar</button>{passo < PASSOS.length - 1 ? <button type="button" className="btn-primario" disabled={!podeAvancar} onClick={() => { setErro(null); setPasso((p) => p + 1); }}>Continuar</button> : <button type="button" className="btn-primario" disabled={ocupado} onClick={criar}>{ocupado ? "Construindo sua marca…" : "Publicar minha loja"}</button>}</div>
  </div>;
}
