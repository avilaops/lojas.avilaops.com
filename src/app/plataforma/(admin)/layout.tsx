import { redirect } from "next/navigation";
import { lojistaAtual } from "@/lib/sessao";
import { urlDaLoja } from "@/lib/tenant";
import NavPainel from "@/components/painel/NavPainel";
import "../plataforma.css";
import "./painel.css";

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
  return (
    <div className="padm">
      <NavPainel nome={loja.nome} urlLoja={urlDaLoja(loja)} />
      <main className="padm-conteudo pl-workspace">{children}</main>
    </div>
  );
}
