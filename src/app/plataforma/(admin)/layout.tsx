import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";
import NavPainel from "@/components/painel/NavPainel";
import BuscaPainel from "@/components/painel/BuscaPainel";
import "../plataforma.css";
import "./painel.css";
import type { Viewport } from "next";

/**
 * `viewport-fit=cover` é o que faz `env(safe-area-inset-*)` valer algo no
 * iPhone: sem ele os insets são zero e a barra do topo encosta na Dynamic
 * Island. Só no painel, que é onde há chrome escuro colado nas bordas.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/**
 * O painel tem chrome próprio.
 *
 * Antes ele vivia dentro do layout de venda da plataforma: cabeçalho com
 * "Planos" e "Criar minha loja", rodapé institucional, tudo em volta de quem
 * já é cliente e está ali para trabalhar. Aqui não entra nada disso; a tela
 * inteira é a operação da loja.
 *
 * A sessão é conferida uma vez, no layout, e não em cada página.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const loja = await lojistaAtual();
  if (!loja) redirect("/entrar");

  // O pedido pago é o único que cobra ação agora: o dinheiro entrou e o
  // produto ainda não saiu. Uma contagem por navegação é barata e evita que a
  // venda durma esperando alguém abrir a aba certa por conta própria.
  const aSeparar = await prisma.pedido.count({ where: { tenantId: loja.id, status: "PAGO" } });

  return (
    <div className="padm">
      <NavPainel nome={loja.nome} urlLoja={urlDaLoja(loja)} aSeparar={aSeparar} />
      <BuscaPainel />
      <main className="padm-conteudo pl-workspace">{children}</main>
    </div>
  );
}
