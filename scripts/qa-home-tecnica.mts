import { mkdir, readFile, readdir } from "node:fs/promises";
import { chromium } from "playwright";

const destino = "output/vedashow-avl-265";
await mkdir(destino, { recursive: true });
const diretorioCss = ".next/static/chunks";
const arquivosCss = (await readdir(diretorioCss)).filter((arquivo) => arquivo.endsWith(".css"));
const css = (await Promise.all(arquivosCss.map((arquivo) => readFile(`${diretorioCss}/${arquivo}`, "utf8")))).join("\n");
const familias = [
  ["Retentores", "Vedação para eixos rotativos, com seleção por medidas e aplicação."],
  ["Anéis O-ring", "Anéis para vedação estática e dinâmica em diferentes materiais."],
  ["Rolamentos", "Componentes para rotação e apoio de conjuntos mecânicos."],
  ["Gaxetas", "Perfis para hastes, cilindros e equipamentos industriais."],
  ["Vedações hidráulicas", "Soluções para pressão, movimento e fluidos em sistemas hidráulicos."],
  ["Kits de reparo", "Conjuntos organizados para manutenção e reposição."],
];
const campos = [["Diâmetro interno", "50,8"], ["Diâmetro externo", "63,5"], ["Altura", "9,52"]];
const diferenciais = [["Catálogo técnico", "Códigos, equivalências e medidas reunidos para conferência."], ["Ajuda na identificação", "Envie a aplicação ou as medidas para confirmar a peça."], ["Compra acompanhada", "Consulte o andamento do pedido em um só lugar."]];
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--background:#fff;--foreground:#172033;--card:#fff;--muted:#f1f3f5;--muted-foreground:#5b6472;--border:#d8dde3;--primary:#243b87;--primary-foreground:#fff;--brand-support:#e3b341;--radius:.65rem}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:Inter,system-ui,sans-serif}${css}.industrial-linhas a.industrial-linha-sem-imagem{grid-template-columns:1fr}</style></head><body><main class="home-industrial">
<section class="industrial-topo"><div class="container-loja industrial-topo-conteudo"><p class="industrial-topo-marca">VedaShow</p><h1>Identifique a peça antes de comprar</h1><p class="industrial-topo-texto">Busque pela referência que você já conhece ou informe as medidas da peça usada.</p><div class="industrial-identificador"><form class="industrial-busca-livre"><label>Código, referência, aplicação ou medida</label><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input placeholder="Ex.: 6204-2RS, 20 × 47 × 14 ou aplicação"><button>Identificar peça</button></div></form><div class="industrial-identificador-divisor"><span>ou use as medidas</span></div><form class="industrial-medida"><div class="industrial-medida-campos">${campos.map(([r,p])=>`<label><span>${r}</span><span class="industrial-medida-entrada"><input placeholder="${p}"><abbr>mm</abbr></span></label>`).join("")}<button class="industrial-medida-botao">Buscar pela medida</button></div><p class="industrial-medida-ajuda">Aceita meio milímetro de diferença para mais ou para menos. Pode preencher só uma ou duas medidas.</p></form></div></div></section>
<section class="container-loja industrial-linhas"><h2>Linhas de produto</h2><ul>${familias.map(([nome,descricao])=>`<li><a class="industrial-linha-sem-imagem"><span class="industrial-linha-texto"><strong>${nome}</strong><span>${descricao}</span><em>Ver medidas disponíveis</em></span></a></li>`).join("")}</ul></section>
<section class="container-loja industrial-marcas"><div><h2>Marcas disponíveis</h2><p>Fabricantes encontrados nos produtos ativos do catálogo.</p></div><ul>${["SKF","Sabó","Corteco","Freudenberg","NOK","TTO"].map(m=>`<li>${m}</li>`).join("")}</ul></section>
<div class="container-loja industrial-beneficios"><aside class="beneficios-barra"><div><p><strong>Despacho em até 2 dias úteis</strong><span>Prazo informado antes da compra</span></p></div><div><p><strong>Frete calculado pelo CEP</strong><span>Opções e prazo antes do pagamento</span></p></div><div><p><strong>Pedido acompanhado</strong><span>Status da compra em um só lugar</span></p></div></aside></div>
<section class="industrial-diferenciais"><div class="container-loja"><h2>Por que comprar com a VedaShow</h2><dl>${diferenciais.map(([t,d])=>`<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl></div></section>
<section class="container-loja industrial-empresa"><div><h2>A empresa</h2><p>Especialista em soluções para vedação e manutenção industrial.</p><a>Conheça a VedaShow</a></div><aside><h3>Fale com o comercial</h3><p>Envie a medida, o código ou a referência da peça e receba a cotação.</p><a class="industrial-contato-botao">Pedir cotação pelo WhatsApp</a><ul><li><span>Telefone</span><a>(16) 3333-4444</a></li><li><span>E-mail</span><a>vendas@vedashow.com.br</a></li></ul></aside></section>
</main></body></html>`;

const browser = await chromium.launch({
  headless: true,
  executablePath: "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
for (const [nome, largura, altura] of [["desktop", 1440, 1050], ["mobile", 390, 844]] as const) {
  const page = await browser.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `${destino}/${nome}.png`, fullPage: true });
}
await browser.close();
