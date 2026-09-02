"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * As telas de ajuste ficam juntas, como numa administração de e-commerce:
 * uma lista própria dentro de Configurações, em vez de cinco entradas soltas
 * no menu principal disputando espaço com o que se usa todo dia (pedido,
 * produto, estoque).
 */
const SUB = [
  { slug: "marca", rotulo: "Marca" },
  { slug: "dominio", rotulo: "Domínio" },
  { slug: "entrega", rotulo: "Entrega" },
  { slug: "recebimento", rotulo: "Recebimento" },
  { slug: "canais", rotulo: "Canais" },
  { slug: "assinatura", rotulo: "Assinatura" },
  { slug: "conta", rotulo: "Conta" },
] as const;

export default function NavConfiguracoes() {
  const pathname = usePathname();
  return (
    <nav className="padm-subnav" aria-label="Configurações">
      {SUB.map((s) => {
        const href = `/painel/configuracoes/${s.slug}`;
        const ativo = pathname === href;
        return (
          <Link key={s.slug} href={href} className={ativo ? "padm-subnav-ativo" : undefined} aria-current={ativo ? "page" : undefined}>
            {s.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
