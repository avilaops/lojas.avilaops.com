"use client";

import { useMemo, useRef, useState } from "react";
import { Campo, Secao, inputClasse, lerCsvProdutos } from "./campos";
import { criarDirecaoVisual, PERSONALIDADES, SEGMENTOS, type DiagnosticoMarca, type IdentidadeLoja } from "@/lib/identidade";

const PASSOS = ["Negócio", "Essência", "Direção de marca", "Operação", "Catálogo e acesso"] as const;
const TEMPO_PASSO = ["2 min", "3 min", "1 min", "2 min", "2 min"] as const;
const VOZES = [["direto", "Direto", "Claro, breve e orientado à ação."], ["proximo", "Próximo", "Humano, simples e acolhedor."], ["especialista", "Especialista", "Seguro, didático e preciso."], ["inspirador", "Inspirador", "Aspiracional, sensorial e positivo."]] as const;
const FOTOS = [["produto", "Produto"], ["editorial", "Editorial"], ["lifestyle", "Em uso"], ["natural", "Natural"], ["tecnico", "Técnico"]] as const;
const PLANOS = [["SITE", "Site", "Presença digital essencial"], ["LOJA", "Loja", "Operação completa e escalável"], ["LOJA_PRO", "Loja Pro", "Automação e crescimento"]] as const;

type Personalidade = IdentidadeLoja["personalidade"][number];
type CampoId = "nome" | "emailContato" | "whatsapp" | "instagram" | "publico" | "diferencial" | "cep" | "uf" | "despachoDiasUteis" | "dominioPrincipal" | "senha" | "senha2" | "produtos";
type ErrosCampos = Partial<Record<CampoId, string>>;
type DetalheApi = { campo?: string; rotulo?: string; mensagem?: string };

const CAMPO_DO_SERVIDOR: Record<string, CampoId> = {
  nome: "nome", emailContato: "emailContato", whatsapp: "whatsapp", instagram: "instagram",
  cepOrigem: "cep", "endereco.cep": "cep", "endereco.uf": "uf", despachoDiasUteis: "despachoDiasUteis",
  dominioPrincipal: "dominioPrincipal", senha: "senha", produtos: "produtos",
};
const PASSO_DO_CAMPO: Record<CampoId, number> = {
  nome: 0, emailContato: 0, whatsapp: 0, instagram: 0, publico: 1, diferencial: 1,
  cep: 3, uf: 3, despachoDiasUteis: 3, dominioPrincipal: 3, senha: 4, senha2: 4, produtos: 4,
};

function urlValida(valor: string) {
  try { return ["http:", "https:"].includes(new URL(valor).protocol); } catch { return false; }
}

