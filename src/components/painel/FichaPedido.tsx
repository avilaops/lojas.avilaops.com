"use client";

import { formatarBRL } from "@/lib/catalogo";
import type { PedidoView } from "./PainelLoja";

/**
 * A ficha de expedição: o papel que o lojista tem do lado enquanto embala.
 *
 * Existia um buraco constrangedor aqui — o painel mostrava cliente, itens e
 * total, mas **não mostrava o endereço de entrega**. Para despachar, o lojista
 * teria que abrir o e-mail ou perguntar ao comprador.
 *
 * Também é a base da declaração de conteúdo: item, quantidade e valor são
 * exatamente o que os Correios pedem no formulário.
 */
export default function FichaPedido({ pedido, loja, aoFechar }: { pedido: PedidoView; loja: { nome: string; razaoSocial: string | null; cnpj: string | null }; aoFechar: () => void }) {
  const e = pedido.entrega;
  const digitos = (v: string) => v.replace(/\D/g, "");

  return (
    <section className="ficha-pedido rounded-2xl border border-primary/40 bg-card p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Pedido #{pedido.numero}</h3>
          <p className="text-xs text-muted-foreground">
            {pedido.referencia} · {new Date(pedido.criadoEm).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="ficha-acoes flex gap-2">
          <button className="btn-secundario h-9 px-3 text-xs" onClick={() => window.print()}>Imprimir</button>
          <button className="btn-secundario h-9 px-3 text-xs" onClick={aoFechar}>Fechar</button>
        </div>
      </header>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="ficha-rotulo">Entregar para</p>
          <p className="font-semibold">{pedido.clienteNome}</p>
          {e ? (
            <address className="mt-1 not-italic text-sm leading-relaxed">
              {e.logradouro}, {e.numero}
              {e.complemento ? `, ${e.complemento}` : ""}
              <br />
              {e.bairro}
              <br />
              {e.cidade}/{e.uf} · CEP {e.cep}
            </address>
          ) : (
            <p className="mt-1 text-sm font-semibold text-amber-700">Retirada na loja, não despachar</p>
          )}
          <p className="mt-2 text-sm">
            <a className="underline" href={`https://wa.me/${digitos(pedido.clienteTelefone)}`} target="_blank" rel="noopener">
              {pedido.clienteTelefone}
            </a>
            {pedido.clienteEmail && (
              <>
                <br />
                {pedido.clienteEmail}
              </>
            )}
            {pedido.clienteDocumento && (
              <>
                <br />
                <span className="text-muted-foreground">CPF/CNPJ {pedido.clienteDocumento}</span>
              </>
            )}
          </p>
        </div>

        <div>
          <p className="ficha-rotulo">Remetente</p>
          <p className="font-semibold">{loja.razaoSocial ?? loja.nome}</p>
          {loja.cnpj && <p className="text-sm text-muted-foreground">CNPJ {loja.cnpj}</p>}
          <p className="ficha-rotulo mt-4">Envio</p>
          <p className="text-sm">{pedido.freteNome}</p>
          {pedido.rastreio && <p className="text-sm">Rastreio <b>{pedido.rastreio}</b></p>}
          <p className="ficha-rotulo mt-4">Pagamento</p>
          <p className="text-sm">{pedido.meioPagamento} · {formatarBRL(pedido.totalCentavos)}</p>
        </div>
      </div>

      <table className="ficha-itens mt-6 w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2">Qtd</th>
            <th>Item</th>
            <th className="text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {pedido.itens.map((i, n) => (
            <tr key={n} className="border-t border-border">
              <td className="py-2 align-top">{i.quantidade}</td>
              <td className="align-top">
                {i.nome}
                {i.sku && <span className="block text-xs text-muted-foreground">SKU {i.sku}</span>}
              </td>
              <td className="text-right align-top">{formatarBRL(i.precoUnitarioCentavos * i.quantidade)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr className="border-t border-border">
            <td colSpan={2} className="py-1 text-right text-muted-foreground">Frete</td>
            <td className="text-right">{formatarBRL(pedido.freteCentavos)}</td>
          </tr>
          {pedido.descontoCentavos > 0 && (
            <tr>
              <td colSpan={2} className="py-1 text-right text-muted-foreground">Desconto{pedido.cupomCodigo ? ` (${pedido.cupomCodigo})` : ""}</td>
              <td className="text-right">− {formatarBRL(pedido.descontoCentavos)}</td>
            </tr>
          )}
          <tr className="border-t border-border font-bold">
            <td colSpan={2} className="py-2 text-right">Total</td>
            <td className="text-right">{formatarBRL(pedido.totalCentavos)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="ficha-aviso mt-4 text-xs text-muted-foreground">
        Confira o conteúdo antes de lacrar. Esta lista é a mesma que vale para a declaração de conteúdo do envio.
      </p>
    </section>
  );
}
