import type { Metadata } from "next";
import Link from "next/link";
import { exigirTenant } from "@/lib/tenant";
import { compradorAtual } from "@/lib/conta";
import { prisma } from "@/lib/db";
import { formatarBRL } from "@/lib/catalogo";
import ContaForm from "@/components/conta/ContaForm";
import EnderecosSalvos from "@/components/conta/EnderecosSalvos";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };
export const dynamic = "force-dynamic";

const ROTULO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PAGO: "Pagamento confirmado",
  EM_SEPARACAO: "Em separação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  ESTORNADO: "Estornado",
};

export default async function ContaPage() {
  const t = await exigirTenant();
  const c = await compradorAtual(t);

  if (!c) {
    return (
      <div className="container-loja max-w-md py-14">
        <h1 className="text-2xl font-bold">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acompanhe seus pedidos e guarde seu endereço para comprar mais rápido da próxima vez.</p>
        <div className="mt-6"><ContaForm /></div>
      </div>
    );
  }

  const [pedidos, enderecos] = await Promise.all([
    prisma.pedido.findMany({ where: { compradorId: c.id }, include: { itens: true }, orderBy: { criadoEm: "desc" }, take: 50 }),
    prisma.enderecoComprador.findMany({ where: { compradorId: c.id }, orderBy: [{ principal: "desc" }] }),
  ]);

  return (
    <div className="container-loja max-w-3xl py-10">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {c.nome.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{c.email}</p>
        </div>
        <form action="/api/conta/sair" method="post" className="ml-auto">
          <button className="btn-secundario h-9 px-3 text-xs">Sair</button>
        </form>
      </header>

      <section>
        <h2 className="mb-3 text-base font-bold">Meus pedidos</h2>
        {pedidos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Você ainda não fez pedidos. <Link href="/produtos" className="underline">Ver produtos</Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {pedidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Pedido #{p.numero} · {ROTULO[p.status] ?? p.status}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.criadoEm).toLocaleDateString("pt-BR")} · {p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}</p>
                  {p.rastreio && <p className="text-xs">Rastreio: <strong>{p.rastreio}</strong></p>}
                </div>
                <span className="font-bold">{formatarBRL(p.totalCentavos)}</span>
                <Link href={`/pedido/${p.referencia}`} className="text-xs underline">detalhes</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-bold">Meus endereços</h2>
        <EnderecosSalvos enderecos={enderecos.map((e) => ({ id: e.id, apelido: e.apelido, cep: e.cep, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, principal: e.principal }))} />
      </section>
    </div>
  );
}
