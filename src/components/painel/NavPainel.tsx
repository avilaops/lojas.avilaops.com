"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot, ExternalLink, LayoutDashboard, LogOut, Megaphone, Menu, Package, Settings,
  Search, ShoppingCart, Star, Tags, Ticket, Users, Warehouse, X,
} from "lucide-react";
import { abrirBusca } from "./BuscaPainel";

/**
 * A navegação do painel, no formato de administração de e-commerce.
 *
 * Antes eram treze abas numa tira horizontal: no desktop já sobrava pouco
 * espaço e no celular virava um carrossel onde metade das seções ficava fora
 * da tela. Cada seção agora tem endereço próprio, então o lojista consegue
 * voltar, favoritar e recarregar sem cair na primeira aba.
 *
 * Duas formas, um mesmo mapa: barra lateral fixa a partir de 1024px, e no
 * celular uma folha que entra por cima, do jeito que o resto do app funciona.
 */
export type ItemNav = { rotulo: string; href: string; icone: keyof typeof ICONES; filhos?: Array<{ rotulo: string; href: string }> };

const ICONES = {
  visao: LayoutDashboard,
  pedidos: ShoppingCart,
  produtos: Package,
  estoque: Warehouse,
  clientes: Users,
  promocoes: Ticket,
  avaliacoes: Star,
  marketing: Megaphone,
  ia: Bot,
  categorias: Tags,
  config: Settings,
} as const;

export const SECOES: ItemNav[] = [
  { rotulo: "Visão geral", href: "/painel", icone: "visao" },
  { rotulo: "Pedidos", href: "/painel/pedidos", icone: "pedidos" },
  {
    rotulo: "Produtos",
    href: "/painel/produtos",
    icone: "produtos",
    filhos: [
      { rotulo: "Produtos", href: "/painel/produtos" },
      { rotulo: "Categorias", href: "/painel/produtos/categorias" },
    ],
  },
  { rotulo: "Inventário", href: "/painel/estoque", icone: "estoque" },
  { rotulo: "Clientes", href: "/painel/clientes", icone: "clientes" },
  { rotulo: "Promoções", href: "/painel/promocoes", icone: "promocoes" },
  { rotulo: "Avaliações", href: "/painel/avaliacoes", icone: "avaliacoes" },
  {
    rotulo: "Marketing",
    href: "/painel/marketing",
    icone: "marketing",
    filhos: [
      { rotulo: "Buscadores", href: "/painel/marketing" },
      { rotulo: "Anúncios", href: "/painel/marketing/anuncios" },
    ],
  },
  { rotulo: "IA (Claude)", href: "/painel/ia", icone: "ia" },
];

