"use client";

import { Secao, inputClasse } from "./campos";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DadosDaTela } from "@/lib/recebimento-v2";

type Provedor = DadosDaTela["provedores"][number];
type Credencial = DadosDaTela["credenciais"][number];
type Teste = { ok: boolean; mensagem: string; avisos: string[] };

const STATUS: Record<string, { rotulo: string; classe: string }> = {
  conectado: { rotulo: "Conectado", classe: "bg-emerald-50 text-emerald-800" },
  erro: { rotulo: "Erro", classe: "bg-red-50 text-red-700" },
  pendente: { rotulo: "Pendente", classe: "bg-amber-50 text-amber-900" },
  nenhum: { rotulo: "Não conectado", classe: "bg-slate-100 text-slate-700" },
};

type Recado = { tom: "ok" | "erro"; texto: string };

const RETORNO: Record<string, Recado> = {
  ok: { tom: "ok", texto: "Conta conectada." },
  erro: { tom: "erro", texto: "A conta foi conectada, mas o teste falhou. Veja a mensagem no cartão." },
  falhou: { tom: "erro", texto: "Não foi possível concluir a conexão. Nada mudou na loja: tente de novo." },
  indisponivel: { tom: "erro", texto: "A conexão com este provedor ainda não está disponível nesta instalação." },
};

/** Volta do fluxo do Mercado Pago (`?mp=`), o mesmo texto do cartão antigo. */
const RETORNO_MP: Record<string, Recado> = {
  conectado: { tom: "ok", texto: "Conta do Mercado Pago conectada. A loja já pode receber por Pix, cartão e boleto." },
  recusado: { tom: "erro", texto: "Você não autorizou a conexão com o Mercado Pago. Nada mudou na loja." },
  incompleto: { tom: "erro", texto: "A autorização do Mercado Pago voltou incompleta ou vencida. Clique em conectar de novo." },
  falhou: { tom: "erro", texto: "O Mercado Pago não concluiu a conexão. Nada mudou na loja: tente de novo em alguns minutos." },
  teste: { tom: "erro", texto: "A conta que autorizou é de teste, e venda nela não é dinheiro de verdade. Entre no Mercado Pago com a conta da loja e conecte de novo." },
  indisponivel: { tom: "erro", texto: "A conexão com o Mercado Pago ainda não está liberada nesta instalação. Fale com o suporte da Ávila Ops." },
  "sem-permissao": { tom: "erro", texto: "Seu acesso não permite trocar a conta de recebimento. Fale com o dono da loja." },
};

/** Cor da mensagem do cartão: âmbar para pendente, vermelho só para erro. */
const TOM_DA_MENSAGEM: Record<string, string> = {
  erro: "bg-red-50 text-red-700",
  pendente: "bg-amber-50 text-amber-900",
};

/**
 * Configurações → Recebimento (v2). Um cartão por provedor, com o status da
 * conta (Conectado / Erro / Pendente) e qual é a padrão. Por tipo de conexão:
 * OAuth vira botão "Conectar com…"; chave e Pix direto viram formulário com
 * "Testar conexão" antes de salvar.
 */
