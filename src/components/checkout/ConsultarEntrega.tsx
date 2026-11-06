"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FRETE_RETIRADA_ID, type OpcaoFrete } from "@avilaops/checkout";
import { consultarFrete, type ItemParaFrete } from "@/lib/cotacao-frete";
import { formatarBRL } from "@/lib/catalogo";
import { LinkContatoMedido } from "@/components/EventoFunil";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";

type Cotacao = { chave: string; opcoes?: OpcaoFrete[]; erro?: string; buscando?: boolean };

/** Consulta pública: não cria contato, pedido, reserva nem cobrança. */
export default function ConsultarEntrega({ itens, subtotal, desconto = 0, cupom, whatsapp, localRetirada }: {
  itens: ItemParaFrete[];
  subtotal: number;
  desconto?: number;
  cupom?: string;
  whatsapp?: string | null;
  localRetirada?: { endereco: string; horario: string | null } | null;
}) {
  const id = useId();
  const [cep, setCep] = useState("");
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const requisicao = useRef<AbortController | null>(null);
  // CEP, quantidades, preço e cupom compõem a cotação: resultados de outro
  // contexto somem imediatamente, mesmo antes do cleanup do efeito.
  const chave = JSON.stringify({ cep, itens, subtotal, desconto, cupom });
  const atual = cotacao?.chave === chave ? cotacao : null;
  useEffect(() => () => requisicao.current?.abort(), [chave]);

  async function calcular(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    requisicao.current?.abort();
    const controle = new AbortController();
    requisicao.current = controle;
    if (cep.length !== 8) {
      setCotacao({ chave, erro: "Informe um CEP com 8 dígitos." });
      return;
    }
    setCotacao({ chave, buscando: true });
    const limite = setTimeout(() => controle.abort(), 30_000);
    try {
      const opcoes = await consultarFrete({ cep, itens, cupom }, controle.signal);
      if (!controle.signal.aborted) setCotacao({ chave, opcoes });
    } catch {
      if (requisicao.current === controle) setCotacao({ chave, erro: "Não foi possível calcular agora. Tente novamente ou fale com a loja." });
    } finally {
      clearTimeout(limite);
    }
  }

  return (
    <section className="my-4 min-w-0 rounded-xl border border-border bg-card p-4" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="text-base font-semibold">Calcule entrega e prazo</h2>
      <p className="mt-1 text-xs text-muted-foreground">Só precisa do CEP. Sem cadastro.</p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={calcular}>
        <label className="sr-only" htmlFor={`${id}-cep`}>CEP para calcular a entrega</label>
        <input id={`${id}-cep`} type="text" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          value={cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep}
          onChange={e => setCep(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        <button type="submit" className="btn-secundario min-h-11 shrink-0 px-3 text-sm" disabled={atual?.buscando}>
          {atual?.buscando ? "Calculando…" : "Calcular entrega"}
        </button>
      </form>
      <div aria-live="polite" aria-atomic="true">
        {atual?.erro && <p role="alert" className="mt-3 text-sm text-red-700">{atual.erro}</p>}
        {atual?.opcoes && <>
          {!atual.opcoes.some(o => o.id !== FRETE_RETIRADA_ID) && <p className="mt-3 text-sm">Não encontramos entrega pelo site para este CEP.{atual.opcoes.length > 0 ? " Você pode escolher a retirada abaixo." : " Consulte a loja para combinar o recebimento."}</p>}
          <ul className="mt-3 space-y-3 text-sm">
            {atual.opcoes.map(opcao => <li key={opcao.id} className="border-t border-border pt-3">
              <div className="flex flex-wrap justify-between gap-2"><strong>{opcao.nome}</strong><strong>{opcao.preco === 0 ? (opcao.id === FRETE_RETIRADA_ID ? "Retirada grátis" : "Grátis") : formatarBRL(opcao.preco)}</strong></div>
              <p className="mt-1 text-xs text-muted-foreground">{opcao.prazoDiasUteis === 0 ? "Prazo conforme disponibilidade da loja" : `Até ${opcao.prazoDiasUteis} ${opcao.prazoDiasUteis === 1 ? "dia útil" : "dias úteis"}`}</p>
              {opcao.id === FRETE_RETIRADA_ID && localRetirada && <div className="mt-2 text-xs">
                <p><b>Local de retirada:</b> {localRetirada.endereco}</p>
                {localRetirada.horario && <p className="mt-1"><b>Horário:</b> {localRetirada.horario}</p>}
                <p className="mt-1 text-muted-foreground">Aguarde a confirmação de que o pedido está pronto antes de ir à loja.</p>
              </div>}
              <p className="mt-1 text-xs">Produtos + {opcao.id === FRETE_RETIRADA_ID ? "retirada" : "entrega"}: <b>{formatarBRL(Math.max(0, subtotal - desconto) + opcao.preco)}</b></p>
            </li>)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Estimativa para estes itens. Confirme a opção e o total no checkout.</p>
        </>}
      </div>
      {whatsapp && (atual?.erro || (atual?.opcoes && !atual.opcoes.some(o => o.id !== FRETE_RETIRADA_ID))) && <LinkContatoMedido className="mt-3 inline-block text-sm underline" href={linkWhatsApp(whatsapp, "Olá! Quero consultar as opções de entrega para uma compra no site.")} target="_blank" rel="noopener noreferrer">Consultar entrega com a loja</LinkContatoMedido>}
    </section>
  );
}
