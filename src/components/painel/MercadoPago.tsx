"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Unlink } from "lucide-react";
import { Secao } from "./campos";

/** O que o retorno do Mercado Pago diz, na língua do lojista. */
const RETORNO: Record<string, { tom: "ok" | "erro"; texto: string }> = {
  conectado: { tom: "ok", texto: "Conta do Mercado Pago conectada. A loja já pode receber por Pix, cartão e boleto." },
  recusado: { tom: "erro", texto: "Você não autorizou a conexão. Nada mudou na loja." },
  incompleto: { tom: "erro", texto: "A autorização voltou incompleta ou vencida. Clique em conectar de novo." },
  falhou: { tom: "erro", texto: "O Mercado Pago não concluiu a conexão. Nada mudou na loja: tente de novo em alguns minutos." },
  teste: { tom: "erro", texto: "A conta que autorizou é de teste, e venda nela não é dinheiro de verdade. Entre no Mercado Pago com a conta da loja e conecte de novo." },
  indisponivel: { tom: "erro", texto: "A conexão com o Mercado Pago ainda não está liberada nesta instalação." },
  "sem-permissao": { tom: "erro", texto: "Seu acesso não permite trocar a conta de recebimento. Fale com o dono da loja." },
};

const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

interface Diagnostico {
  ok: boolean;
  mensagem: string;
  conta?: { apelido: string | null; email: string | null };
  avisos: string[];
}

/**
 * A conta do Mercado Pago da loja, conectada por autorização.
 *
 * Fica acima das chaves coladas porque é o caminho que o lojista faz sozinho:
 * ele entra no Mercado Pago, autoriza e volta recebendo. Não há chave para
 * copiar nem webhook para cadastrar. Quem já cola as chaves segue como está,
 * e conectar por aqui as substitui.
 */
export default function MercadoPago({ conexao, integracaoDisponivel, retorno }: {
  conexao: { porOAuth: boolean; porChaves: boolean; conta: string | null; conectadoEm: string | null };
  integracaoDisponivel: boolean;
  retorno?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<Diagnostico | null>(null);
  const aviso = retorno ? RETORNO[retorno] : undefined;

  async function chamar(chave: "testar" | "desconectar") {
    setErro(null);
    setDiagnostico(null);
    setOcupado(chave);
    try {
      const r = chave === "testar"
        ? await fetch("/api/painel/recebimento", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
        : await fetch("/api/painel/recebimento/mercado-pago", { method: "DELETE" });
      const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : "Falha.");
      if (chave === "testar") setDiagnostico(dados as unknown as Diagnostico);
      else router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const desconectar = () => {
    if (!confirm("Desconectar o Mercado Pago? A loja para de receber até você conectar de novo: o cliente monta o carrinho e não consegue pagar.")) return;
    void chamar("desconectar");
  };

  return (
    <Secao
      titulo="Recebimento (Mercado Pago)"
      descricao="Conecte a sua conta e a loja passa a receber por Pix, cartão e boleto. O dinheiro cai direto no seu Mercado Pago."
    >
      {aviso && (
        <p className={`rounded-lg p-3 text-sm ${aviso.tom === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {conexao.porOAuth ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <Check size={18} className="flex-none text-emerald-600" />
            <span className="flex-1 text-sm">
              <b className="block">{conexao.conta ?? "Conta conectada"}</b>
              {conexao.conectadoEm && <span className="text-xs text-muted-foreground">conectada em {data(conexao.conectadoEm)}</span>}
            </span>
            <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => void chamar("testar")}>
              {ocupado === "testar" ? "Testando…" : "Testar recebimento"}
            </button>
            <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={Boolean(ocupado)} onClick={desconectar}>
              <Unlink size={14} /> Desconectar
            </button>
          </div>

          {diagnostico && (
            <div className={`rounded-lg p-3 text-sm ${diagnostico.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              <p className="font-semibold">{diagnostico.mensagem}</p>
              {diagnostico.avisos.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {diagnostico.avisos.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A autorização pode ser desfeita a qualquer momento aqui ou no seu Mercado Pago, em Seu negócio → Configurações → Aplicativos conectados.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {conexao.porChaves
              ? "A loja recebe hoje pelas chaves coladas abaixo. Conectando a conta, elas deixam de ser usadas e você não precisa mais cuidar de chave nem de webhook."
              : "Você entra no Mercado Pago, autoriza a loja a cobrar em seu nome e volta para cá recebendo. Não há chave para copiar. A loja não saca nem movimenta o seu saldo."}
          </p>
          {integracaoDisponivel ? (
            <div>
              <a className="btn-primario inline-flex items-center gap-2" href="/api/painel/recebimento/mercado-pago">
                <Link2 size={15} /> Conectar Mercado Pago
              </a>
            </div>
          ) : (
            // Sem o aplicativo cadastrado na plataforma, o botão levaria a uma
            // tela de erro do próprio Mercado Pago, que parece defeito da loja.
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              A conexão com o Mercado Pago ainda não está liberada nesta instalação da plataforma. Enquanto isso, use as chaves abaixo.
            </p>
          )}
        </>
      )}
    </Secao>
  );
}