export default function RecebimentoV2({ dados, retorno, retornoMp }: { dados: DadosDaTela; retorno?: string; retornoMp?: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const porProvedor = new Map(dados.credenciais.map((c) => [c.provedor, c]));
  const temPadrao = dados.credenciais.some((c) => c.padrao);
  const recado = (retornoMp ? RETORNO_MP[retornoMp] : undefined) ?? (retorno ? RETORNO[retorno] : undefined);

  async function usarComoPadrao(c: Credencial) {
    setErro(null);
    const r = await fetch("/api/painel/recebimento/v2/padrao", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credencialId: c.id }) });
    const j = (await r.json().catch(() => ({}))) as { erro?: string };
    if (!r.ok) setErro(j.erro ?? "Não foi possível trocar a conta padrão. Tente de novo.");
    else router.refresh();
  }

  return (
    <Secao
      titulo="Onde você recebe"
      descricao={`O dinheiro das vendas cai direto na sua conta do provedor escolhido. A conta marcada como padrão é a que cobra os pedidos novos.${temPadrao ? "" : " Você ainda não tem uma conta padrão: conecte uma para começar a vender."}`}
    >
      {recado && (
        <p role={recado.tom === "erro" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${recado.tom === "erro" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {recado.texto}
        </p>
      )}
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {dados.provedores.map((p) => (
        <CartaoProvedor key={p.id} provedor={p} credencial={porProvedor.get(p.id)} aoUsarComoPadrao={usarComoPadrao} aoSalvar={() => router.refresh()} />
      ))}
    </Secao>
  );
}

function CartaoProvedor({ provedor, credencial, aoUsarComoPadrao, aoSalvar }: { provedor: Provedor; credencial?: Credencial; aoUsarComoPadrao: (c: Credencial) => void; aoSalvar: () => void }) {
  const status = STATUS[credencial?.status ?? "nenhum"];
  const [aberto, setAberto] = useState(false);
  const meios = [provedor.capacidades.pix && "Pix", provedor.capacidades.cartao && "cartão", provedor.capacidades.boleto && "boleto"].filter(Boolean).join(", ");

  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            {provedor.nome} {credencial?.padrao && <span className="ml-1 rounded bg-slate-900 px-2 py-0.5 text-xs text-white">Padrão</span>}
          </h3>
          <p className="text-xs text-slate-600">
            Recebe {meios || "—"}.{!provedor.capacidades.confirmacaoAutomatica && " O pagamento não se confirma sozinho: você confere no app do banco e dá baixa no pedido."}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.classe}`}>{status.rotulo}</span>
      </div>
      {credencial?.conta && <p className="mt-2 text-sm">Conta: {credencial.conta}</p>}
      {credencial?.mensagem && TOM_DA_MENSAGEM[credencial.status] && (
        <p role={credencial.status === "erro" ? "alert" : undefined} className={`mt-2 rounded p-2 text-sm ${TOM_DA_MENSAGEM[credencial.status]}`}>{credencial.mensagem}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {provedor.tipoConexao === "oauth" ? (
          provedor.oauthDisponivel ? (
            <a className="btn-primario inline-flex h-9 items-center px-3 text-sm" href={`/api/painel/recebimento/v2/conectar/${provedor.id}`}>
              {credencial ? `Conectar de novo com ${provedor.nome}` : `Conectar com ${provedor.nome}`}
            </a>
          ) : (
            <span className="text-sm text-slate-600">Conexão com {provedor.nome} em breve.</span>
          )
        ) : (
          <button className="btn-secundario inline-flex h-9 items-center px-3 text-sm" onClick={() => setAberto((v) => !v)}>
            {credencial ? "Trocar dados" : provedor.tipoConexao === "pix_direto" ? "Cadastrar chave Pix" : "Colar chaves"}
          </button>
        )}
        {credencial && !credencial.padrao && credencial.status === "conectado" && (
          <button className="btn-secundario inline-flex h-9 items-center px-3 text-sm" onClick={() => aoUsarComoPadrao(credencial)}>Usar como padrão</button>
        )}
      </div>
      {aberto && provedor.tipoConexao !== "oauth" && <FormularioChaves provedor={provedor} aoSalvar={() => { setAberto(false); aoSalvar(); }} />}
    </article>
  );
}

function FormularioChaves({ provedor, aoSalvar }: { provedor: Provedor; aoSalvar: () => void }) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [teste, setTeste] = useState<Teste | null>(null);
  const [ocupado, setOcupado] = useState<"testar" | "salvar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(acao: "testar" | "salvar") {
    setErro(null);
    setOcupado(acao);
    try {
      const r = await fetch(`/api/painel/recebimento/v2/${acao}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provedor: provedor.id, valores }) });
      const j = (await r.json().catch(() => ({}))) as Teste & { erro?: string; teste?: Teste };
      if (!r.ok) return setErro(j.erro ?? j.mensagem ?? "Não foi possível agora. Tente de novo.");
      if (acao === "testar") setTeste(j);
      else {
        setTeste(j.teste ?? null);
        aoSalvar();
      }
    } catch {
      setErro("Sem conexão com o servidor. Confira a internet e tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
      {provedor.guia.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {provedor.guia.map((p, i) => (
            <li key={i}>{p.texto}{p.url && <> — <a className="underline" href={p.url} target="_blank" rel="noreferrer">abrir</a></>}</li>
          ))}
        </ol>
      )}
      {provedor.campos.map((c) => (
        <label key={c.chave} className="grid gap-1 text-sm">
          <span>{c.rotulo}{c.obrigatorio ? "" : " (opcional)"}</span>
          <input
            className={inputClasse}
            type={c.segredo ? "password" : "text"}
            autoComplete="off"
            value={valores[c.chave] ?? ""}
            onChange={(e) => { setTeste(null); setValores((v) => ({ ...v, [c.chave]: e.target.value })); }}
          />
          {c.ajuda && <span className="text-xs text-slate-500">{c.ajuda}</span>}
        </label>
      ))}
      {teste && (
        <div role="status" className={`rounded p-2 text-sm ${teste.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {teste.mensagem}
          {teste.avisos.length > 0 && <ul className="mt-1 list-disc pl-5">{teste.avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>
      )}
      {erro && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      <div className="flex gap-2">
        <button className="btn-secundario h-9 px-3 text-sm" disabled={Boolean(ocupado)} onClick={() => void enviar("testar")}>{ocupado === "testar" ? "Testando…" : "Testar conexão"}</button>
        <button className="btn-primario h-9 px-3 text-sm" disabled={Boolean(ocupado) || !teste?.ok} onClick={() => void enviar("salvar")}>{ocupado === "salvar" ? "Salvando…" : "Salvar"}</button>
      </div>
      {!teste?.ok && <p className="text-xs text-slate-500">Teste a conexão antes de salvar.</p>}
    </div>
  );
}
