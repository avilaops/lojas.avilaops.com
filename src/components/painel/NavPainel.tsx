"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight, BarChart3, Bot, ExternalLink, LayoutDashboard, LogOut, Megaphone, Menu, Package, Settings,
  PlugZap, Search, ShoppingCart, Star, Tags, Ticket, Users, Warehouse, X,
} from "lucide-react";
import { LogoLojas } from "@/components/marca/MarcaLojas";
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
  analises: BarChart3,
  pedidos: ShoppingCart,
  produtos: Package,
  estoque: Warehouse,
  clientes: Users,
  promocoes: Ticket,
  avaliacoes: Star,
  marketing: Megaphone,
  ia: Bot,
  conexoes: PlugZap,
  categorias: Tags,
  config: Settings,
} as const;

export const SECOES: ItemNav[] = [
  { rotulo: "Visão geral", href: "/painel", icone: "visao" },
  {
    rotulo: "Análises",
    href: "/painel/analises",
    icone: "analises",
    filhos: [
      { rotulo: "Visão de vendas", href: "/painel/analises" },
      { rotulo: "Atribuição", href: "/painel/analises/atribuicao" },
    ],
  },
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
      { rotulo: "Blog", href: "/painel/marketing/blog" },
    ],
  },
  { rotulo: "IA e API", href: "/painel/ia", icone: "ia" },
  { rotulo: "Conexões", href: "/painel/conexoes", icone: "conexoes" },
];

