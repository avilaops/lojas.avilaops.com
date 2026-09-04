"use client";

import { useState } from "react";
import Link from "next/link";
import { Secao, brl, inputClasse } from "./campos";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import Filtros from "@/components/aplicacao/Filtros";
import Vazio from "@/components/aplicacao/Vazio";
import type { PedidoView } from "./PainelLoja";

/**
 * Os pedidos da loja.
 *
 * A tela era uma tabela de sete colunas, com até quatro botões de 36px
 * empilhados dentro da última: abrir, gerar etiqueta, baixar etiqueta e avançar
 * a situação. No celular isso obriga a rolar de lado para chegar na ação, e a
 * mirar num alvo menor que o mínimo da Apple, com o pedido de um cliente real
 * do outro lado.
 *
 * A regra aqui é uma ação principal por pedido, a que faz o pedido andar. As
 * demais moram na tela do pedido, onde há espaço para explicá-las.
 */
const SITUACAO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pago",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

/** O passo que faz o pedido andar, e o rótulo que o lojista entende. */
const PROXIMO: Record<string, string> = {
  PAGO: "Separar",
  EM_SEPARACAO: "Marcar enviado",
  ENVIADO: "Marcar entregue",
};

const FICHAS = [
  { valor: "", rotulo: "Todos" },
  { valor: "PAGO", rotulo: "A separar" },
  { valor: "EM_SEPARACAO", rotulo: "Separando" },
  { valor: "ENVIADO", rotulo: "Enviados" },
  { valor: "AGUARDANDO_PAGAMENTO", rotulo: "Aguardando pagamento" },
];

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export default function Pedidos({
  pedidos,
  chamar,
  ocupado,
}: {
  pedidos: PedidoView[];
  chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;
  ocupado: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [rastreio, setRastreio] = useState<Record<string, string>>({});

  const termo = busca.trim().toLowerCase();
  const lista = pedidos.filter((p) => {
    if (situacao && p.status !== situacao) return false;
    if (!termo) return true;
    // O numero do pedido e inteiro no banco, e quem procura digita "1042"
    // ou "#1042". O telefone so entra com quatro digitos ou mais: com menos,
    // "12" casaria com metade da carteira.
    const so = termo.replace(/\D/g, "");
    return (
      (so.length > 0 && String(p.numero).includes(so)) ||
      p.referencia.toLowerCase().includes(termo) ||
      p.clienteNome.toLowerCase().includes(termo) ||
      (so.length >= 4 && p.clienteTelefone.replace(/\D/g, "").includes(so))
    );
  });

  function avancar(p: PedidoView) {
    const corpo: Record<string, unknown> = { id: p.id };
    if (p.status === "EM_SEPARACAO" && rastreio[p.id]) corpo.rastreio = rastreio[p.id];
    chamar("/api/painel/pedidos", "PATCH", corpo, "Pedido atualizado.");
  }

  const cliente = (p: PedidoView) => (
    <>
      {p.clienteNome}
      {p.itens.length > 0 && (
        <span className="text-muted-foreground">
          {" · "}
          {p.itens.length} {p.itens.length === 1 ? "item" : "itens"}
        </span>
      )}
    </>
  );

  const acao = (p: PedidoView) =>
    PROXIMO[p.status] ? (
      <button className="btn-secundario inline-flex h-11 items-center px-3 text-xs" disabled={ocupado} onClick={() => avancar(p)}>
        {PROXIMO[p.status]}
      </button>
    ) : null;

  return (
    <Secao titulo="Pedidos" descricao="Procure pelo número, nome ou telefone. Toque no pedido para ver os itens, o endereço e a etiqueta.">
      <Filtros
        busca={busca}
        aoBuscar={setBusca}
        exemplo="Número do pedido, nome ou telefone"
        fichas={FICHAS}
        ativa={situacao}
        aoEscolher={setSituacao}
      />

      <ListaDeRegistros
        itens={lista}
        href={(p) => `/painel/pedidos/${p.id}`}
        titulo={(p) => (
          <>
            <span className="font-mono">#{p.numero}</span>
            <span className="ml-2 font-normal text-muted-foreground">{dia(p.criadoEm)}</span>
          </>
        )}
        subtitulo={cliente}
        selo={(p) => (
          <>
            <b className="tabular-nums">{brl(p.totalCentavos)}</b>
            <span className="text-muted-foreground">{SITUACAO[p.status] ?? p.status}</span>
            {/* O código de rastreio aparece onde ele é digitado: quando o
                pedido está em separação e falta despachar. */}
            {p.status === "EM_SEPARACAO" && (
              <input
                className={`${inputClasse} ml-auto h-11 w-40`}
                placeholder="Código de rastreio"
                value={rastreio[p.id] ?? ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setRastreio({ ...rastreio, [p.id]: e.target.value })}
              />
            )}
            {acao(p) && <span className="ml-auto">{acao(p)}</span>}
          </>
        )}
        colunas={[
          { rotulo: "Pedido", celula: (p) => <span className="font-mono">#{p.numero}</span>, largura: "w-28" },
          { rotulo: "Cliente", celula: cliente },
          { rotulo: "Total", celula: (p) => brl(p.totalCentavos), largura: "w-28", numero: true },
          { rotulo: "Situação", celula: (p) => SITUACAO[p.status] ?? p.status, largura: "w-40" },
          { rotulo: "Data", celula: (p) => dia(p.criadoEm), largura: "w-24" },
        ]}
        acoes={acao}
        vazio={
          <Vazio
            titulo={busca || situacao ? "Nenhum pedido com esse filtro." : "Nenhum pedido ainda."}
            texto={
              busca || situacao
                ? "Tente outro termo, ou volte para “Todos”."
                : "Quando alguém comprar, o pedido aparece aqui com os itens, o endereço e a etiqueta de envio."
            }
            acao={busca || situacao ? { rotulo: "Ver todos", onClick: () => { setBusca(""); setSituacao(""); } } : undefined}
          />
        }
      />

      {pedidos.length > 0 && (
        <p className="text-sm">
          <a href="/api/painel/exportar?tipo=pedidos" className="btn-secundario inline-flex h-11 items-center px-4">
            Baixar pedidos (CSV)
          </a>
        </p>
      )}
    </Secao>
  );
}
