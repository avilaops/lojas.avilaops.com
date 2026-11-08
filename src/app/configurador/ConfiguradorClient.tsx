"use client";

import type { FormEvent } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Box, CheckCircle2, Rotate3D } from "lucide-react";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { armazenamentoLocalSeguro, lerUltimoCodigoRetomada, salvarUltimoCodigoRetomada } from "@/lib/configurador-retomada";
import { DIMENSAO_LOGO_SOB_MEDIDA, IdentidadeSobMedidaSchema, LIMITES_EDITOR_SOB_MEDIDA, OPCOES_CONFIGURADOR, resumoDaConfiguracao, type ConfiguracaoSobMedida } from "@/lib/configurador-sob-medida";
import { configuracaoParaThermalBoxVisual } from "@/lib/configurador-visual";

const INICIAL: ConfiguracaoSobMedida = {
  dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
  materialExterno: "aco_galvanizado",
  acabamento: "pintura_eletrostatica",
  tampa: "superior",
  mobilidade: "rodizios",
  divisorias: 0,
  quantidade: 1,
  observacoes: "",
};

type Resposta = { referencia: string; criadoEm: string; codigoRetomada: string };
type RespostaRetomada = { referencia: string; contratoVersao: number; configuracao: ConfiguracaoSobMedida };
const ThermalBoxViewerView = dynamic(
  () => import("@avilaops/gerador-3d/thermal-box/react").then((modulo) => modulo.ThermalBoxViewerView),
  { ssr: false, loading: () => <div className="configurador-3d-carregando" role="status">Carregando visualização 3D…</div> },
);

function Opcoes({ valores }: { valores: Record<string, string> }) {
  return Object.entries(valores).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>);
}

