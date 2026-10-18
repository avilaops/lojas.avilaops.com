"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Copy, Key, Plug, Sparkles, Terminal, Trash2, Zap } from "lucide-react";
import type { EscolhaDeAcesso as Escolha } from "@/lib/mcp-permissoes";
import { Secao } from "./campos";
import EscolhaDeAcesso, { escolhaVazia } from "./EscolhaDeAcesso";

interface StatusMcp {
  plano: string;
  podeUsarMcp: boolean;
  temChave: boolean;
  apiKeyCriadaEm: string | null;
  endpointUrl: string;
}

interface Conexao {
  id: string;
  assistente: string;
  autorizadaPor: string;
  acesso: string;
  escolha: Escolha;
  teto: string[];
  conectadaEm: string;
  ultimoUsoEm: string | null;
}

interface Chamada {
  id: string;
  quando: string;
  origem: string;
  titulo: string;
  alterou: boolean;
  ok: boolean;
  alvo: string | null;
}

/**
 * Como adicionar o conector em cada assistente. O servidor não distingue um do
 * outro (docs/MCP.md): isto é só o caminho dos menus, e é o que envelhece
 * quando um deles muda a tela.
 */
const COMO_CONECTAR: { id: string; nome: string; passos: string[]; comandos?: (url: string) => string }[] = [
  {
    id: "claude",
    nome: "Claude",
    passos: ["Abra Configurações, Conectores.", "Adicionar conector personalizado e cole o endereço.", "Clique em Conectar e autorize a loja."],
  },
  {
    id: "chatgpt",
    nome: "ChatGPT",
    passos: ["Abra Configurações, Apps e conectores.", "Ligue o modo de desenvolvedor nas configurações avançadas e clique em Criar.", "Cole o endereço, escolha autenticação OAuth e autorize a loja."],
  },
  {
    id: "codex",
    nome: "Codex",
    passos: ["No terminal, rode os dois comandos abaixo.", "O navegador abre para você autorizar a loja."],
    comandos: (url) => `codex mcp add lojas --url ${url}\ncodex mcp login lojas`,
  },
  {
    id: "claude-code",
    nome: "Claude Code",
    passos: ["No terminal, rode o comando abaixo.", "Dentro do Claude Code, rode /mcp e escolha autenticar."],
    comandos: (url) => `claude mcp add --transport http lojas ${url}`,
  },
];

