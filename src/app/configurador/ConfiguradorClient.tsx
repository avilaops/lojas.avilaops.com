"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Box, CheckCircle2, Rotate3D } from "lucide-react";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { lerUltimoCodigoRetomada, salvarUltimoCodigoRetomada } from "@/lib/configurador-retomada";
import { LIMITES_EDITOR_SOB_MEDIDA, OPCOES_CONFIGURADOR, resumoDaConfiguracao, type ConfiguracaoSobMedida } from "@/lib/configurador-sob-medida";

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
type Variaveis3D = CSSProperties & Record<`--${string}`, string>;

function Opcoes({ valores }: { valores: Record<string, string> }) {
  return Object.entries(valores).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>);
}

function assinarMudancasNoStorage(aoMudar: () => void) {
  window.addEventListener("storage", aoMudar);
  return () => window.removeEventListener("storage", aoMudar);
}

export default function ConfiguradorClient({ nomeDaLoja, slugDaLoja, whatsapp }: { nomeDaLoja: string; slugDaLoja: string; whatsapp: string | null }) {
  const [configuracao, setConfiguracao] = useState(INICIAL);
  const [rotacao, setRotacao] = useState({ x: -18, y: 32 });
  const [contato, setContato] = useState({ nome: "", email: "", telefone: "", consentimento: false });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [codigoRetomadaOrigem, setCodigoRetomadaOrigem] = useState("");
  const [retomando, setRetomando] = useState(false);
  const [mensagemRetomada, setMensagemRetomada] = useState("");

  const codigoSalvo = useSyncExternalStore(
    assinarMudancasNoStorage,
    () => lerUltimoCodigoRetomada(slugDaLoja, window.localStorage),
    () => null,
  );
  const codigoRetomada = codigoDigitado || codigoSalvo || "";

  const resumo = useMemo(() => resumoDaConfiguracao(configuracao), [configuracao]);
  const visual = useMemo<Variaveis3D>(() => {
    const { larguraCm, alturaCm, profundidadeCm } = configuracao.dimensoes;
    const maior = Math.max(larguraCm, alturaCm, profundidadeCm);
    const escala = 190 / maior;
    return {
      "--box-w": `${Math.max(68, larguraCm * escala)}px`,
      "--box-h": `${Math.max(58, alturaCm * escala)}px`,
      "--box-d": `${Math.max(68, profundidadeCm * escala)}px`,
      "--box-rx": `${rotacao.x}deg`,
      "--box-ry": `${rotacao.y}deg`,
    };
  }, [configuracao.dimensoes, rotacao]);

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
      salvarUltimoCodigoRetomada(slugDaLoja, recebida.codigoRetomada, window.localStorage);
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
      setCodigoRetomadaOrigem(codigoRetomada);
      setResposta(null);
      setMensagemRetomada(`Configuração ${retomada.referencia} retomada. Confira a ficha e informe o contato para enviar uma nova solicitação.`);
      salvarUltimoCodigoRetomada(slugDaLoja, codigoRetomada, window.localStorage);
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
          <button className="btn-secundario" type="submit" disabled={retomando}>{retomando ? "Retomando…" : "Retomar ficha"}</button>
        </form>
        {mensagemRetomada && <p className="configurador-retomada-status" role="status">{mensagemRetomada}</p>}
      </section>

      <div className="configurador-grade container-loja">
        <section className="configurador-visual" aria-labelledby="titulo-visual">
          <div className="configurador-visual-cabecalho">
            <div><span>Prévia interativa</span><h2 id="titulo-visual">Seu modelo em 3D</h2></div>
            <Rotate3D aria-hidden="true" />
          </div>
          <div className="configurador-palco" style={visual}>
            <div className={`caixa-3d tampa-${configuracao.tampa} base-${configuracao.mobilidade}`} aria-hidden="true">
              <div className="face frente">
                {Array.from({ length: configuracao.divisorias }, (_, indice) => <i key={indice} style={{ left: `${((indice + 1) / (configuracao.divisorias + 1)) * 100}%` }} />)}
              </div>
              <div className="face tras" /><div className="face direita" /><div className="face esquerda" />
              <div className="face topo" /><div className="face fundo" />
              {configuracao.mobilidade === "rodizios" && <><b className="rodizio r1" /><b className="rodizio r2" /><b className="rodizio r3" /><b className="rodizio r4" /></>}
            </div>
          </div>
          <p className="sr-only">Modelo de {resumo}.</p>
          <div className="configurador-rotacao">
            <label>Giro horizontal <input type="range" min="-65" max="65" value={rotacao.y} onChange={(e) => setRotacao((r) => ({ ...r, y: Number(e.target.value) }))} /></label>
            <label>Giro vertical <input type="range" min="-35" max="20" value={rotacao.x} onChange={(e) => setRotacao((r) => ({ ...r, x: Number(e.target.value) }))} /></label>
          </div>
          <div className="configurador-resumo"><strong>Ficha atual</strong><p>{resumo}</p><small>Representação conceitual, sem escala de fabricação.</small></div>
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
          <button className="btn-primario configurador-enviar" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar para análise da fábrica"} <ArrowRight aria-hidden="true" /></button>
        </form>
      </div>
    </main>
  );
}
