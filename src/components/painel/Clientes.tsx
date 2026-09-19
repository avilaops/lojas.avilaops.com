"use client";

import { useMemo, useState } from "react";
import { Secao, brl } from "./campos";
import BaixarPlanilha from "./BaixarPlanilha";

export interface ClienteView {
  email: string;
  nome: string;
  telefone: string;
  documento: string;
  temConta: boolean;
  pedidos: number;
  gastoCentavos: number;
  primeiraCompra: string;
  ultimaCompra: string;
  endereco: string;
}

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Só dígitos, com 55 na frente: é o formato que o WhatsApp aceita no link. */
function linkWhatsApp(telefone: string, nome: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const numero = digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(`Olá, ${nome.split(" ")[0]}! Aqui é da loja.`)}`;
}

/**
 * A lista de quem já comprou.
 *
 * O painel sabia quanto cada pessoa gastou desde que o CSV existe, mas só
 * dentro de um arquivo que ninguém baixa: para falar com um cliente bom o
 * lojista tinha que abrir o Excel. Aqui a mesma apuração fica na tela, ordenada
 * por quanto a pessoa já deixou na loja, com o WhatsApp a um toque.
 */
export default function Clientes({ clientes }: { clientes: ClienteView[] }) {
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => `${c.nome} ${c.email} ${c.telefone} ${c.documento}`.toLowerCase().includes(termo));
  }, [busca, clientes]);

  const recorrentes = clientes.filter((c) => c.pedidos > 1).length;
  const faturado = clientes.reduce((s, c) => s + c.gastoCentavos, 0);

  return (
    <>
      <Secao titulo={`Clientes (${clientes.length})`} descricao="Quem comprou, quanto já gastou e como falar com a pessoa. Inclui quem comprou sem criar conta.">
        {clientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém comprou ainda. Assim que o primeiro pedido entrar, a pessoa aparece aqui.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Compraram mais de uma vez</small>
                <strong className="block text-xl">{recorrentes}</strong>
              </div>
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Faturado com eles</small>
                <strong className="block text-xl">{brl(faturado)}</strong>
              </div>
              <div className="rounded-lg border border-border p-3">
                <small className="text-xs uppercase text-muted-foreground">Ticket médio por cliente</small>
                <strong className="block text-xl">{brl(clientes.length ? Math.round(faturado / clientes.length) : 0)}</strong>
              </div>
            </div>

            <input
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Buscar por nome, e-mail, telefone ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Cliente</th><th>Pedidos</th><th>Gastou</th><th>Última compra</th><th></th></tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const wa = linkWhatsApp(c.telefone, c.nome);
                    return (
                      <tr key={c.email} className="border-t border-border align-top">
                        <td className="py-2">
                          <span className="block font-medium">{c.nome || "(sem nome)"}</span>
                          <span className="block text-xs text-muted-foreground">{c.email}</span>
                          {c.endereco && <span className="block text-xs text-muted-foreground">{c.endereco}</span>}
                        </td>
                        <td>{c.pedidos}</td>
                        <td className="whitespace-nowrap">{brl(c.gastoCentavos)}</td>
                        <td className="whitespace-nowrap">{dia(c.ultimaCompra)}</td>
                        <td className="whitespace-nowrap text-right text-xs">
                          {wa && <a className="mr-3 underline" href={wa} target="_blank" rel="noopener">WhatsApp</a>}
                          <a className="underline" href={`mailto:${c.email}`}>e-mail</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lista.length === 0 && <p className="py-3 text-sm text-muted-foreground">Ninguém com esse termo.</p>}
            </div>
          </>
        )}
      </Secao>

      <Secao titulo="Levar para fora do painel" descricao="Os dados de quem compra na sua loja são seus, e a responsabilidade por eles também (LGPD, art. 18).">
        <BaixarPlanilha
          tipo="clientes"
          rotulo="Baixar clientes:"
          ajuda="Mesma apuração desta tela, num arquivo que abre direto no Excel."
        />
      </Secao>
    </>
  );
}
