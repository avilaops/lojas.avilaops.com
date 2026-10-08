"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy, Key, Plug, Sparkles, Terminal, Trash2, Zap } from "lucide-react";
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
  acesso: string;
  escolha: Escolha;
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
const COMO_CONECTAR: { nome: string; passos: string; comandos?: (url: string) => string }[] = [
  {
    nome: "Claude (web, computador e celular)",
    passos: "Configurações, Conectores, Adicionar conector personalizado. Cole o endereço, clique em Conectar e autorize a loja.",
  },
  {
    nome: "ChatGPT",
    passos: "Configurações, Apps e conectores. Ligue o modo de desenvolvedor nas configurações avançadas e clique em Criar. Cole o endereço, escolha autenticação OAuth e autorize a loja.",
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
  const [atividade, setAtividade] = useState<{ chamadas: Chamada[]; retencaoDias: number } | null>(null);
  const [soAlteracoes, setSoAlteracoes] = useState(false);
  const [editando, setEditando] = useState<{ id: string; escolha: Escolha } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
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
              onClick={() => copiarEndereco(endpointUrl)}
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
                <li key={c.id} className="rounded-lg border border-border bg-background p-3">
                 <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{c.assistente}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.acesso} · conectado em {dia(c.conectadaEm)} · {c.ultimoUsoEm ? `último uso em ${dia(c.ultimoUsoEm)}` : "ainda não usado"}
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                 </div>
                  {editando?.id === c.id && (
                    <div className="mt-3 grid gap-3 border-t border-border pt-3">
                      <EscolhaDeAcesso nome={`acesso-${c.id}`} valor={editando.escolha} aoMudar={(escolha) => setEditando({ id: c.id, escolha })} />
                      <button type="button" onClick={salvarAcesso} disabled={salvando || escolhaVazia(editando.escolha)} className="btn-primario h-9 justify-center px-4 text-xs">
                        {salvando ? "Salvando…" : escolhaVazia(editando.escolha) ? "Marque ao menos uma área" : "Salvar acesso"}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* O que os assistentes fizeram */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground">Atividade dos assistentes</h4>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={soAlteracoes} onChange={(e) => setSoAlteracoes(e.target.checked)} />
              Só o que alterou a loja
            </label>
          </div>
          {atividade === null ? (
            <p className="mt-2 text-xs text-muted-foreground">Carregando…</p>
          ) : atividade.chamadas.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {soAlteracoes ? "Nenhuma alteração feita por assistente." : "Nada por aqui ainda. Cada coisa que um assistente consultar ou alterar na loja aparece nesta lista."}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {atividade.chamadas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-xs">
                  <span className="min-w-0">
                    <span className={`font-semibold ${c.ok ? "text-foreground" : "text-red-600"}`}>{c.titulo}</span>
                    {c.alvo && <code className="ml-1.5 text-muted-foreground">{c.alvo}</code>}
                    {c.alterou && c.ok && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">alterou</span>}
                    {!c.ok && <span className="ml-1.5 text-red-600">não concluiu</span>}
                  </span>
                  <span className="text-muted-foreground">{c.origem} · {diaEHora(c.quando)}</span>
                </li>
              ))}
            </ul>
          )}
          {atividade && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Guardamos a ferramenta usada e o código do que foi tocado, por {atividade.retencaoDias} dias. O conteúdo da conversa e os dados consultados não ficam aqui.
            </p>
          )}
        </div>

        {/* Automações: chave secreta com o escopo do conector */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Key className="h-4 w-4" /> Automações (n8n e scripts)</h4>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Para o que roda sem ninguém na frente da tela, crie uma chave secreta em <b>Chaves da API</b>, logo abaixo, marcando{" "}
            <code>mcp:usar</code> e as áreas que a automação precisa. Envie a chave em cada chamada ao endereço do conector:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-[11px] font-mono text-foreground border border-border">Authorization: Bearer lojas_sk_SUA_CHAVE_AQUI</pre>

          {status?.temChave && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="min-w-0 text-xs text-amber-900 dark:text-amber-200">
                Esta loja ainda tem a chave antiga do conector (<code>lojas_live_{lojaSlug}_…</code>)
                {status.apiKeyCriadaEm ? `, gerada em ${dia(status.apiKeyCriadaEm)}` : ""}. Ela continua valendo, com acesso inteiro.
                Quando a automação passar para uma chave secreta, revogue esta.
              </p>
              <button type="button" onClick={revogarChave} disabled={gerando} className="btn-secundario h-9 px-3 text-xs text-red-600 hover:text-red-700">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Revogar
              </button>
            </div>
          )}
        </div>
      </div>
    </Secao>
  );
}
