"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, RefreshCw, X } from "lucide-react";
import { Campo, Secao, inputClasse } from "./campos";

type EstadoDoNome = { nome: string; ok: boolean; encontrado: string[]; erro: string | null };
type Conferencia = { dominio: string; apex: EstadoDoNome; www: EstadoDoNome; pronto: boolean; mensagem: string };
type Registro = { tipo: string; nome: string; valor: string; ajuda: string };

function Copiavel({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs"
      onClick={() => {
        navigator.clipboard.writeText(valor).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1600);
        });
      }}
    >
      {valor}
      {copiado ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-muted-foreground" />}
    </button>
  );
}

function Linha({ estado }: { estado: EstadoDoNome }) {
  return (
    <li className="flex items-start gap-2.5 border-t border-border py-2 text-sm">
      {estado.ok ? <Check size={16} className="mt-0.5 flex-none text-emerald-600" /> : <X size={16} className="mt-0.5 flex-none text-red-600" />}
      <span className="flex-1">
        <b>{estado.nome}</b>
        <span className="block text-xs text-muted-foreground">
          {estado.ok
            ? "apontando para a plataforma"
            : estado.erro === "sem registro"
              ? "nenhum registro encontrado"
              : estado.encontrado.length
                ? `aponta para ${estado.encontrado.join(", ")}`
                : `não resolveu (${estado.erro})`}
        </span>
      </span>
    </li>
  );
}

/**
 * Domínio próprio, do jeito que o lojista consegue fazer sozinho.
 *
 * A máquina toda já existia: o domínio salvo autoriza o Caddy a emitir o
 * certificado quando o host aparece, e a loja responde por ele sem mais nada.
 * O que não existia era contar isso a quem precisa apontar o DNS. O campo vivia
 * perdido na aba Marca, salvar não mostrava nada acontecendo, e a conclusão
 * natural era que a plataforma não fazia domínio próprio.
 */
export default function Dominio({ loja }: { loja: { slug: string; url: string; dominioPrincipal: string | null; plano: string } }) {
  const router = useRouter();
  const [dominio, setDominio] = useState(loja.dominioPrincipal ?? "");
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const noPlano = loja.plano !== "SITE";

  async function chamar(acao: "salvar" | "verificar") {
    setErro(null); setOk(null); setOcupado(true);
    try {
      const r = await fetch("/api/painel/dominio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao, dominio }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha.");
      if (d.conferencia) setConferencia(d.conferencia);
      if (d.registros) setRegistros(d.registros);
      if (acao === "salvar") { setOk(d.removido ? "Domínio removido." : "Domínio salvo."); router.refresh(); }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <Secao
        titulo="Domínio próprio"
        descricao="Sua loja já responde no endereço provisório. Com domínio próprio ela passa a responder também em sualoja.com.br, com certificado emitido sozinho."
      >
        {!noPlano && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Domínio próprio faz parte dos planos com loja. No plano atual o endereço provisório continua funcionando normalmente.
          </p>
        )}

        <p className="text-sm">
          Endereço atual: <a className="underline" href={loja.url} target="_blank" rel="noopener">{loja.url.replace(/^https?:\/\//, "")}</a>
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Seu domínio" ajuda="Só o domínio, sem https:// e sem barra. O www é configurado junto.">
            <input
              className={inputClasse}
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="sualoja.com.br"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Campo>
          <div className="flex items-end gap-2">
            <button className="btn-primario" disabled={ocupado} onClick={() => chamar("salvar")}>Salvar domínio</button>
            {loja.dominioPrincipal && (
              <button className="btn-secundario inline-flex items-center gap-1.5" disabled={ocupado} onClick={() => chamar("verificar")}>
                <RefreshCw size={14} /> Verificar
              </button>
            )}
          </div>
        </div>

        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}
      </Secao>

      {loja.dominioPrincipal && (
        <Secao titulo="O que criar no painel do seu domínio" descricao="Dois registros, no site onde você registrou o domínio (Registro.br, GoDaddy, Hostinger e semelhantes).">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Tipo</th><th>Nome</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {(registros ?? [
                  { tipo: "A", nome: "@", valor: "178.105.82.48", ajuda: 'O "@" representa o próprio domínio. A maioria dos painéis não aceita CNAME aqui, por isso é um endereço IP.' },
                  { tipo: "CNAME", nome: "www", valor: `${loja.slug}.lojas.avilaops.com`, ajuda: "Apontar para o endereço da loja faz o www continuar certo se o servidor mudar." },
                ]).map((r) => (
                  <tr key={r.nome} className="border-t border-border align-top">
                    <td className="py-2 font-mono text-xs">{r.tipo}</td>
                    <td className="py-2 font-mono text-xs">{r.nome}</td>
                    <td className="py-2">
                      <Copiavel valor={r.valor} />
                      <span className="mt-1 block text-xs text-muted-foreground">{r.ajuda}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Depois de criar, o DNS costuma levar de alguns minutos a algumas horas para valer no mundo inteiro. Volte aqui e clique em Verificar.
          </p>
        </Secao>
      )}

      {conferencia && (
        <Secao titulo="Como está agora" descricao={conferencia.mensagem}>
          <ul className="grid">
            <Linha estado={conferencia.apex} />
            <Linha estado={conferencia.www} />
          </ul>
          {conferencia.pronto && (
            <p className="text-sm">
              <a className="inline-flex items-center gap-1.5 underline" href={`https://${conferencia.dominio}`} target="_blank" rel="noopener">
                Abrir {conferencia.dominio} <ExternalLink size={13} />
              </a>
            </p>
          )}
        </Secao>
      )}
    </>
  );
}
