import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const origem = new URL(process.argv[2] ?? "https://vedashow.com.br/");
assert.equal(origem.protocol, "https:", "a medição pública exige HTTPS");
assert.equal(origem.username, "", "a URL não pode conter credencial");
assert.equal(origem.password, "", "a URL não pode conter credencial");

const repeticoes = Number(process.argv[3] ?? 3);
assert.ok(Number.isInteger(repeticoes) && repeticoes >= 1 && repeticoes <= 5, "use de 1 a 5 repetições");

const destino = "output/vedashow-avl-265/performance-publica";
await mkdir(destino, { recursive: true });

type Amostra = {
  repeticao: number;
  status: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  lcpMs: number | null;
  cls: number;
  recursos: number;
  bytesTransferidos: number;
  elementoLcp: string | null;
  urlLcp: string | null;
  tamanhoLcp: number | null;
  maioresTransferencias: Array<{ nome: string; tipo: string; bytes: number; duracaoMs: number }>;
};

const browser = await chromium.launch({
  headless: true,
  executablePath: "/home/avops/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
const amostras: Amostra[] = [];

for (let indice = 1; indice <= repeticoes; indice += 1) {
  const contexto = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: "cellular4g",
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await pagina.addInitScript(() => {
    const estado = { lcpMs: null as number | null, cls: 0, elementoLcp: null as string | null, urlLcp: null as string | null, tamanhoLcp: null as number | null };
    Object.defineProperty(window, "__qaVitals", { value: estado });
    new PerformanceObserver((lista) => {
      const entradas = lista.getEntries();
      const entrada = entradas.at(-1) as PerformanceEntry & { element?: Element; url?: string; size?: number } | undefined;
      estado.lcpMs = entrada?.startTime ?? estado.lcpMs;
      estado.elementoLcp = entrada?.element
        ? `${entrada.element.tagName.toLowerCase()}${entrada.element.id ? `#${entrada.element.id}` : ""}${entrada.element.classList.length ? `.${[...entrada.element.classList].join(".")}` : ""}`
        : estado.elementoLcp;
      estado.urlLcp = entrada?.url || estado.urlLcp;
      estado.tamanhoLcp = entrada?.size ?? estado.tamanhoLcp;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entrada.hadRecentInput) estado.cls += entrada.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const resposta = await pagina.goto(origem.href, { waitUntil: "load", timeout: 45_000 });
  assert.ok(resposta, "a navegação não devolveu resposta HTTP");
  await pagina.waitForTimeout(5_000);
  const metricas = await pagina.evaluate(() => {
    const navegacao = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const recursos = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const vitais = (window as unknown as { __qaVitals: {
      lcpMs: number | null;
      cls: number;
      elementoLcp: string | null;
      urlLcp: string | null;
      tamanhoLcp: number | null;
    } }).__qaVitals;
    return {
      ttfbMs: navegacao.responseStart,
      domContentLoadedMs: navegacao.domContentLoadedEventEnd,
      loadMs: navegacao.loadEventEnd,
      lcpMs: vitais.lcpMs,
      cls: vitais.cls,
      recursos: recursos.length,
      bytesTransferidos: recursos.reduce((total, recurso) => total + recurso.transferSize, navegacao.transferSize),
      elementoLcp: vitais.elementoLcp,
      urlLcp: vitais.urlLcp,
      tamanhoLcp: vitais.tamanhoLcp,
      maioresTransferencias: recursos
        .map((recurso) => ({
          nome: recurso.name,
          tipo: recurso.initiatorType,
          bytes: recurso.transferSize,
          duracaoMs: Math.round(recurso.duration),
        }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 8),
    };
  });
  amostras.push({
    repeticao: indice,
    status: resposta.status(),
    ...metricas,
    ttfbMs: Math.round(metricas.ttfbMs),
    domContentLoadedMs: Math.round(metricas.domContentLoadedMs),
    loadMs: Math.round(metricas.loadMs),
    lcpMs: metricas.lcpMs == null ? null : Math.round(metricas.lcpMs),
    cls: Number(metricas.cls.toFixed(4)),
  });
  await contexto.close();
}
await browser.close();

const valores = (chave: "ttfbMs" | "domContentLoadedMs" | "loadMs" | "lcpMs" | "cls") =>
  amostras.map((amostra) => amostra[chave]).filter((valor): valor is number => valor != null).sort((a, b) => a - b);
const mediana = (numeros: number[]) => numeros.length ? numeros[Math.floor(numeros.length / 2)] : null;
const relatorio = {
  origem: origem.href,
  medidoEm: new Date().toISOString(),
  natureza: "baseline de produção; não valida alterações locais não publicadas",
  condicoes: {
    viewport: "390x844 @3x",
    rede: "1,6 Mbps down / 750 Kbps up / 150 ms RTT",
    cpu: "4x slowdown",
    cache: "contexto novo por repetição",
    esperaAposLoadMs: 5_000,
    inp: "não medido: exige interação humana representativa",
  },
  repeticoes,
  mediana: {
    ttfbMs: mediana(valores("ttfbMs")),
    domContentLoadedMs: mediana(valores("domContentLoadedMs")),
    loadMs: mediana(valores("loadMs")),
    lcpMs: mediana(valores("lcpMs")),
    cls: mediana(valores("cls")),
  },
  amostras,
};
assert.ok(amostras.every((amostra) => amostra.status === 200), "todas as amostras devem responder HTTP 200");
const nomeArquivo = `${origem.hostname.replace(/[^a-z0-9.-]/gi, "-")}-mobile-${repeticoes}x.json`;
await writeFile(`${destino}/${nomeArquivo}`, `${JSON.stringify(relatorio, null, 2)}\n`);
console.log(JSON.stringify(relatorio, null, 2));
