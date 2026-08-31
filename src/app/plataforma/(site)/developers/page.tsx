import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Desenvolvedores & IA | Lojas Ávila Ops",
  description: "Documentação do conector MCP e APIs para automação e integração de e-commerce com IA.",
};

export default function DevelopersPage() {
  return (
    <div className="container-loja py-16 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Documentação Técnica</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Conector MCP & Automações</h1>
        <p className="mt-3 text-muted-foreground">
          Conecte o Claude, Cursor, Antigravity e agentes autônomos ao seu e-commerce via Model Context Protocol (MCP).
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Endpoint MCP Oficial</h2>
          <code className="mt-3 block rounded-lg bg-muted p-3 text-sm font-mono">
            https://lojas.avilaops.com/api/mcp
          </code>
          <p className="mt-3 text-sm text-muted-foreground">
            Autenticação via Header: <code className="font-mono text-xs">Authorization: Bearer lojas_live_&lt;slug&gt;_&lt;token&gt;</code> (exclusivo do plano Loja Pro).
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Ferramentas Disponíveis</h2>
          <ul className="mt-4 divide-y divide-border text-sm text-muted-foreground">
            <li className="py-2.5"><strong className="text-foreground">obter_loja:</strong> Consulta informações gerais, catálogo e status operacional.</li>
            <li className="py-2.5"><strong className="text-foreground">atualizar_marca:</strong> Atualiza cores, layout visual, slogan e avisos.</li>
            <li className="py-2.5"><strong className="text-foreground">criar_produto / atualizar_produto:</strong> Gerencia produtos, estoque, fotos e medidas.</li>
            <li className="py-2.5"><strong className="text-foreground">listar_pedidos / emitir_etiqueta_envio:</strong> Consulta vendas e despacha etiquetas de frete via CepCerto.</li>
            <li className="py-2.5"><strong className="text-foreground">resumo_vendas:</strong> Relatório financeiro e métricas de conversão.</li>
          </ul>
        </div>
      </div>

      <div className="mt-10 flex gap-4">
        <Link href="/" className="btn-secundario">Voltar ao início</Link>
        <Link href="/painel" className="btn-primario">Acessar Painel</Link>
      </div>
    </div>
  );
}