export default function McpPainel({
  lojaPlano,
  lojaSlug,
  aoIrParaAssinatura,
  aoIrParaChaves,
}: {
  lojaPlano: string;
  lojaSlug: string;
  aoIrParaAssinatura: () => void;
  /** Leva à aba de chaves da API, onde se cria a chave secreta das automações. */
  aoIrParaChaves: () => void;
}) {
  const [status, setStatus] = useState<StatusMcp | null>(null);
  const [conexoes, setConexoes] = useState<Conexao[] | null>(null);
  const [atividade, setAtividade] = useState<{ chamadas: Chamada[]; retencaoDias: number } | null>(null);
  const [soAlteracoes, setSoAlteracoes] = useState(false);
  const [editando, setEditando] = useState<{ id: string; escolha: Escolha } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [copiadoUrl, setCopiadoUrl] = useState(false);
  const [assistente, setAssistente] = useState(COMO_CONECTAR[0].id);
  const [chaveRevogada, setChaveRevogada] = useState(false);
  const comoConectarRef = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const ePlanoPro = lojaPlano === "LOJA_PRO";

  useEffect(() => {
    async function carregar() {
      try {
        const r = await fetch("/api/painel/mcp");
        if (r.ok) {
          const d = await r.json();
          setStatus(d);
        }
        const c = await fetch("/api/painel/mcp/conexoes");
        setConexoes(c.ok ? (await c.json()).conexoes : []);
      } catch {
        /* O estado vazio é a apresentação segura durante a carga. */
      }
    }
    carregar();
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/painel/mcp/atividade${soAlteracoes ? "?alteracoes=1" : ""}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setAtividade(d); })
      .catch(() => { /* A lista vazia é a apresentação segura. */ });
    return () => { vivo = false; };
  }, [soAlteracoes]);

  async function revogarChave() {
    if (!confirm("Revogar a chave antiga do conector? As automações que a usam param na hora, e ela não pode ser gerada de novo: para ter outra, crie uma chave secreta com o escopo mcp:usar em Chaves da API.")) {
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/painel/mcp", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao revogar chave.");
      setStatus((s) => (s ? { ...s, temChave: false, apiKeyCriadaEm: null } : null));
      setChaveRevogada(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao revogar chave.");
    } finally {
      setGerando(false);
    }
  }

  async function desconectar(c: Conexao) {
    if (!confirm(`Desconectar ${c.assistente}? Ele perde o acesso à loja na hora. Para voltar, é só conectar de novo.`)) return;
    setErro(null);
    setSucesso(null);
    try {
      const r = await fetch(`/api/painel/mcp/conexoes?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao desconectar.");
      setConexoes((lista) => (lista ?? []).filter((x) => x.id !== c.id));
      setSucesso(`${c.assistente} foi desconectado.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao desconectar.");
    }
  }

  async function salvarAcesso() {
    if (!editando) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const r = await fetch("/api/painel/mcp/conexoes", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: editando.id, ...editando.escolha }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.conexao) throw new Error(d?.erro ?? "Falha ao mudar o acesso.");
      setConexoes((lista) => (lista ?? []).map((x) => (x.id === d.conexao.id ? d.conexao : x)));
      setSucesso(`Acesso de ${d.conexao.assistente} atualizado. Vale a partir da próxima coisa que ele fizer.`);
      setEditando(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao mudar o acesso.");
    } finally {
      setSalvando(false);
    }
  }

  /** Do estado vazio: abre o passo a passo do assistente escolhido e leva o olho até ele. */
  function mostrarComoConectar(id: string) {
    setAssistente(id);
    comoConectarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function copiarEndereco(texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiadoUrl(true);
    setTimeout(() => setCopiadoUrl(false), 2500);
  }

  // Banner de Upsell se não for Plano Pro
  if (!ePlanoPro) {
    return (
      <Secao
        titulo="Conector de IA (MCP)"
        descricao="Gerencie sua loja conversando com o Claude, o ChatGPT ou o Codex."
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Exclusivo Plano Loja Pro
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Plano Atual: {lojaPlano}</span>
          </div>

          <h3 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sua Loja Controlada por Inteligência Artificial
          </h3>

          <p className="mt-2 text-sm text-muted-foreground sm:text-base max-w-2xl leading-relaxed">
            Conecte sua loja ao <b>Claude</b>, ao <b>ChatGPT</b> ou ao <b>Codex</b> com um login, sem copiar chave. Adicione produtos, lance cupons, monitore faturamento e emita etiquetas de frete apenas conversando.
          </p>

          {/* Recursos em Destaque */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <Bot className="h-5 w-5 text-primary mb-2" />
              <h4 className="text-xs font-bold text-foreground">Cadastro por Conversa</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">Dite o produto e a IA cadastra com fotos, preço e estoque.</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <Zap className="h-5 w-5 text-amber-500 mb-2" />
              <h4 className="text-xs font-bold text-foreground">Promoções Relâmpago</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">Crie cupons de desconto e altere preços instantaneamente.</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <Key className="h-5 w-5 text-emerald-600 mb-2" />
              <h4 className="text-xs font-bold text-foreground">Conexão por Login</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">Você autoriza no painel e desconecta quando quiser. Acesso só à sua loja.</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-background/80 p-4">
              <Terminal className="h-5 w-5 text-blue-500 mb-2" />
              <h4 className="text-xs font-bold text-foreground">Protocolo MCP Oficial</h4>
              <p className="mt-1 text-[11px] text-muted-foreground">O mesmo conector serve a qualquer assistente que fale MCP.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4 pt-4 border-t border-border/60">
            <div>
              <span className="text-xs text-muted-foreground">Plano Loja Pro:</span>
              <p className="text-xl font-black text-foreground">R$ 497 <span className="text-xs font-normal text-muted-foreground">/mês</span></p>
            </div>

            <button
              type="button"
              onClick={aoIrParaAssinatura}
              className="btn-primario ml-auto text-sm px-6 h-12 shadow-lg shadow-primary/20"
            >
              Fazer Upgrade para Loja Pro →
            </button>
          </div>
        </div>
      </Secao>
    );
  }

  const endpointUrl = status?.endpointUrl ?? "https://lojas.avilaops.com/api/mcp";
  const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
  const diaEHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const escolhido = COMO_CONECTAR.find((c) => c.id === assistente) ?? COMO_CONECTAR[0];
  // As cores de aviso não usam `dark:`: o painel é sempre claro, e a variante
  // escura (que segue o aparelho) deixava texto amarelo-claro sobre fundo amarelo.
  //
  // A aba tem de caber numa tela de celular: o endereço e o passo a passo ficam
  // num cartão, e todo o resto são linhas de um cartão só, que abrem ao toque.
  const linha = "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden";
  const abrir = <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />;

  return (
    <div className="grid min-w-0 gap-3">
      {erro && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-700">{sucesso}</div>}

      {/* Endereço do conector, sempre à vista, e o caminho do assistente escolhido */}
      <div ref={comoConectarRef} className="min-w-0 scroll-mt-20 rounded-xl border border-border bg-card p-3 sm:p-4">
        <p className="text-xs text-muted-foreground">Cole este endereço no seu assistente e autorize com o login da loja. Não há chave para copiar.</p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <input
            type="text"
            readOnly
            value={endpointUrl}
            aria-label="Endereço do conector"
            className="h-10 w-full min-w-0 rounded-lg border border-border bg-muted/50 px-3 font-mono text-xs text-foreground select-all"
          />
          <button type="button" onClick={() => copiarEndereco(endpointUrl)} className="btn-secundario h-10 shrink-0 px-3 text-xs">
            {copiadoUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiadoUrl ? "Copiado" : "Copiar"}
          </button>
        </div>

        <div role="tablist" aria-label="Como conectar em cada assistente" className="mt-3 flex gap-1 overflow-x-auto">
          {COMO_CONECTAR.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              id={`como-${c.id}`}
              aria-selected={c.id === escolhido.id}
              aria-controls="como-conectar-passos"
              onClick={() => setAssistente(c.id)}
              className={`h-8 shrink-0 rounded-full border px-2.5 text-xs font-semibold transition ${c.id === escolhido.id ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-muted"}`}
            >
              {c.nome}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="como-conectar-passos" aria-labelledby={`como-${escolhido.id}`} className="mt-2 min-w-0">
          <ol className="grid list-decimal gap-0.5 pl-5 text-xs leading-relaxed text-muted-foreground">
            {escolhido.passos.map((passo) => <li key={passo}>{passo}</li>)}
          </ol>
          {escolhido.comandos && (
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-2.5 font-mono text-[11px] text-foreground">{escolhido.comandos(endpointUrl)}</pre>
          )}
        </div>
      </div>

      {/* A chave antiga é o que pede ação nesta tela: uma linha de aviso, com o porquê ao toque. */}
      {status?.temChave && (
        <details className="group min-w-0 rounded-xl border border-amber-300 bg-amber-50">
          <summary className={`${linha} text-amber-950`}>
            <span className="min-w-0">Chave antiga do conector ainda ativa</span>
            {abrir}
          </summary>
          <div className="grid gap-2 px-3 pb-3">
            <p className="text-xs leading-relaxed text-amber-900">
              <code className="break-all">lojas_live_{lojaSlug}_…</code>
              {status.apiKeyCriadaEm ? `, gerada em ${dia(status.apiKeyCriadaEm)}` : ""}. Ela dá acesso inteiro à loja. Passe a automação para uma chave
              secreta e revogue esta.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={revogarChave} disabled={gerando} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" /> {gerando ? "Revogando…" : "Revogar chave antiga"}
              </button>
              <button type="button" onClick={aoIrParaChaves} className="btn-secundario h-9 px-3 text-xs">Criar chave secreta</button>
            </div>
          </div>
        </details>
      )}
      {chaveRevogada && (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <p className="min-w-0 text-xs text-emerald-900"><b>Chave antiga revogada.</b> Para religar a automação, crie uma chave secreta com <code>mcp:usar</code>.</p>
          <button type="button" onClick={aoIrParaChaves} className="btn-primario h-9 px-3 text-xs">Criar chave secreta</button>
        </div>
      )}

      <div className="min-w-0 divide-y divide-border rounded-xl border border-border bg-card">
        {/* Quem está conectado: uma linha por assistente; o que se faz com ele abre ao toque. */}
        <div className="min-w-0 px-3 py-2.5">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Plug className="h-4 w-4" /> Assistentes conectados{conexoes && conexoes.length > 0 ? ` (${conexoes.length})` : ""}
          </h4>
          {conexoes === null ? (
            <p className="mt-1 text-xs text-muted-foreground">Carregando…</p>
          ) : conexoes.length === 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Nenhum ainda. Conectar:</span>
              {COMO_CONECTAR.map((c) => (
                <button key={c.id} type="button" onClick={() => mostrarComoConectar(c.id)} className="h-8 rounded-full border border-border bg-background px-2.5 text-xs font-semibold text-primary hover:bg-muted">
                  {c.nome}
                </button>
              ))}
            </div>
          ) : (
            <ul className="mt-1.5 grid gap-1.5">
              {conexoes.map((c) => (
                <li key={c.id} className="min-w-0">
                  <details className="group min-w-0 rounded-lg border border-border bg-background" open={editando?.id === c.id || undefined}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">{c.assistente} <span className="font-normal text-muted-foreground">· {c.autorizadaPor}</span></span>
                        <span className="block truncate text-xs text-muted-foreground">{c.acesso}</span>
                      </span>
                      {abrir}
                    </summary>
                    <div className="grid gap-2 border-t border-border px-2.5 py-2">
                      <p className="text-[11px] text-muted-foreground">
                        Conectado em {dia(c.conectadaEm)} · {c.ultimoUsoEm ? `último uso em ${dia(c.ultimoUsoEm)}` : "ainda não usado"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setEditando(editando?.id === c.id ? null : { id: c.id, escolha: c.escolha })}
                          className="btn-secundario h-9 px-3 text-xs"
                        >
                          {editando?.id === c.id ? "Fechar" : "Mudar acesso"}
                        </button>
                        <button type="button" onClick={() => desconectar(c)} className="btn-secundario h-9 px-3 text-xs text-red-600 hover:text-red-700">
                          Desconectar
                        </button>
                      </div>
                      {editando?.id === c.id && (
                        <div className="grid gap-3 border-t border-border pt-2">
                          <EscolhaDeAcesso nome={`acesso-${c.id}`} valor={editando.escolha} aoMudar={(escolha) => setEditando({ id: c.id, escolha })} teto={c.teto} />
                          <button type="button" onClick={salvarAcesso} disabled={salvando || escolhaVazia(editando.escolha)} className="btn-primario h-9 justify-center px-4 text-xs">
                            {salvando ? "Salvando…" : escolhaVazia(editando.escolha) ? "Marque ao menos uma área" : "Salvar acesso"}
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* O que os assistentes fizeram */}
        <details className="group min-w-0">
          <summary className={linha}>
            <span>Atividade{atividade && atividade.chamadas.length > 0 ? ` (${atividade.chamadas.length})` : ""}</span>
            {abrir}
          </summary>
          <div className="px-3 pb-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={soAlteracoes} onChange={(e) => setSoAlteracoes(e.target.checked)} />
              Só o que alterou a loja
            </label>
            {atividade === null ? (
              <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
            ) : atividade.chamadas.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {soAlteracoes ? "Nenhuma alteração feita por assistente." : "Nada por aqui ainda. O que um assistente consultar ou alterar aparece nesta lista."}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {atividade.chamadas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-xs">
                    <span className="min-w-0">
                      <span className={`font-semibold ${c.ok ? "text-foreground" : "text-red-600"}`}>{c.titulo}</span>
                      {c.alvo && <code className="ml-1.5 break-all text-muted-foreground">{c.alvo}</code>}
                      {c.alterou && c.ok && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">alterou</span>}
                      {!c.ok && <span className="ml-1.5 text-red-600">não concluiu</span>}
                    </span>
                    <span className="text-muted-foreground">{c.origem} · {diaEHora(c.quando)}</span>
                  </li>
                ))}
              </ul>
            )}
            {atividade && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Fica guardado por {atividade.retencaoDias} dias: a ferramenta e o código do que foi tocado. Conversa e dados consultados não ficam.
              </p>
            )}
          </div>
        </details>

        {/* Automações: chave secreta com o escopo do conector */}
        <details className="group min-w-0">
          <summary className={linha}>
            <span className="flex items-center gap-1.5"><Key className="h-4 w-4" /> Automações (n8n e scripts)</span>
            {abrir}
          </summary>
          <div className="px-3 pb-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Para o que roda sem ninguém na tela, crie uma chave secreta com <code>mcp:usar</code> e as áreas que a automação precisa, e envie em cada chamada:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-2.5 font-mono text-[11px] text-foreground">Authorization: Bearer lojas_sk_SUA_CHAVE_AQUI</pre>
            <button type="button" onClick={aoIrParaChaves} className="btn-secundario mt-2 h-9 px-3 text-xs">Ir para Chaves da API</button>
          </div>
        </details>
      </div>
    </div>
  );
}
