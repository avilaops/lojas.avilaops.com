"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Unlink } from "lucide-react";
import { Secao, brl } from "./campos";

/** O que o retorno do Melhor Envio diz, na língua do lojista. */
const RETORNO: Record<string, { tom: "ok" | "erro"; texto: string }> = {
  conectado: { tom: "ok", texto: "Conta do Melhor Envio conectada. O frete já é cotado no checkout." },
  recusado: { tom: "erro", texto: "Você não autorizou a conexão. Nada mudou na loja." },
  incompleto: { tom: "erro", texto: "A autorização voltou incompleta ou vencida. Clique em conectar de novo." },
  falhou: { tom: "erro", texto: "O Melhor Envio não concluiu a conexão. Tente de novo em alguns minutos." },
  indisponivel: { tom: "erro", texto: "A conexão com o Melhor Envio ainda não está liberada nesta instalação." },
  "sem-permissao": { tom: "erro", texto: "Seu acesso não permite conectar a conta de frete. Fale com o dono da loja." },
};

const dataHora = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

interface Prova {
  ok: boolean;
  mensagem: string;
  opcoes?: Array<{ nome: string; preco: number; prazoDiasUteis: number }>;
}

/**
 * Plugin de frete: a conta do Melhor Envio da loja.
 *
 * Fica na seção Entrega porque é lá que o lojista decide como o pedido chega.
 * Conectado, ele vem antes da tabela por UF na cotação; desconectado, a tabela
 * volta a valer sozinha. Nada do que está preenchido abaixo se perde.
 */
export default function MelhorEnvio({ conexao, integracaoDisponivel, temCepOrigem, retorno }: {
  conexao: { conectado: boolean; conta: string | null; conectadoEm: string | null };
  integracaoDisponivel: boolean;
  temCepOrigem: boolean;
  retorno?: string;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prova, setProva] = useState<Prova | null>(null);
  const aviso = retorno ? RETORNO[retorno] : undefined;

  async function chamar(chave: string, method: "POST" | "DELETE") {
    setErro(null);
    setProva(null);
    setOcupado(chave);
    try {
      const r = await fetch("/api/painel/entrega/melhor-envio", { method });
      const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof dados.erro === "string" ? dados.erro : "Falha.");
      if (chave === "testar") setProva(dados as unknown as Prova);
      else router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const desconectar = () => {
    if (!confirm("Desconectar o Melhor Envio? O checkout volta a usar só a tabela de frete da loja.")) return;
    void chamar("desconectar", "DELETE");
  };

  return (
    <Secao
      titulo="Melhor Envio"
      descricao="Conecte a sua conta e o checkout passa a cotar Correios, Jadlog e as outras transportadoras na hora, com o preço do seu contrato."
    >
      {aviso && (
        <p className={`rounded-lg p-3 text-sm ${aviso.tom === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          {aviso.texto}
        </p>
      )}
      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

      {conexao.conectado ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <Check size={18} className="flex-none text-emerald-600" />
            <span className="flex-1 text-sm">
              <b className="block">{conexao.conta ?? "Conta conectada"}</b>
              {conexao.conectadoEm && <span className="text-xs text-muted-foreground">conectada em {dataHora(conexao.conectadoEm)}</span>}
            </span>
            <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => void chamar("testar", "POST")}>
              {ocupado === "testar" ? "Cotando…" : "Testar cotação"}
            </button>
            <button className="btn-secundario inline-flex h-9 items-center gap-1.5 px-3 text-xs" disabled={Boolean(ocupado)} onClick={desconectar}>
              <Unlink size={14} /> Desconectar
            </button>
          </div>

          {!temCepOrigem && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Falta o CEP de origem da loja. Sem ele nenhuma transportadora cota: preencha o endereço em Dados da empresa.
            </p>
          )}

          {prova && (
            <div className={`rounded-lg p-3 text-sm ${prova.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
              <p>{prova.mensagem}</p>
              {prova.opcoes && prova.opcoes.length > 0 && (
                <ul className="mt-2 grid gap-1">
                  {prova.opcoes.map((o) => (
                    <li key={o.nome} className="flex justify-between gap-3">
                      <span>{o.nome} · {o.prazoDiasUteis} {o.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"}</span>
                      <b>{brl(o.preco)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            A etiqueta ainda é comprada na sua conta do Melhor Envio: depois de despachar, cole o código de rastreio no pedido.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Ao conectar, você autoriza a loja a consultar preço e prazo de frete na sua conta. Ela não compra etiqueta nem
            movimenta saldo. Se desconectar, o checkout volta para a tabela de frete abaixo.
          </p>
          {integracaoDisponivel ? (
            <div>
              <a className="btn-primario inline-flex items-center gap-2" href="/api/painel/entrega/melhor-envio">
                <Link2 size={15} /> Conectar Melhor Envio
              </a>
            </div>
          ) : (
            // Sem o aplicativo cadastrado na plataforma, o botão levaria a uma
            // tela de erro do próprio Melhor Envio, que parece defeito da loja.
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              A conexão com o Melhor Envio ainda não está liberada nesta instalação da plataforma. Fale com a Avila Ops:
              enquanto isso, a tabela de frete abaixo continua valendo.
            </p>
          )}
        </>
      )}
    </Secao>
  );
}
