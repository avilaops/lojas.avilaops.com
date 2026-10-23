import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const destino = "output/vedashow-avl-264";
await mkdir(destino, { recursive: true });
const css = await readFile("src/app/plataforma/(admin)/painel.css", "utf8");
const etapas = [
  ["Sessões", "1.248", "100% · visitas únicas", 100],
  ["Viram produto", "742", "59,5% · sobre sessões", 59.5],
  ["Adicionaram", "186", "25,1% · sobre quem viu produto", 14.9],
  ["Iniciaram checkout", "91", "48,9% · sobre quem adicionou", 7.3],
  ["Criaram pedido", "54", "59,3% · sobre quem iniciou checkout", 4.3],
  ["Pagamento aprovado", "39", "72,2% · sobre pedidos criados", 3.1],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--lj-azul:#3157d5;--lj-azul-forte:#243e9f;--lj-azul-suave:#eef2ff}*{box-sizing:border-box}body{margin:0;background:#f7f8fa;color:#101828;font-family:Inter,system-ui,sans-serif}.qa{max-width:1180px;margin:auto;padding:32px 40px 80px}${css}</style></head><body><main class="qa padm-conteudo">
<header class="padm-cabecalho"><div><h1>Funil da loja</h1><p>Da descoberta do catálogo até a compra paga</p></div></header>
<section class="an-filtros"><nav><a>Hoje</a><a>7 dias</a><a class="ativo">30 dias</a><a>90 dias</a></nav><form><label>De<input type="date" value="2026-09-19"></label><label>Até<input type="date" value="2026-10-18"></label><button>Aplicar</button></form><p><strong>Últimos 30 dias</strong> · sessões únicas; pedidos externos não entram na conversão</p></section>
<section class="an-bloco an-funil"><header><div><small>Conversão</small><h2>Jornada principal</h2></div><strong>3,1% compraram</strong></header><ol>${etapas.map(([nome,valor,ajuda,largura],i)=>`<li style="--largura:${largura}%"><div><span>${i+1}</span><b>${nome}</b><strong>${valor}</strong></div><div class="an-funil-barra"><i></i></div><small>${ajuda}</small></li>`).join("")}</ol></section>
<div class="an-grid-kpis an-funil-diagnosticos"><article class="an-kpi"><div class="an-kpi-titulo"><span>Busca sem resultado</span><span>?</span></div><strong>8,4%</strong><small>19 de 227 sessões com busca</small></article><article class="an-kpi"><div class="an-kpi-titulo"><span>Contato técnico</span><span>?</span></div><strong>17,7%</strong><small>131 contatos · 742 sessões com produto</small></article><article class="an-kpi"><div class="an-kpi-titulo"><span>Aplicaram filtros</span><span>?</span></div><strong>318</strong><small>sessões refinaram o catálogo</small></article><article class="an-kpi"><div class="an-kpi-titulo"><span>Clientes recorrentes</span><span>?</span></div><strong>23,1%</strong><small>9 de 39 compradores</small></article></div>
<p class="an-nota">Medição first-party: sem IP, user-agent, termo buscado ou conteúdo de mensagens. Sem consentimento, uma sessão não é ligada à próxima visita.</p>
</main></body></html>`;
const browser = await chromium.launch({ headless: true });
for (const [nome, largura, altura] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
  const page = await browser.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `${destino}/${nome}.png`, fullPage: true });
}
await browser.close();