/** Ativo por prefixo, para a rota de detalhe acender a seção que a contém. */
function ativo(pathname: string, href: string): boolean {
  if (href === "/painel") return pathname === "/painel";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Lista({ pathname, aoNavegar, aSeparar }: { pathname: string; aoNavegar?: () => void; aSeparar: number }) {
  return (
    <nav className="pnav-lista" aria-label="Seções do painel">
      {SECOES.map((s) => {
        const Icone = ICONES[s.icone];
        const aberto = ativo(pathname, s.href);
        return (
          <div key={s.href}>
            <Link href={s.href} onClick={aoNavegar} className={`pnav-item${aberto ? " pnav-item-ativo" : ""}`} aria-current={aberto ? "page" : undefined}>
              <Icone size={16} aria-hidden="true" />
              <span>{s.rotulo}</span>
              {/* Só em Pedidos, e só quando existe: selo que aparece sempre vira
                  enfeite e para de ser lido. */}
              {s.href === "/painel/pedidos" && aSeparar > 0 && (
                <b className="pnav-selo" title={`${aSeparar} pedido(s) pago(s) esperando separação`}>{aSeparar}</b>
              )}
            </Link>
            {/* Filhos só quando a seção está aberta: menu que não cresce sozinho. */}
            {aberto && s.filhos && (
              <div className="pnav-filhos">
                {s.filhos.map((f) => (
                  <Link key={f.href} href={f.href} onClick={aoNavegar} className={`pnav-filho${pathname === f.href ? " pnav-filho-ativo" : ""}`}>
                    {f.rotulo}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Rodape({ pathname, aoNavegar, nome, urlLoja }: { pathname: string; aoNavegar?: () => void; nome: string; urlLoja: string }) {
  const emConfig = ativo(pathname, "/painel/configuracoes");
  return (
    <div className="pnav-rodape">
      <Link href="/painel/configuracoes/marca" onClick={aoNavegar} className={`pnav-item${emConfig ? " pnav-item-ativo" : ""}`}>
        <Settings size={16} aria-hidden="true" />
        <span>Configurações</span>
      </Link>
      <div className="pnav-conta">
        <span className="pnav-avatar" aria-hidden="true">{nome.trim().charAt(0).toUpperCase() || "L"}</span>
        <span className="pnav-conta-nome">{nome}</span>
        <a href={urlLoja} target="_blank" rel="noopener" title="Abrir a loja" className="pnav-conta-acao"><ExternalLink size={14} /></a>
        <form action="/api/painel/sair" method="post">
          <button title="Sair" aria-label="Sair" className="pnav-conta-acao"><LogOut size={14} /></button>
        </form>
      </div>
    </div>
  );
}

export default function NavPainel({ nome, urlLoja, aSeparar = 0 }: { nome: string; urlLoja: string; aSeparar?: number }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  // Quem fecha a folha é o próprio link (aoNavegar), não um efeito olhando a
  // rota: fechar dentro de useEffect obriga a uma segunda renderização só para
  // desfazer o que o clique já sabia.

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const secaoAtual = [...SECOES].reverse().find((s) => ativo(pathname, s.href))?.rotulo
    ?? (ativo(pathname, "/painel/configuracoes") ? "Configurações" : "Painel");

  return (
    <>
      <aside className="pnav-lateral">
        <div className="pnav-marca">
          <span className="pnav-avatar" aria-hidden="true">{nome.trim().charAt(0).toUpperCase() || "L"}</span>
          <span className="pnav-marca-nome">{nome}</span>
        </div>
        <button className="pnav-busca" onClick={abrirBusca}>
          <Search size={15} aria-hidden="true" />
          <span>Buscar</span>
          <kbd>⌘K</kbd>
        </button>
        <Lista pathname={pathname} aSeparar={aSeparar} />
        <Rodape pathname={pathname} nome={nome} urlLoja={urlLoja} />
      </aside>

      <header className="pnav-barra">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" className="pnav-botao"><Menu size={20} /></button>
        <strong>{secaoAtual}</strong>
        {aSeparar > 0 && pathname !== "/painel/pedidos" && (
          <Link href="/painel/pedidos" className="pnav-selo pnav-selo-barra" title={`${aSeparar} pedido(s) esperando separação`}>{aSeparar}</Link>
        )}
        <button onClick={abrirBusca} aria-label="Buscar" className="pnav-botao"><Search size={18} /></button>
        <a href={urlLoja} target="_blank" rel="noopener" aria-label="Abrir a loja" className="pnav-botao"><ExternalLink size={18} /></a>
      </header>

      {aberto && (
        <div className="pnav-folha" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button className="pnav-folha-fundo" aria-label="Fechar menu" onClick={() => setAberto(false)} />
          <div className="pnav-folha-painel">
            <div className="pnav-marca">
              <span className="pnav-avatar" aria-hidden="true">{nome.trim().charAt(0).toUpperCase() || "L"}</span>
              <span className="pnav-marca-nome">{nome}</span>
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="pnav-botao pnav-fechar"><X size={18} /></button>
            </div>
            <Lista pathname={pathname} aoNavegar={() => setAberto(false)} aSeparar={aSeparar} />
            <Rodape pathname={pathname} nome={nome} urlLoja={urlLoja} aoNavegar={() => setAberto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