/** Ativo por prefixo, para a rota de detalhe acender a seção que a contém. */
function ativo(pathname: string, href: string): boolean {
  if (href === "/painel") return pathname === "/painel";
  // A fila do Pix mora embaixo de Pedidos, mas é outra tela.
  if (href === "/painel/pedidos" && pathname.startsWith("/painel/pedidos/pix")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Lista({ pathname, aoNavegar, aSeparar, pixAConferir = 0, secoes }: { pathname: string; aoNavegar?: () => void; aSeparar: number; pixAConferir?: number; secoes: ItemNav[] }) {
  return (
    <nav className="pnav-lista" aria-label="Seções do painel">
      {secoes.map((s) => {
        const Icone = ICONES[s.icone];
        const aberto = ativo(pathname, s.href);
        return (
          <div key={s.href}>
            <Link href={s.href} onClick={aoNavegar} className={`pnav-item${aberto ? " pnav-item-ativo" : ""}`} aria-current={aberto ? "page" : undefined}>
              <Icone size={16} aria-hidden="true" />
              <span>{s.rotulo}</span>
              {/* Só em Pedidos, e só quando existe: selo que aparece sempre vira
                  enfeite e para de ser lido. */}
              {s.href === "/painel/pedidos/pix" && pixAConferir > 0 && (
                <b className="pnav-selo" title={`${pixAConferir} Pix esperando conferência no extrato`}>{pixAConferir}</b>
              )}
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

function Rodape({ pathname, aoNavegar, urlLoja, podeTrocarLoja }: { pathname: string; aoNavegar?: () => void; urlLoja: string; podeTrocarLoja: boolean }) {
  const emConfig = ativo(pathname, "/painel/configuracoes");
  // O nome da loja fica só no topo. Aqui embaixo ficam as três ações que não
  // são seção: configurar, abrir a loja e sair, todas com texto. "Abrir a
  // loja" era um ícone de 14px que só se descobria tentando.
  return (
    <div className="pnav-rodape">
      <Link href="/painel/configuracoes" onClick={aoNavegar} className={`pnav-item${emConfig ? " pnav-item-ativo" : ""}`} aria-current={emConfig ? "page" : undefined}>
        <Settings size={16} aria-hidden="true" />
        <span>Configurações</span>
      </Link>
      {podeTrocarLoja && (
        <Link href="/entrar/lojas" onClick={aoNavegar} className="pnav-item">
          <ArrowLeftRight size={16} aria-hidden="true" />
          <span>Trocar loja</span>
        </Link>
      )}
      <a href={urlLoja} target="_blank" rel="noopener" className="pnav-item">
        <ExternalLink size={16} aria-hidden="true" />
        <span>Ver loja</span>
      </a>
      <form action="/api/painel/sair" method="post">
        <button className="pnav-item pnav-item-botao">
          <LogOut size={16} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </form>
      <LogoLojas mono className="pnav-assinatura" titulo="Lojas por Avila Ops" />
    </div>
  );
}

export default function NavPainel({ nome, urlLoja, aSeparar = 0, pixManual = false, pixAConferir = 0, podeTrocarLoja = false }: { nome: string; urlLoja: string; aSeparar?: number; pixManual?: boolean; pixAConferir?: number; podeTrocarLoja?: boolean }) {
  const pathname = usePathname().replace(/^\/plataforma(?=\/|$)/, "");
  const secoes: ItemNav[] = pixManual
    ? SECOES.flatMap((s) => (s.href === "/painel/pedidos" ? [s, { rotulo: "Pix a conferir", href: "/painel/pedidos/pix", icone: "pedidos" }] : [s]))
    : SECOES;
  const [aberto, setAberto] = useState(false);
  const botaoMenu = useRef<HTMLButtonElement>(null);
  const primeiroItem = useRef<HTMLDivElement>(null);

  // Folha aberta: o fundo não rola (senão o dedo que arrasta o menu arrasta a
  // página atrás), o foco entra na folha e, ao fechar, volta para o botão que
  // a abriu, que é o que um leitor de tela espera de um diálogo.
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.body.style.overflow;
    const botao = botaoMenu.current;
    document.body.style.overflow = "hidden";
    primeiroItem.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.body.style.overflow = anterior;
      botao?.focus();
    };
  }, [aberto]);

  // Quem fecha a folha é o próprio link (aoNavegar), não um efeito olhando a
  // rota: fechar dentro de useEffect obriga a uma segunda renderização só para
  // desfazer o que o clique já sabia.

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const secaoAtual = [...secoes].reverse().find((s) => ativo(pathname, s.href))?.rotulo
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
        <Lista pathname={pathname} aSeparar={aSeparar} pixAConferir={pixAConferir} secoes={secoes} />
        <Rodape pathname={pathname} urlLoja={urlLoja} podeTrocarLoja={podeTrocarLoja} />
      </aside>

      <header className="pnav-barra">
        <button ref={botaoMenu} onClick={() => setAberto(true)} aria-label="Abrir menu" aria-expanded={aberto} aria-controls="pnav-folha" className="pnav-botao"><Menu size={20} /></button>
        <strong>{secaoAtual}</strong>
        {aSeparar > 0 && pathname !== "/painel/pedidos" && (
          <Link href="/painel/pedidos" className="pnav-selo pnav-selo-barra" title={`${aSeparar} pedido(s) esperando separação`}>{aSeparar}</Link>
        )}
        <button onClick={abrirBusca} aria-label="Buscar" className="pnav-botao"><Search size={18} /></button>
        <a href={urlLoja} target="_blank" rel="noopener" aria-label="Abrir a loja" className="pnav-botao"><ExternalLink size={18} /></a>
      </header>

      {aberto && (
        <div id="pnav-folha" className="pnav-folha" role="dialog" aria-modal="true" aria-label="Menu do painel">
          <button className="pnav-folha-fundo" aria-label="Fechar menu" onClick={() => setAberto(false)} />
          <div className="pnav-folha-painel">
            <div className="pnav-marca">
              <span className="pnav-avatar" aria-hidden="true">{nome.trim().charAt(0).toUpperCase() || "L"}</span>
              <span className="pnav-marca-nome">{nome}</span>
              <button onClick={() => setAberto(false)} aria-label="Fechar menu" className="pnav-botao pnav-fechar"><X size={18} /></button>
            </div>
            <div ref={primeiroItem} className="contents">
              <Lista pathname={pathname} aoNavegar={() => setAberto(false)} aSeparar={aSeparar} pixAConferir={pixAConferir} secoes={secoes} />
            </div>
            <Rodape pathname={pathname} urlLoja={urlLoja} podeTrocarLoja={podeTrocarLoja} aoNavegar={() => setAberto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
