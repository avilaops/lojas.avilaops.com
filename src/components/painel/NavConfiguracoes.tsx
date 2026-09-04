"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Navegação entre as seções de Configurações.
 *
 * Duas formas, porque a tarefa é diferente em cada tela:
 *
 * - **No celular** não há barra. A entrada é a lista de `/painel/configuracoes`
 *   e cada seção é uma página, com "voltar" no topo. A barra horizontal de sete
 *   abas terminava cortada em 393px, e para trocar de seção a pessoa arrastava
 *   uma navegação que não dá sinal de que continua.
 * - **No computador** vira coluna lateral, onde as sete opções cabem e ver
 *   todas de uma vez ajuda.
 */
const SUB = [
  { slug: "marca", rotulo: "Marca" },
  { slug: "dominio", rotulo: "Domínio" },
  { slug: "entrega", rotulo: "Entrega" },
  { slug: "recebimento", rotulo: "Recebimento" },
  { slug: "canais", rotulo: "Canais" },
  { slug: "equipe", rotulo: "Equipe" },
  { slug: "assinatura", rotulo: "Assinatura" },
  { slug: "conta", rotulo: "Dados da empresa" },
] as const;

export default function NavConfiguracoes() {
  const pathname = usePathname();
  const atual = SUB.find((s) => pathname === `/painel/configuracoes/${s.slug}`);

  return (
    <>
      {/* Celular: só o caminho de volta. */}
      {atual && (
        <Link
          href="/painel/configuracoes"
          className="-mt-1 mb-1 inline-flex h-11 items-center gap-1 pr-3 text-sm text-muted-foreground sm:hidden"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Configurações
        </Link>
      )}

      {/* Computador: as sete de uma vez. */}
      <nav className="padm-subnav hidden sm:flex" aria-label="Configurações">
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
    </>
  );
}
