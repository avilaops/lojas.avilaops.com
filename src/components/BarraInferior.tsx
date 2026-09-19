"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MessageCircle, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * Atalhos fixos no rodapé da tela, só no celular.
 *
 * A loja só tinha navegação no topo. No celular, depois de rolar uma grade de
 * 48 produtos, voltar ao início ou ao carrinho custava rolar a página inteira
 * de volta — e o carrinho é onde a compra acontece. É o padrão que todo app de
 * compra usa pelo mesmo motivo: o polegar alcança embaixo, não em cima.
 *
 * Mora no layout, não no template: é navegação da loja, igual nos onze
 * layouts, e não mais uma escolha para o lojista errar.
 *
 * As abas saem do que a loja é, não de uma lista fixa. Sem checkout (plano
 * SITE, loja suspensa, gateway não conectado) não há carrinho nem conta: seria
 * aba que leva a uma página que não vende, e aba morta é pior que aba nenhuma.
 * No lugar entra o contato, que é como essa loja fecha pedido.
 */
export default function BarraInferior({ vende, temContato }: { vende: boolean; temContato: boolean }) {
  const caminho = usePathname();
  const { quantidade, painelHabilitado, abrir } = useCart();

  // O catálogo responde por /produtos e por /categoria/<slug>: as duas são
  // "procurando", e acender só a primeira deixaria a barra apagada justamente
  // onde a pessoa mais navega.
  const noCatalogo = caminho.startsWith("/produtos") || caminho.startsWith("/categoria");

  return (
    <nav className="barra-inferior" aria-label="Atalhos da loja">
      <Aba href="/" ativo={caminho === "/"} Icone={House} rotulo="Início" />
      <Aba href="/produtos" ativo={noCatalogo} Icone={Search} rotulo="Buscar" />
      {vende ? (
        <>
          {painelHabilitado ? (
            // No template premium o carrinho é uma gaveta lateral. Levar para
            // /carrinho ali seria sair da compra para ver a compra.
            <button type="button" onClick={abrir} className="barra-inferior-aba" aria-label={`Abrir carrinho${quantidade ? `, ${quantidade} ${quantidade === 1 ? "item" : "itens"}` : ""}`}>
              <Selo quantidade={quantidade}><ShoppingBag aria-hidden="true" /></Selo>
              <span>Carrinho</span>
            </button>
          ) : (
            <Aba href="/carrinho" ativo={caminho.startsWith("/carrinho")} Icone={ShoppingBag} rotulo="Carrinho" quantidade={quantidade} />
          )}
          <Aba href="/conta" ativo={caminho.startsWith("/conta")} Icone={User} rotulo="Conta" />
        </>
      ) : temContato ? (
        <Aba href="/contato" ativo={caminho.startsWith("/contato")} Icone={MessageCircle} rotulo="Contato" />
      ) : null}
    </nav>
  );
}

function Aba({ href, ativo, Icone, rotulo, quantidade = 0 }: { href: string; ativo: boolean; Icone: typeof House; rotulo: string; quantidade?: number }) {
  return (
    <Link href={href} className="barra-inferior-aba" aria-current={ativo ? "page" : undefined} data-ativo={ativo ? "" : undefined}>
      <Selo quantidade={quantidade}><Icone aria-hidden="true" /></Selo>
      <span>{rotulo}</span>
    </Link>
  );
}

/** O contador do carrinho. Sem item, nem o elemento existe. */
function Selo({ quantidade, children }: { quantidade: number; children: React.ReactNode }) {
  return (
    <span className="barra-inferior-icone">
      {children}
      {quantidade > 0 && <span className="barra-inferior-contador">{quantidade > 99 ? "99+" : quantidade}</span>}
    </span>
  );
}