function assinarMudancasNoStorage(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

function codigoSalvoNoNavegador(slug: string): string | null {
  const armazenamento = armazenamentoLocalSeguro(window);
  return armazenamento ? lerUltimoCodigoRetomada(slug, armazenamento) : null;
}

function salvarCodigoNoNavegador(slug: string, codigo: string): void {
  const armazenamento = armazenamentoLocalSeguro(window);
  if (armazenamento) salvarUltimoCodigoRetomada(slug, codigo, armazenamento);
}

async function prepararLogo(arquivo: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024) {
    throw new Error("Escolha uma imagem PNG, JPG ou WebP de até 5 MB.");
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const canvas = document.createElement("canvas");
    const contexto = canvas.getContext("2d");
    if (!contexto) throw new Error("Não foi possível preparar a imagem.");
    for (const limite of [DIMENSAO_LOGO_SOB_MEDIDA, 160]) {
      const escala = Math.min(1, limite / Math.max(imagem.naturalWidth, imagem.naturalHeight));
      canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
      canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      const logo = canvas.toDataURL("image/webp", 0.85);
      if (IdentidadeSobMedidaSchema.safeParse({ logo }).success) return logo;
    }
    throw new Error("Não foi possível preparar a imagem.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ConfiguradorClient({ nomeDaLoja, slugDaLoja, whatsapp }: { nomeDaLoja: string; slugDaLoja: string; whatsapp: string | null }) {
  const [configuracao, setConfiguracao] = useState(INICIAL);
  const [contato, setContato] = useState({ nome: "", email: "", telefone: "", consentimento: false });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [codigoRetomadaOrigem, setCodigoRetomadaOrigem] = useState("");
  const [retomando, setRetomando] = useState(false);
  const [mensagemRetomada, setMensagemRetomada] = useState("");
  const [processandoLogo, setProcessandoLogo] = useState(false);
  const [erroLogo, setErroLogo] = useState("");

  const codigoSalvo = useSyncExternalStore(
    assinarMudancasNoStorage,
    () => codigoSalvoNoNavegador(slugDaLoja),
    () => null,
  );
  const codigoRetomada = codigoDigitado || codigoSalvo || "";

  const resumo = useMemo(() => resumoDaConfiguracao(configuracao), [configuracao]);
  const visualConfig = useMemo(() => configuracaoParaThermalBoxVisual(configuracao), [configuracao]);
  const identidade = configuracao.identidadeVisual;

  function editarIdentidade(campo: "cor" | "logo", valor: string | undefined) {
    setResposta(null);
    setConfiguracao((atual) => {
      const identidadeVisual = { ...atual.identidadeVisual, [campo]: valor };
      return { ...atual, identidadeVisual: identidadeVisual.cor || identidadeVisual.logo ? identidadeVisual : undefined };
    });
  }

  async function selecionarLogo(arquivo: File) {
    setProcessandoLogo(true);
    setErroLogo("");
    try {
      editarIdentidade("logo", await prepararLogo(arquivo));
    } catch {
      setErroLogo("Não foi possível usar esta imagem. Escolha um arquivo PNG, JPG ou WebP de até 5 MB.");
    } finally {
      setProcessandoLogo(false);
    }
  }

  function dimensao(campo: keyof ConfiguracaoSobMedida["dimensoes"], valor: string) {
    setResposta(null);
    setConfiguracao((atual) => ({ ...atual, dimensoes: { ...atual.dimensoes, [campo]: Number(valor) } }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setErro("");
    setResposta(null);
    try {
      const requisicao = await fetch("/api/configurador", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ configuracao, ...contato, codigoRetomadaOrigem: codigoRetomadaOrigem || undefined }),
      });
      const corpo = await requisicao.json().catch(() => ({}));
      if (!requisicao.ok) throw new Error(corpo.erro ?? "Não foi possível enviar a solicitação.");
      const recebida = corpo as Resposta;
      setResposta(recebida);
      setCodigoDigitado(recebida.codigoRetomada);
      setCodigoRetomadaOrigem(recebida.codigoRetomada);
      salvarCodigoNoNavegador(slugDaLoja, recebida.codigoRetomada);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível enviar a solicitação.");
    } finally {
      setEnviando(false);
    }
  }

  async function retomar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setRetomando(true);
    setErro("");
    setMensagemRetomada("");
    try {
      const requisicao = await fetch("/api/configurador/retomar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigoRetomada }),
      });
      const corpo = await requisicao.json().catch(() => ({}));
      if (!requisicao.ok) throw new Error(corpo.erro ?? "Não foi possível retomar a configuração.");
      const retomada = corpo as RespostaRetomada;
      setConfiguracao(retomada.configuracao);
      setErroLogo("");
      setCodigoRetomadaOrigem(codigoRetomada);
      setResposta(null);
      setMensagemRetomada(`Configuração ${retomada.referencia} retomada. Confira a ficha e informe o contato para enviar uma nova solicitação.`);
      salvarCodigoNoNavegador(slugDaLoja, codigoRetomada);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível retomar a configuração.");
    } finally {
      setRetomando(false);
    }
  }

  const mensagemWhatsApp = resposta
    ? `Olá, ${nomeDaLoja}! Enviei a configuração ${resposta.referencia}. ${resumo}`
    : "";

  return (
    <main className="configurador-pagina">
      <header className="configurador-abertura container-loja">
        <p className="configurador-selo"><Box aria-hidden="true" /> Projeto sob medida</p>
        <h1>Desenhe a caixa térmica que sua operação precisa.</h1>
        <p>Ajuste o modelo, confira a ficha e envie para a fábrica analisar. A visualização orienta o orçamento; medidas e viabilidade serão confirmadas pela equipe técnica.</p>
      </header>

      <section className="configurador-retomada container-loja" aria-labelledby="titulo-retomada">
        <div>
          <h2 id="titulo-retomada">Retomar uma configuração</h2>
          <p>Use o código privado recebido no envio anterior. Observações e dados de contato não são recuperados.</p>
        </div>
        <form onSubmit={retomar}>
          <label>Código privado de retomada<input required autoComplete="off" spellCheck={false} value={codigoRetomada} onChange={(evento) => setCodigoDigitado(evento.target.value.trim())} /></label>
          <button className="btn-secundario" type="submit" disabled={retomando || enviando || processandoLogo}>{retomando ? "Retomando…" : "Retomar ficha"}</button>
        </form>
        {mensagemRetomada && <p className="configurador-retomada-status" role="status">{mensagemRetomada}</p>}
      </section>

      <div className="configurador-grade container-loja">
        <section className="configurador-visual" aria-labelledby="titulo-visual">
          <div className="configurador-visual-cabecalho">
            <div><span>Prévia interativa</span><h2 id="titulo-visual">Seu modelo em 3D</h2></div>
            <Rotate3D aria-hidden="true" />
          </div>
          <div className="configurador-palco">
            <ThermalBoxViewerView config={visualConfig} />
          </div>
          <fieldset className="configurador-identidade" disabled={processandoLogo || retomando || enviando}>
            <legend>Identidade visual da sua empresa</legend>
            <p>Envie sua logo para aplicar na frente da caixa e escolha a cor externa. A fábrica confirma o acabamento no orçamento.</p>
            <label>Logo da empresa
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="configurador-logo-ajuda" onChange={(evento) => {
                const arquivo = evento.currentTarget.files?.[0];
                evento.currentTarget.value = "";
                if (arquivo) void selecionarLogo(arquivo);
              }} />
            </label>
            <small id="configurador-logo-ajuda">PNG, JPG ou WebP de até 5 MB.</small>
            {processandoLogo && <p role="status">Preparando logo…</p>}
            {erroLogo && <p role="alert" className="configurador-erro">{erroLogo}</p>}
            {identidade?.logo && <button type="button" className="btn-secundario" onClick={() => {
              editarIdentidade("logo", undefined);
              setErroLogo("");
            }}>Remover logo</button>}
            <div className="configurador-identidade-cor">
              <label>Cor externa<input type="color" value={identidade?.cor ?? "#b8c2cc"} onChange={(evento) => editarIdentidade("cor", evento.target.value)} /></label>
              {identidade?.cor && <button type="button" className="btn-secundario" onClick={() => editarIdentidade("cor", undefined)}>Usar cor do material</button>}
            </div>
          </fieldset>
          <p className="sr-only">Modelo de {resumo}.</p>
          <div className="configurador-resumo"><strong>Ficha atual</strong><p>{resumo}</p>
            {identidade?.cor && <p>Cor externa solicitada: {identidade.cor.toUpperCase()}</p>}
            {identidade?.logo && <p>Logo na frente da caixa</p>}
            <small>Representação conceitual, sem escala de fabricação.</small>
          </div>
        </section>

        <form className="configurador-formulario" onSubmit={enviar}>
          <fieldset>
            <legend>1. Medidas externas</legend>
            <p>Faixa disponível no editor: {LIMITES_EDITOR_SOB_MEDIDA.dimensaoMinimaCm} a {LIMITES_EDITOR_SOB_MEDIDA.dimensaoMaximaCm} cm. A fábrica confirma a viabilidade.</p>
            <div className="configurador-tres-colunas">
              {([['larguraCm', 'Largura'], ['alturaCm', 'Altura'], ['profundidadeCm', 'Profundidade']] as const).map(([campo, rotulo]) => (
                <label key={campo}>{rotulo} (cm)<input required type="number" inputMode="numeric" min={LIMITES_EDITOR_SOB_MEDIDA.dimensaoMinimaCm} max={LIMITES_EDITOR_SOB_MEDIDA.dimensaoMaximaCm} value={configuracao.dimensoes[campo]} onChange={(e) => dimensao(campo, e.target.value)} /></label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>2. Construção</legend>
            <div className="configurador-dois-colunas">
              <label>Material externo<select value={configuracao.materialExterno} onChange={(e) => setConfiguracao((c) => ({ ...c, materialExterno: e.target.value as ConfiguracaoSobMedida['materialExterno'] }))}><Opcoes valores={OPCOES_CONFIGURADOR.materialExterno} /></select></label>
              <label>Acabamento<select value={configuracao.acabamento} onChange={(e) => setConfiguracao((c) => ({ ...c, acabamento: e.target.value as ConfiguracaoSobMedida['acabamento'] }))}><Opcoes valores={OPCOES_CONFIGURADOR.acabamento} /></select></label>
              <label>Abertura<select value={configuracao.tampa} onChange={(e) => setConfiguracao((c) => ({ ...c, tampa: e.target.value as ConfiguracaoSobMedida['tampa'] }))}><Opcoes valores={OPCOES_CONFIGURADOR.tampa} /></select></label>
              <label>Base<select value={configuracao.mobilidade} onChange={(e) => setConfiguracao((c) => ({ ...c, mobilidade: e.target.value as ConfiguracaoSobMedida['mobilidade'] }))}><Opcoes valores={OPCOES_CONFIGURADOR.mobilidade} /></select></label>
              <label>Divisórias<input type="number" min="0" max={LIMITES_EDITOR_SOB_MEDIDA.divisoriasMaximas} value={configuracao.divisorias} onChange={(e) => setConfiguracao((c) => ({ ...c, divisorias: Number(e.target.value) }))} /></label>
              <label>Quantidade<input required type="number" min="1" max={LIMITES_EDITOR_SOB_MEDIDA.quantidadeMaxima} value={configuracao.quantidade} onChange={(e) => setConfiguracao((c) => ({ ...c, quantidade: Number(e.target.value) }))} /></label>
            </div>
            <label>Observações<textarea maxLength={1000} rows={4} placeholder="Uso, ambiente, carga, restrições de acesso ou outros detalhes." value={configuracao.observacoes} onChange={(e) => setConfiguracao((c) => ({ ...c, observacoes: e.target.value }))} /></label>
          </fieldset>

          <fieldset>
            <legend>3. Contato para análise</legend>
            <div className="configurador-dois-colunas">
              <label>Nome<input required minLength={2} maxLength={120} autoComplete="name" value={contato.nome} onChange={(e) => setContato((c) => ({ ...c, nome: e.target.value }))} /></label>
              <label>E-mail<input type="email" maxLength={160} autoComplete="email" value={contato.email} onChange={(e) => setContato((c) => ({ ...c, email: e.target.value }))} /></label>
              <label>Telefone ou WhatsApp<input type="tel" maxLength={24} autoComplete="tel" value={contato.telefone} onChange={(e) => setContato((c) => ({ ...c, telefone: e.target.value }))} /></label>
            </div>
            <p className="configurador-ajuda">Informe e-mail ou telefone para a fábrica responder.</p>
            <label className="configurador-consentimento"><input required type="checkbox" checked={contato.consentimento} onChange={(e) => setContato((c) => ({ ...c, consentimento: e.target.checked }))} /> Autorizo o uso destes dados para analisar e responder esta solicitação. Consulte a <Link href="/politicas/privacidade">política de privacidade</Link>.</label>
          </fieldset>

          {erro && <p className="configurador-erro" role="alert">{erro}</p>}
          {resposta && (
            <div className="configurador-sucesso" role="status">
              <CheckCircle2 aria-hidden="true" /><div><strong>Configuração recebida</strong><p>Referência: <b>{resposta.referencia}</b>.</p><p>Guarde o código privado para retomar esta ficha depois: <code>{resposta.codigoRetomada}</code></p></div>
              {whatsapp && <a href={linkWhatsApp(whatsapp, mensagemWhatsApp)} target="_blank" rel="noopener">Continuar no WhatsApp <ArrowRight aria-hidden="true" /></a>}
            </div>
          )}
          <button className="btn-primario configurador-enviar" type="submit" disabled={enviando || retomando || processandoLogo}>{enviando ? "Enviando…" : "Enviar para análise da fábrica"} <ArrowRight aria-hidden="true" /></button>
        </form>
      </div>
    </main>
  );
}
