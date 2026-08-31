"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Secao, brl, inputClasse } from "./campos";
import FichaPedido from "./FichaPedido";
import type { PedidoView } from "./PainelLoja";

const PEDIDO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago, separar",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

const COR: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "bg-amber-100 text-amber-800",
  PAGO: "bg-blue-100 text-blue-800",
  EM_SEPARACAO: "bg-blue-100 text-blue-800",
  ENVIADO: "bg-indigo-100 text-indigo-800",
  ENTREGUE: "bg-emerald-100 text-emerald-800",
  CANCELADO: "bg-red-100 text-red-800",
  ESTORNADO: "bg-red-100 text-red-800",
};

/**
 * O pedido numa página só, com endereço próprio.
 *
 * A ficha existia como camada sobreposta dentro da lista: para olhar um pedido
 * era preciso achar a linha dele de novo a cada vez, e não havia link para
 * mandar a alguém. Aqui `/painel/pedidos/<id>` abre direto, recarrega, volta e
 * pode ser mandado por WhatsApp para quem vai embalar.
 */
export default function PedidoDetalhe({ pedido, loja }: {
  pedido: PedidoView;
  loja: { nome: string; razaoSocial: string | null; cnpj: string | null };
}) {
  const [rastreio, setRastreio] = useState(pedido.rastreio ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [imprimindo, setImprimindo] = useState(false);

  async function chamar(caminho: string, method: string, body?: unknown, sucesso = "Salvo.") {
    setErro(null); setOk(null); setOcupado(true);
    try {
      const r = await fetch(caminho, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.erro ?? "Falha.");
      setOk(sucesso);
      // Recarrega do servidor: status, etiqueta e rastreio vêm do banco, não
      // de um palpite otimista da tela.
      window.location.reload();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
      setOcupado(false);
    }
  }

  function avancar() {
    if (pedido.status === "PAGO") return chamar("/api/painel/pedidos", "PATCH", { id: pedido.id, status: "EM_SEPARACAO" }, "Pedido em separação.");
    if (pedido.status === "EM_SEPARACAO") return chamar("/api/painel/pedidos", "PATCH", { id: pedido.id, status: "ENVIADO", rastreio: rastreio.trim() || null }, "Pedido enviado.");
    if (pedido.status === "ENVIADO") return chamar("/api/painel/pedidos", "PATCH", { id: pedido.id, status: "ENTREGUE" }, "Pedido entregue.");
  }

  const e = pedido.entrega;
  const telefone = pedido.clienteTelefone.replace(/\D/g, "");
  const podeAvancar = ["PAGO", "EM_SEPARACAO", "ENVIADO"].includes(pedido.status);

  if (imprimindo) {
    return <FichaPedido pedido={pedido} loja={loja} aoFechar={() => setImprimindo(false)} />;
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/painel/pedidos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline">
          <ArrowLeft size={15} /> Pedidos
        </Link>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COR[pedido.status] ?? "bg-muted"}`}>{PEDIDO[pedido.status] ?? pedido.status}</span>
        <span className="text-sm text-muted-foreground">{new Date(pedido.criadoEm).toLocaleString("pt-BR")}</span>
        <button className="btn-secundario ml-auto inline-flex h-9 items-center gap-1.5 px-3 text-xs" onClick={() => setImprimindo(true)}>
          <Printer size={14} /> Ficha de envio
        </button>
      </div>

      {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{ok}</p>}

      {podeAvancar && (
        <Secao titulo="O que fazer agora" descricao="Um passo por vez, na ordem em que a operação acontece.">
          {pedido.status === "EM_SEPARACAO" && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Código de rastreio</span>
              <input className={inputClasse} value={rastreio} onChange={(ev) => setRastreio(ev.target.value)} placeholder="Opcional, mas o comprador agradece" />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" disabled={ocupado} onClick={avancar}>
              {pedido.status === "PAGO" ? "Separar este pedido" : pedido.status === "EM_SEPARACAO" ? "Marcar como enviado" : "Marcar como entregue"}
            </button>
            {e && pedido.status !== "AGUARDANDO_PAGAMENTO" && (
              pedido.etiqueta?.pdf ? (
                <a className="btn-secundario inline-flex items-center px-4" href={pedido.etiqueta.pdf} target="_blank" rel="noopener">Baixar etiqueta</a>
              ) : (
                <button className="btn-secundario" disabled={ocupado} onClick={() => chamar(`/api/painel/pedidos/${pedido.id}/etiqueta`, "POST", undefined, "Etiqueta solicitada.")}>
                  Gerar etiqueta
                </button>
              )
            )}
          </div>
        </Secao>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Comprador">
          <p className="font-semibold">{pedido.clienteNome}</p>
          <p className="text-sm">
            <a className="underline" href={`mailto:${pedido.clienteEmail}`}>{pedido.clienteEmail}</a>
          </p>
          {telefone.length >= 10 && (
            <p className="text-sm">
              <a className="underline" href={`https://wa.me/${telefone.startsWith("55") ? telefone : `55${telefone}`}`} target="_blank" rel="noopener">
                {pedido.clienteTelefone} (WhatsApp)
              </a>
            </p>
          )}
          {pedido.clienteDocumento && <p className="text-sm text-muted-foreground">CPF/CNPJ {pedido.clienteDocumento}</p>}
        </Secao>

        <Secao titulo="Entrega">
          {e ? (
            <address className="not-italic text-sm leading-relaxed">
              {e.logradouro}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ""}<br />
              {e.bairro}<br />
              {e.cidade}/{e.uf} · CEP {e.cep}
            </address>
          ) : (
            <p className="text-sm text-muted-foreground">Retirada na loja ou pedido sem endereço.</p>
          )}
          <p className="text-sm">{pedido.freteNome}{pedido.freteCentavos > 0 ? ` · ${brl(pedido.freteCentavos)}` : " · grátis"}</p>
          {pedido.rastreio && <p className="text-sm">Rastreio <b>{pedido.rastreio}</b></p>}
          {pedido.etiqueta && (
            <p className="text-xs text-muted-foreground">
              Etiqueta {pedido.etiqueta.status.toLowerCase()}
              {pedido.etiqueta.codigoObjeto ? ` · objeto ${pedido.etiqueta.codigoObjeto}` : ""}
              {pedido.etiqueta.custoCentavos ? ` · custo ${brl(pedido.etiqueta.custoCentavos)}` : ""}
            </p>
          )}
        </Secao>
      </div>

      <Secao titulo={`Itens (${pedido.itens.reduce((s, i) => s + i.quantidade, 0)})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Item</th><th>SKU</th><th>Qtd</th><th className="text-right">Valor</th></tr>
            </thead>
            <tbody>
              {pedido.itens.map((i, n) => (
                <tr key={`${i.sku ?? i.nome}-${n}`} className="border-t border-border">
                  <td className="py-2">{i.nome}</td>
                  <td className="text-muted-foreground">{i.sku ?? "-"}</td>
                  <td>{i.quantidade}</td>
                  <td className="whitespace-nowrap text-right">{brl(i.precoUnitarioCentavos * i.quantidade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="ml-auto grid w-full max-w-xs gap-1 text-sm sm:w-64">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{brl(pedido.subtotalCentavos)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Frete</dt><dd>{brl(pedido.freteCentavos)}</dd></div>
          {pedido.descontoCentavos > 0 && (
            <div className="flex justify-between"><dt className="text-muted-foreground">Desconto{pedido.cupomCodigo ? ` (${pedido.cupomCodigo})` : ""}</dt><dd>- {brl(pedido.descontoCentavos)}</dd></div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Total</dt><dd>{brl(pedido.totalCentavos)}</dd></div>
          <div className="flex justify-between text-xs text-muted-foreground"><dt>Pago com</dt><dd>{pedido.meioPagamento}</dd></div>
          <div className="flex justify-between text-xs text-muted-foreground"><dt>Referência</dt><dd>{pedido.referencia}</dd></div>
        </dl>
      </Secao>
    </div>
  );
}
