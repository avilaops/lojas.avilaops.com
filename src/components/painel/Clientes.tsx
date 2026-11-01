"use client";

import { useMemo, useState } from "react";
import ListaDeRegistros from "@/components/aplicacao/ListaDeRegistros";
import { Secao, brl } from "./campos";
import BaixarPlanilha from "./BaixarPlanilha";

export interface ClienteView {
  email: string;
  nome: string;
  telefone: string;
  documento: string;
  temConta: boolean;
  pedidos: number;
  pedidosPagos: number;
  gastoCentavos: number;
  primeiraCompra: string;
  ultimaCompra: string;
  endereco: string;
}

type ClienteRegistro = ClienteView & { id: string };

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const ticketMedio = (cliente: ClienteView) => cliente.pedidosPagos > 0
  ? Math.round(cliente.gastoCentavos / cliente.pedidosPagos)
  : 0;

/** Só dígitos, com 55 na frente: é o formato que o WhatsApp aceita no link. */
function linkWhatsApp(telefone: string, nome: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Olá, ${nome.split(" ")[0]}! Aqui é da loja.`)}`;
}

function relacionamento(cliente: ClienteView) {
  const perfil = cliente.pedidosPagos > 1
    ? "Recorrente"
    : cliente.pedidosPagos === 1
      ? "Primeira compra"
      : cliente.pedidos > 0
        ? "Sem compra paga"
        : "Cadastro sem pedido";

  return (
    <span className="grid gap-0.5">
      <span className={cliente.pedidosPagos > 1 ? "font-medium text-emerald-700" : "font-medium"}>{perfil}</span>
      <span className="text-xs text-muted-foreground">
        {cliente.pedidosPagos} {cliente.pedidosPagos === 1 ? "compra paga" : "compras pagas"}
        {" · "}
        {cliente.pedidos} {cliente.pedidos === 1 ? "pedido registrado" : "pedidos registrados"}
      </span>
    </span>
  );
}

function contato(cliente: ClienteView) {
  return (
    <span className="grid min-w-0 gap-0.5">
      <span className="truncate">{cliente.email}</span>
      <span className="text-xs text-muted-foreground">{cliente.telefone || "Telefone não informado"}</span>
    </span>
  );
}

function acoes(cliente: ClienteView) {
  const whatsapp = linkWhatsApp(cliente.telefone, cliente.nome);
  return (
    <span className="inline-flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
      {whatsapp && <a className="underline" href={whatsapp} target="_blank" rel="noopener">WhatsApp</a>}
      <a className="underline" href={`mailto:${cliente.email}`}>e-mail</a>
    </span>
  );
}

/** Lista comercial dos clientes, com compras pagas separadas de pedidos iniciados. */
export default function Clientes({ clientes }: { clientes: ClienteView[] }) {
  const [busca, setBusca] = useState("");

  const lista = useMemo<ClienteRegistro[]>(() => {
    const termo = busca.trim().toLowerCase();
    return clientes
      .filter((cliente) => !termo || `${cliente.nome} ${cliente.email} ${cliente.telefone} ${cliente.documento} ${cliente.endereco}`.toLowerCase().includes(termo))
      .map((cliente) => ({ ...cliente, id: cliente.email }));
  }, [busca, clientes]);

  const recorrentes = clientes.filter((cliente) => cliente.pedidosPagos > 1).length;
  const faturado = clientes.reduce((total, cliente) => total + cliente.gastoCentavos, 0);
  const comprasPagas = clientes.reduce((total, cliente) => total + cliente.pedidosPagos, 0);

  return (
    <>
      <Secao titulo={`Clientes (${clientes.length})`} descricao="Contato, relacionamento e valor pago, sem confundir pedido iniciado com compra concluída.">
        {clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém comprou ainda. Assim que o primeiro pedido entrar, a pessoa aparece aqui.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Clientes recorrentes</small>
                <strong className="block text-xl">{recorrentes}</strong>
              </div>
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Total pago</small>
                <strong className="block text-xl">{brl(faturado)}</strong>
              </div>
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Ticket médio pago</small>
                <strong className="block text-xl">{brl(comprasPagas ? Math.round(faturado / comprasPagas) : 0)}</strong>
              </div>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Buscar clientes</span>
              <input
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base sm:text-sm"
                placeholder="Nome, e-mail, telefone, CPF ou endereço"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </label>

            <p className="text-xs text-muted-foreground" aria-live="polite">
              Exibindo {lista.length.toLocaleString("pt-BR")} de {clientes.length.toLocaleString("pt-BR")} clientes
            </p>

            <ListaDeRegistros
              itens={lista}
              estilo="planilha"
              rotulo="Clientes em formato de planilha"
              titulo={(cliente) => cliente.nome || "(sem nome)"}
              subtitulo={contato}
              selo={(cliente) => (
                <>
                  {relacionamento(cliente)}
                  <b className="ml-auto tabular-nums">{brl(cliente.gastoCentavos)}</b>
                </>
              )}
              colunas={[
                {
                  rotulo: "Cliente",
                  largura: "w-56",
                  celula: (cliente) => (
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">{cliente.nome || "(sem nome)"}</span>
                      <span className="truncate text-xs text-muted-foreground">{cliente.endereco || (cliente.temConta ? "Conta sem endereço" : "Compra sem conta")}</span>
                    </span>
                  ),
                },
                { rotulo: "Contato", largura: "w-52", celula: contato },
                { rotulo: "Relacionamento", largura: "w-48", celula: relacionamento },
                { rotulo: "Total gasto", largura: "w-28", numero: true, celula: (cliente) => brl(cliente.gastoCentavos) },
                { rotulo: "Ticket médio", largura: "w-28", numero: true, celula: (cliente) => brl(ticketMedio(cliente)) },
                { rotulo: "Última compra", largura: "w-28", celula: (cliente) => dia(cliente.ultimaCompra) },
              ]}
              acoes={acoes}
              vazio={<p className="py-3 text-sm text-muted-foreground">Ninguém com esse termo.</p>}
            />
          </>
        )}
      </Secao>

      <Secao titulo="Levar para fora do painel" descricao="Os dados de quem compra na sua loja são seus, e a responsabilidade por eles também (LGPD, art. 18).">
        <BaixarPlanilha
          tipo="clientes"
          rotulo="Baixar clientes:"
          ajuda="Inclui pedidos registrados e compras pagas em colunas separadas."
        />
      </Secao>
    </>
  );
}