export default function CriarLoja({ planoInicial }: { planoInicial: "SITE" | "LOJA" | "LOJA_PRO" }) {
  const wizardRef = useRef<HTMLDivElement>(null);
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhesErro, setDetalhesErro] = useState<string[]>([]);
  const [errosCampos, setErrosCampos] = useState<ErrosCampos>({});
  const [ocupado, setOcupado] = useState(false);
  const [f, setF] = useState({
    nome: "", slogan: "", whatsapp: "", instagram: "", emailContato: "", plano: planoInicial,
    segmento: "outro" as DiagnosticoMarca["segmento"], publico: "", diferencial: "",
    personalidade: ["sofisticada"] as Personalidade[], tomDeVoz: "direto" as DiagnosticoMarca["tomDeVoz"],
    objetivo: "vender" as DiagnosticoMarca["objetivo"], estiloFotografico: "produto" as DiagnosticoMarca["estiloFotografico"],
    cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "", horario: "",
    retiradaNaLoja: false,
    enderecoPublico: false, despachoDiasUteis: 1 as number | string, dominioPrincipal: "", senha: "", senha2: "",
  });
  const [csv, setCsv] = useState<{ nome: string; produtos: Array<Record<string, unknown>>; erros: string[] } | null>(null);

  const set = (k: keyof typeof f, v: unknown) => {
    setF((a) => ({ ...a, [k]: v }));
    setErrosCampos((atuais) => {
      if (!(k in atuais)) return atuais;
      const proximos = { ...atuais };
      delete proximos[k as CampoId];
      return proximos;
    });
  };
  const diagnostico = useMemo<DiagnosticoMarca>(() => ({ segmento: f.segmento, publico: f.publico, diferencial: f.diferencial, personalidade: f.personalidade, tomDeVoz: f.tomDeVoz, objetivo: f.objetivo, estiloFotografico: f.estiloFotografico }), [f.segmento, f.publico, f.diferencial, f.personalidade, f.tomDeVoz, f.objetivo, f.estiloFotografico]);
  const direcao = useMemo(() => criarDirecaoVisual(diagnostico, f.nome || "Sua marca"), [diagnostico, f.nome]);
  const planoRotulo = PLANOS.find(([valor]) => valor === f.plano)?.[1] ?? "Loja";

  function limparAviso() { setErro(null); setDetalhesErro([]); }
  function propriedadesCampo(campo: CampoId) { return { "aria-invalid": Boolean(errosCampos[campo]) } as const; }

  const [sugerindo, setSugerindo] = useState(false);
  const [origemSugestao, setOrigemSugestao] = useState<string | null>(null);

  /**
   * Preenche as duas respostas de essência. O servidor usa IA quando há chave
   * configurada e cai num rascunho local quando não há — nos dois casos o texto
   * entra como sugestão editável, nunca como verdade sobre o negócio.
   */
  async function sugerirEssenciaIA() {
    if (!f.nome.trim()) return;
    setSugerindo(true);
    try {
      const r = await fetch("/api/painel/sugerir-essencia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome: f.nome, segmento: f.segmento, personalidade: f.personalidade, contexto: [f.publico, f.diferencial].filter(Boolean).join(" | ") || undefined }),
      });
      const d = await r.json();
      if (!r.ok) return;
      setF((a) => ({ ...a, publico: d.publico ?? a.publico, diferencial: d.diferencial ?? a.diferencial }));
      setOrigemSugestao(d.origem === "ia" ? "Rascunho criado com IA — ajuste com suas palavras." : "Rascunho automático — ajuste com suas palavras.");
    } finally {
      setSugerindo(false);
    }
  }

  const botaoSugerir = (
    <button type="button" className="text-[11px] font-semibold uppercase tracking-wide text-primary underline-offset-2 hover:underline disabled:opacity-50" disabled={sugerindo || !f.nome.trim()} onClick={sugerirEssenciaIA}>
      {sugerindo ? "escrevendo…" : "✦ preencher com IA"}
    </button>
  );

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

  function validarEtapa(indice: number): ErrosCampos {
    const erros: ErrosCampos = {};
    if (indice === 0) {
      if (f.nome.trim().length < 2) erros.nome = "Informe o nome da loja com pelo menos 2 caracteres.";
      if (!/^\S+@\S+\.\S+$/.test(f.emailContato)) erros.emailContato = "Informe um e-mail válido. Ele será usado para entrar no estúdio.";
      const whatsapp = f.whatsapp.replace(/\D/g, "");
      if (!whatsapp) erros.whatsapp = "Informe o WhatsApp da loja: é por ele que avisamos pedido pago e falamos com você.";
      else if (![10, 11, 12, 13].includes(whatsapp.length)) erros.whatsapp = "Use DDD + número, por exemplo: (16) 99999-0000.";
      if (f.instagram && !urlValida(f.instagram)) erros.instagram = "Informe o link completo, começando por https://.";
    }
    if (indice === 1) {
      if (f.publico.trim().length < 8) erros.publico = "Conte um pouco mais sobre quem você quer conquistar (mínimo de 8 caracteres).";
      if (f.diferencial.trim().length < 8) erros.diferencial = "Explique o principal motivo para o cliente escolher sua marca (mínimo de 8 caracteres).";
    }
    if (indice === 3) {
      const cep = f.cep.replace(/\D/g, "");
      if (cep && cep.length !== 8) erros.cep = "O CEP deve ter 8 números.";
      if (f.uf && f.uf.trim().length !== 2) erros.uf = "Use a sigla com 2 letras, por exemplo: SP.";
      const dias = Number(f.despachoDiasUteis);
      if (!Number.isInteger(dias) || dias < 0 || dias > 30) erros.despachoDiasUteis = "Informe um prazo entre 0 e 30 dias úteis.";
      if (f.dominioPrincipal && (!f.dominioPrincipal.includes(".") || /\s/.test(f.dominioPrincipal))) erros.dominioPrincipal = "Informe somente o domínio, por exemplo: sualoja.com.br.";
    }
    if (indice === 4) {
      if (f.senha.length < 8) erros.senha = "Crie uma senha com pelo menos 8 caracteres.";
      if (f.senha !== f.senha2) erros.senha2 = "As duas senhas precisam ser iguais.";
    }
    return erros;
  }

  function mostrarErros(erros: ErrosCampos) {
    const mensagens = Object.values(erros).filter((x): x is string => Boolean(x));
    setErrosCampos((atuais) => ({ ...atuais, ...erros }));
    setErro(mensagens.length === 1 ? "Falta corrigir uma informação para continuar." : `Faltam corrigir ${mensagens.length} informações para continuar.`);
    setDetalhesErro(mensagens);
    window.setTimeout(() => {
      const primeiro = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      primeiro?.scrollIntoView({ behavior: "smooth", block: "center" });
      primeiro?.focus({ preventScroll: true });
    }, 50);
  }

  function rolarParaEtapa() {
    window.setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }

  function avancar() {
    limparAviso();
    const erros = validarEtapa(passo);
    if (Object.keys(erros).length) return mostrarErros(erros);
    setPasso((atual) => Math.min(atual + 1, PASSOS.length - 1));
    rolarParaEtapa();
  }

  function voltar() {
    limparAviso();
    setPasso((atual) => Math.max(0, atual - 1));
    rolarParaEtapa();
  }

  async function criar() {
    limparAviso();
    const erros = validarEtapa(4);
    if (Object.keys(erros).length) return mostrarErros(erros);
    setOcupado(true);
    try {
      const r = await fetch("/api/painel/criar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        nome: f.nome, slogan: f.slogan || direcao.identidade.assinatura, whatsapp: f.whatsapp, instagram: f.instagram || undefined,
        emailContato: f.emailContato, senha: f.senha, plano: f.plano, identidade: direcao.identidade, tema: direcao.tema,
        endereco: { cep: f.cep || undefined, logradouro: f.logradouro || undefined, numero: f.numero || undefined, bairro: f.bairro || undefined, cidade: f.cidade || undefined, uf: f.uf || undefined },
        cepOrigem: f.cep || undefined, horario: f.horario || undefined, retiradaNaLoja: f.retiradaNaLoja, enderecoPublico: f.enderecoPublico, despachoDiasUteis: Number(f.despachoDiasUteis),
        dominioPrincipal: f.dominioPrincipal || undefined, produtos: csv?.produtos ?? [],
      }) });
      const d = await r.json();
      if (!r.ok) {
        const camposApi = Array.isArray(d?.campos) ? d.campos as DetalheApi[] : [];
        if (camposApi.length) {
          const errosApi: ErrosCampos = {};
          for (const item of camposApi) {
            const campo = item.campo ? CAMPO_DO_SERVIDOR[item.campo] : undefined;
            if (campo) errosApi[campo] = item.mensagem || `Revise ${item.rotulo?.toLowerCase() ?? "esta informação"}.`;
          }
          const passos = Object.keys(errosApi).map((campo) => PASSO_DO_CAMPO[campo as CampoId]);
          if (passos.length) setPasso(Math.min(...passos));
          setErrosCampos((atuais) => ({ ...atuais, ...errosApi }));
          setDetalhesErro(camposApi.map((item) => `${item.rotulo ?? "Informação"}: ${item.mensagem ?? "revise o valor informado"}`));
          setErro(d?.erro ?? "Algumas informações precisam ser corrigidas.");
        } else {
          if (r.status === 409) {
            setErro(`${d?.erro ?? "Já existe uma loja com este e-mail."} Vamos te levar para a entrada.`);
            setTimeout(() => window.location.assign("/entrar"), 2500);
            return;
          }
          setErro(d?.erro ?? "Não foi possível criar a loja.");
          setDetalhesErro([]);
        }
        return;
      }
      // Navegação dura: imune a version skew (um deploy com a aba aberta troca os
      // IDs de chunk/Server Action e derrubaria um router.push).
      window.location.assign("/painel?nova=1");
    } catch {
      // A loja pode ter sido criada mesmo com a resposta se perdendo no caminho.
      // Antes de acusar erro (e induzir a pessoa a tentar de novo), perguntamos.
      const sessao = await fetch("/api/painel/sessao").then((x) => x.json()).catch(() => null);
      if (sessao?.logado) return window.location.assign("/painel?nova=1");
      setErro("Não conseguimos falar com o servidor agora. Seus dados continuam nesta tela; tente novamente em instantes.");
      setDetalhesErro([]);
    } finally { setOcupado(false); }
  }

  const rotuloContinuar = passo === 0 ? "Continuar para a essência" : passo === 1 ? "Gerar direção da marca" : passo === 2 ? "Aprovar esta direção" : "Revisar e publicar";

  return <div ref={wizardRef} className="brand-wizard grid gap-6">
    <div className="brand-progress-meta"><div><span>Etapa {passo + 1} de {PASSOS.length}</span><strong>{PASSOS[passo]}</strong></div><small>cerca de {TEMPO_PASSO[passo]}</small></div>
    <div className="brand-progress" aria-label={`Etapa ${passo + 1} de ${PASSOS.length}`}><span style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} /></div>
    <ol className="brand-steps">{PASSOS.map((p, i) => <li key={p} className={i === passo ? "ativo" : i < passo ? "feito" : ""}><button type="button" disabled={i > passo} onClick={() => { limparAviso(); setPasso(i); rolarParaEtapa(); }} aria-current={i === passo ? "step" : undefined}><span>{i < passo ? "✓" : i + 1}</span><em>{p}</em></button></li>)}</ol>

    {passo === 0 && <Secao titulo="Comece pelo negócio" descricao="Primeiro, precisamos saber como sua marca será apresentada e como você entrará no estúdio.">
      <p className="brand-required-note"><b>*</b> Informações necessárias para continuar. As demais podem ser preenchidas depois.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome da loja" obrigatorio erro={errosCampos.nome}><input {...propriedadesCampo("nome")} className={inputClasse} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Como seus clientes conhecem a marca" autoComplete="organization" /></Campo>
        <Campo label="Segmento"><select className={inputClasse} value={f.segmento} onChange={(e) => set("segmento", e.target.value)}>{SEGMENTOS.map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></Campo>
        <Campo label="Seu e-mail" obrigatorio erro={errosCampos.emailContato} ajuda="Será seu login no estúdio da marca."><input {...propriedadesCampo("emailContato")} className={inputClasse} type="email" value={f.emailContato} onChange={(e) => set("emailContato", e.target.value)} placeholder="voce@empresa.com.br" autoComplete="email" /></Campo>
        <Campo label="WhatsApp *" erro={errosCampos.whatsapp} ajuda="É por ele que você recebe aviso de pedido pago. DDD + número; o +55 é adicionado automaticamente."><input {...propriedadesCampo("whatsapp")} className={inputClasse} type="tel" inputMode="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(16) 99999-0000" autoComplete="tel" /></Campo>
      </div>
      <Campo label="Slogan atual" ajuda="Opcional. Se ficar vazio, criaremos uma assinatura a partir do seu diferencial."><input className={inputClasse} value={f.slogan} maxLength={140} onChange={(e) => set("slogan", e.target.value)} placeholder="Se sua marca já usa uma frase, escreva aqui" /></Campo>
      <Campo label="Instagram" erro={errosCampos.instagram} ajuda="Opcional. Use o link completo do perfil."><input {...propriedadesCampo("instagram")} className={inputClasse} type="url" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="https://instagram.com/sualoja" /></Campo>
      <Campo label="Plano"><div className="brand-choice-grid three">{PLANOS.map(([v,t,d]) => <button key={v} type="button" onClick={() => set("plano",v)} className={f.plano === v ? "selecionado" : ""} aria-pressed={f.plano === v}><strong>{t}{v === "LOJA" && <i>Recomendado</i>}</strong><small>{d}</small></button>)}</div></Campo>
    </Secao>}

    {passo === 1 && <Secao titulo="Defina a essência" descricao="Não precisa escrever como publicitário. Responda com suas palavras e nós transformamos isso em direção de marca.">
      <Campo label="Quem você quer conquistar?" acao={botaoSugerir} obrigatorio erro={errosCampos.publico} ajuda={`${f.publico.length}/240 · Ex.: pessoas que valorizam praticidade, qualidade e bom atendimento.`}><textarea {...propriedadesCampo("publico")} className={`${inputClasse} h-24 py-3`} value={f.publico} maxLength={240} onChange={(e) => set("publico",e.target.value)} placeholder="Quem costuma comprar de você e o que essa pessoa valoriza?" /></Campo>
      <Campo label="Por que escolher sua marca?" acao={botaoSugerir} obrigatorio erro={errosCampos.diferencial} ajuda={`${f.diferencial.length}/300 · Pode ser atendimento, curadoria, prazo, qualidade ou especialização.`}><textarea {...propriedadesCampo("diferencial")} className={`${inputClasse} h-24 py-3`} value={f.diferencial} maxLength={300} onChange={(e) => set("diferencial",e.target.value)} placeholder="O que você faz melhor ou de um jeito diferente?" /></Campo>
      {origemSugestao && <p className="rounded-lg bg-primary/10 p-3 text-xs">{origemSugestao}</p>}
      <Campo label="Personalidade" ajuda="Escolha até três. A primeira selecionada define a direção principal."><div className="brand-choice-grid three">{PERSONALIDADES.map(([v,n]) => <button type="button" key={v} aria-label={n} onClick={() => alternarPersonalidade(v)} className={f.personalidade.includes(v) ? "selecionado" : ""} aria-pressed={f.personalidade.includes(v)}><strong>{n}</strong></button>)}</div></Campo>
      <Campo label="Tom de voz"><div className="brand-choice-grid two">{VOZES.map(([v,n,d]) => <button type="button" key={v} onClick={() => set("tomDeVoz",v)} className={f.tomDeVoz === v ? "selecionado" : ""} aria-pressed={f.tomDeVoz === v}><strong>{n}</strong><small>{d}</small></button>)}</div></Campo>
      <div className="grid gap-4 sm:grid-cols-2"><Campo label="Objetivo principal"><select className={inputClasse} value={f.objetivo} onChange={(e) => set("objetivo",e.target.value)}><option value="vender">Vender agora</option><option value="posicionar">Fortalecer a marca</option><option value="captar">Gerar contatos</option><option value="lancar">Lançar novidade</option></select></Campo><Campo label="Estilo das fotos"><select className={inputClasse} value={f.estiloFotografico} onChange={(e) => set("estiloFotografico",e.target.value)}>{FOTOS.map(([v,n]) => <option value={v} key={v}>{n}</option>)}</select></Campo></div>
    </Secao>}

    {passo === 2 && <section className="brand-direction" style={{ "--brand-primary": direcao.tema.corPrimaria, "--brand-support": direcao.identidade.corApoio, "--brand-bg": direcao.tema.corFundo, "--brand-fg": direcao.tema.corTexto } as React.CSSProperties}>
      <div className="brand-direction-copy"><span>Direção visual gerada</span><h2>{f.nome || "Sua marca"}</h2><p>{f.slogan || direcao.identidade.assinatura}</p><div className="brand-keywords">{direcao.identidade.palavrasChave.map((x) => <em key={x}>{x}</em>)}</div></div>
      <div className="brand-preview"><div className="brand-preview-bar"><i /><span>{f.nome || "Sua marca"}</span><b>Menu</b></div><div className="brand-preview-hero"><small>NOVA COLEÇÃO</small><strong>{f.slogan || direcao.identidade.assinatura}</strong><button type="button">Conhecer produtos</button></div><div className="brand-preview-products"><i /><i /><i /></div></div>
      <div className="brand-specs"><div><small>Paleta</small><p><i style={{ background: direcao.tema.corPrimaria }} /><i style={{ background: direcao.identidade.corApoio }} /><i style={{ background: direcao.tema.corFundo }} /></p></div><div><small>Tipografia e layout</small><strong>{direcao.tema.fonte} · {direcao.tema.layout}</strong></div><div><small>Direção fotográfica</small><strong>{direcao.identidade.direcaoFotografica}</strong></div></div>
      <p className="brand-note">Esta é a primeira direção, não uma decisão definitiva. Depois de publicar, você poderá refinar cores, tipografia e composição no estúdio.</p>
    </section>}

    {passo === 3 && <Secao titulo="Operação e presença" descricao="Tudo nesta etapa é opcional agora. Use apenas o que fizer sentido para retirada, entrega ou presença local.">
      <div className="brand-optional-note"><span>Você pode completar depois</span><p>Se deixar o endereço vazio, a loja será publicada normalmente com um endereço provisório.</p></div>
      <div className="grid gap-4 sm:grid-cols-3"><Campo label="CEP de origem" erro={errosCampos.cep} ajuda="Opcional, usado só para calcular o frete. Ao sair do campo, buscamos o endereço."><input {...propriedadesCampo("cep")} className={inputClasse} value={f.cep} onChange={(e) => set("cep",e.target.value)} onBlur={(e) => buscarCep(e.target.value)} inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" /></Campo><Campo label="Cidade"><input className={inputClasse} value={f.cidade} onChange={(e) => set("cidade",e.target.value)} autoComplete="address-level2" /></Campo><Campo label="UF" erro={errosCampos.uf}><input {...propriedadesCampo("uf")} className={inputClasse} value={f.uf} maxLength={2} onChange={(e) => set("uf",e.target.value.toUpperCase())} placeholder="SP" autoComplete="address-level1" /></Campo></div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]"><Campo label="Rua"><input className={inputClasse} value={f.logradouro} onChange={(e) => set("logradouro",e.target.value)} autoComplete="street-address" /></Campo><Campo label="Número"><input className={inputClasse} value={f.numero} onChange={(e) => set("numero",e.target.value)} /></Campo><Campo label="Bairro"><input className={inputClasse} value={f.bairro} onChange={(e) => set("bairro",e.target.value)} /></Campo></div>
      <Campo label="Horário de atendimento" ajuda="Como aparecerá para o cliente."><input className={inputClasse} value={f.horario} maxLength={140} onChange={(e) => set("horario",e.target.value)} placeholder="Segunda a sexta, das 8h às 18h" /></Campo>
      <div className="grid gap-4 sm:grid-cols-2"><label className="brand-checkbox"><input type="checkbox" checked={f.retiradaNaLoja} onChange={(e) => { set("retiradaNaLoja", e.target.checked); if (e.target.checked) set("enderecoPublico", true); }} /><span><strong>Permitir retirada na loja</strong><small>Só marque se você atende no balcão — exige mostrar o endereço.</small></span></label>
        <label className="brand-checkbox"><input type="checkbox" checked={f.enderecoPublico} onChange={(e) => set("enderecoPublico", e.target.checked)} /><span><strong>Exibir endereço no site</strong><small>Desligado por padrão. Loja só online não precisa mostrar onde fica o estoque.</small></span></label><Campo label="Despacho em dias úteis" erro={errosCampos.despachoDiasUteis} ajuda="Quanto tempo você precisa para preparar o pedido."><input {...propriedadesCampo("despachoDiasUteis")} className={inputClasse} type="number" min={0} max={30} value={f.despachoDiasUteis} onChange={(e) => set("despachoDiasUteis",e.target.value)} /></Campo></div>
      <Campo label="Domínio próprio" erro={errosCampos.dominioPrincipal} ajuda="Opcional. Não use https://. O endereço provisório funciona imediatamente."><input {...propriedadesCampo("dominioPrincipal")} className={inputClasse} value={f.dominioPrincipal} onChange={(e) => set("dominioPrincipal",e.target.value.toLowerCase())} placeholder="sualoja.com.br" autoCapitalize="none" /></Campo>
    </Secao>}

    {passo === 4 && <>
      <section className="brand-review" aria-label="Resumo antes da publicação"><div><span>Marca</span><strong>{f.nome}</strong><small>{f.segmento}</small></div><div><span>Plano</span><strong>{planoRotulo}</strong><small>{f.dominioPrincipal || "Endereço provisório incluso"}</small></div><div><span>Operação</span><strong>{f.cidade || "Completar depois"}</strong><small>{f.retiradaNaLoja ? "Retirada habilitada" : "Sem retirada local"}</small></div><div><span>Catálogo</span><strong>{csv ? `${csv.produtos.length} produto(s)` : "Adicionar depois"}</strong><small>{csv ? csv.nome : "A loja pode nascer vazia"}</small></div></section>
      <Secao titulo="Catálogo — opcional agora" descricao="Você pode publicar sem produtos e montar o catálogo depois no estúdio.">
        <div className="brand-catalog-actions"><label className="brand-file"><input type="file" accept=".csv,text/csv" onChange={(e) => { const arquivo = e.target.files?.[0]; if (!arquivo) return; arquivo.text().then((texto) => { setCsv({ nome: arquivo.name, ...lerCsvProdutos(texto) }); setErrosCampos((atuais) => ({ ...atuais, produtos: undefined })); }); }} /><span>{csv ? "Trocar planilha" : "Escolher planilha CSV"}</span><small>{csv ? csv.nome : "Arraste ou selecione o arquivo exportado da sua planilha"}</small></label><a href="/media/modelo-catalogo.csv" download>Baixar planilha modelo</a></div>
        {csv && <div className={`brand-csv-result ${csv.erros.length ? "com-aviso" : ""}`}><p><strong>{csv.produtos.length} produto(s) prontos para importar.</strong>{csv.erros.length ? ` ${csv.erros.length} linha(s) serão ignoradas até serem corrigidas.` : " A planilha está pronta."}</p>{csv.erros.length > 0 && <ul>{csv.erros.slice(0,5).map((x) => <li key={x}>{x}</li>)}</ul>}</div>}
        <details className="brand-csv-help"><summary>Quais colunas a planilha aceita?</summary><p><code>nome</code> e <code>preco</code> são obrigatórios. Também aceitamos categoria, marca, sku, preço anterior, descrições, imagem, destaque e peso.</p></details>
      </Secao>
      <Secao titulo="Crie seu acesso ao estúdio" descricao={`Você entrará com ${f.emailContato}. A senha não será exibida nem enviada por e-mail.`}><div className="grid gap-4 sm:grid-cols-2"><Campo label="Senha" obrigatorio erro={errosCampos.senha} ajuda="Use pelo menos 8 caracteres."><input {...propriedadesCampo("senha")} className={inputClasse} type="password" value={f.senha} onChange={(e) => set("senha",e.target.value)} autoComplete="new-password" /></Campo><Campo label="Repita a senha" obrigatorio erro={errosCampos.senha2} ajuda={f.senha2 && f.senha === f.senha2 ? "As senhas conferem." : "Digite a mesma senha novamente."}><input {...propriedadesCampo("senha2")} className={inputClasse} type="password" value={f.senha2} onChange={(e) => set("senha2",e.target.value)} autoComplete="new-password" /></Campo></div></Secao>
    </>}

    {erro && <div className="brand-alert" role="alert" aria-live="assertive"><span>!</span><div><strong>{erro}</strong>{detalhesErro.length > 0 && <ul>{detalhesErro.map((detalhe) => <li key={detalhe}>{detalhe}</li>)}</ul>}</div></div>}
    <div className="brand-actions"><button type="button" className="btn-secundario" disabled={passo === 0 || ocupado} onClick={voltar}>Voltar</button>{passo < PASSOS.length - 1 ? <button type="button" className="btn-primario" disabled={ocupado} onClick={avancar}>{rotuloContinuar} <span aria-hidden="true">→</span></button> : <button type="button" className="btn-primario" disabled={ocupado} onClick={criar}>{ocupado ? "Criando sua loja…" : "Criar e publicar minha loja"}</button>}</div>
  </div>;
}
