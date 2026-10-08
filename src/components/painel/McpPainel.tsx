"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy, Key, Plug, Sparkles, Terminal, Trash2, Zap } from "lucide-react";
import { Secao } from "./campos";

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
  conectadaEm: string;
  ultimoUsoEm: string | null;
}

/**
 * Como adicionar o conector em cada assistente. O servidor não distingue um do
 * outro (docs/MCP.md): isto é só o caminho dos menus, e é o que envelhece
 * quando um deles muda a tela.
 */
const COMO_CONECTAR: { nome: string; passos: string; comandos?: (url: string) => string }[] = [
  {
    nome: "Claude (web, computador e celular)",
    passos: "Configurações, Conectores, Adicionar conector personalizado. Cole o endereço, clique em Conectar e autorize a loja.",
  },
  {
    nome: "ChatGPT",
    passos: "Configurações, Conectores, Criar (pede o modo de desenvolvedor ligado). Cole o endereço, escolha autenticação OAuth e autorize a loja.",
  },
  {
    nome: "Codex",
    passos: "No terminal, adicione o conector e faça o login. O navegador abre para você autorizar a loja.",
    comandos: (url) => `codex mcp add lojas --url ${url}\ncodex mcp login lojas`,
  },
  {
    nome: "Claude Code",
    passos: "No terminal, adicione o conector. Depois rode /mcp dentro do Claude Code e escolha autenticar.",
    comandos: (url) => `claude mcp add --transport http lojas ${url}`,
  },
];

export default function McpPainel({
  lojaPlano,
  lojaSlug,
  aoIrParaAssinatura,
}: {
  lojaPlano: string;
  lojaSlug: string;
  aoIrParaAssinatura: () => void;
}) {
  const [status, setStatus] = useState<StatusMcp | null>(null);
  const [conexoes, setConexoes] = useState<Conexao[] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [novaChave, setNovaChave] = useState<string | null>(null);
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [copiadoUrl, setCopiadoUrl] = useState(false);
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

  async function gerarChave() {
    setGerando(true);
    setErro(null);
    setSucesso(null);
    try {
      const r = await fetch("/api/painel/mcp", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao gerar chave.");
      setNovaChave(d.chave);
      setStatus((s) => (s ? { ...s, temChave: true, apiKeyCriadaEm: d.criadaEm } : null));
      setSucesso("Nova chave de API gerada com sucesso!");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar chave.");
    } finally {
      setGerando(false);
    }
  }

  async function revogarChave() {
    if (!confirm("Tem certeza que deseja revogar a chave de API? As automações que usam a chave param de funcionar imediatamente. Os assistentes conectados por login continuam.")) {
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/painel/mcp", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha ao revogar chave.");
      setNovaChave(null);
      setStatus((s) => (s ? { ...s, temChave: false, apiKeyCriadaEm: null } : null));
      setSucesso("Chave revogada com sucesso.");
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

  function copiar(texto: string, tipo: "chave" | "url") {
    navigator.clipboard.writeText(texto);
    if (tipo === "chave") {
      setCopiadoChave(true);
      setTimeout(() => setCopiadoChave(false), 2500);
    } else {
      setCopiadoUrl(true);
      setTimeout(() => setCopiadoUrl(false), 2500);
    }
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

  return (
    <Secao
      titulo="Conector de IA (MCP)"
      descricao="Ligue a loja ao seu assistente com um login. Você cola o endereço do conector, entra no painel e autoriza: não há chave para copiar."
    >
      {erro && <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-600 dark:text-red-400">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400">{sucesso}</div>}

      <div className="grid gap-6">
        {/* Endereço do conector e o caminho em cada assistente */}
        <div className="rounded-xl border border-border bg-card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Endereço do conector</span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={endpointUrl}
              className="h-10 w-full rounded-lg border border-border bg-muted/50 px-3 font-mono text-xs text-foreground select-all"
            />
            <button
              type="button"
              onClick={() => copiar(endpointUrl, "url")}
              className="btn-secundario h-10 px-3 text-xs shrink-0"
            >
              {copiadoUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiadoUrl ? "Copiado" : "Copiar"}
            </button>
          </div>
          <dl className="mt-4 grid gap-3">
            {COMO_CONECTAR.map((c) => (
              <div key={c.nome}>
                <dt className="text-xs font-bold text-foreground">{c.nome}</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {c.passos}
                  {c.comandos && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-[11px] font-mono text-foreground border border-border">{c.comandos(endpointUrl)}</pre>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Quem está conectado */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Plug className="h-4 w-4" /> Assistentes conectados</h4>
          {conexoes === null ? (
            <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
          ) : conexoes.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nenhum assistente conectado ainda. Siga os passos acima no assistente que você usa.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {conexoes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.assistente}</p>
                    <p className="text-xs text-muted-foreground">
                      Conectado em {dia(c.conectadaEm)} · {c.ultimoUsoEm ? `último uso em ${dia(c.ultimoUsoEm)}` : "ainda não usado"}
                    </p>
                  </div>
                  <button type="button" onClick={() => desconectar(c)} className="btn-secundario h-9 px-3 text-xs text-red-600 hover:text-red-700">
                    Desconectar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Chave de API: para o que não tem tela de login */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Chave para automações (n8n e scripts)</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status?.temChave && status.apiKeyCriadaEm
                  ? `Chave ativa gerada em ${dia(status.apiKeyCriadaEm)}`
                  : "Só para o que roda sem ninguém na frente da tela. Nos assistentes, use o login acima."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={gerarChave}
                disabled={gerando}
                className="btn-primario text-xs h-9 px-4"
              >
                <Key className="h-3.5 w-3.5 mr-1" />
                {status?.temChave ? "Rotacionar Chave" : "Gerar Chave de API"}
              </button>
              {status?.temChave && (
                <button
                  type="button"
                  onClick={revogarChave}
                  disabled={gerando}
                  className="btn-secundario text-xs h-9 px-3 text-red-600 hover:text-red-700"
                  title="Revogar chave"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Exibição da Chave Nova */}
          {novaChave && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Copie sua chave agora. Ela não será exibida novamente por segurança.
                </span>
                <button
                  type="button"
                  onClick={() => copiar(novaChave, "chave")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary underline ml-2"
                >
                  {copiadoChave ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiadoChave ? "Copiada!" : "Copiar Chave"}
                </button>
              </div>
              <div className="mt-2 break-all rounded-lg bg-background p-2.5 font-mono text-xs font-bold text-foreground border border-border select-all">
                {novaChave}
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Envie a chave no cabeçalho de cada chamada ao endereço do conector:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-[11px] font-mono text-foreground border border-border">
{`Authorization: Bearer ${novaChave || "lojas_live_" + lojaSlug + "_SUA_CHAVE_AQUI"}`}
          </pre>
        </div>
      </div>
    </Secao>
  );
}
