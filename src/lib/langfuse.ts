import type { GenerateContentResponse, GenerateContentResponseUsageMetadata } from "@google/genai";
import type { LangfuseGeneration } from "@langfuse/tracing";

type Runtime = {
  iniciar: typeof import("@langfuse/tracing").startObservation;
  descarregar: () => Promise<void>;
};

let inicializacao: Promise<Runtime | null> | undefined;

export function destinoLangfuseSeguro(destino?: string): string | null {
  if (!destino?.trim()) return null;
  try {
    const url = new URL(destino);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

/** Só habilita exportação quando o destino e o par de chaves foram configurados. */
export function langfuseConfigurado(env: Record<string, string | undefined> = process.env): boolean {
  return env.LANGFUSE_ENABLED === "true" && env.LANGFUSE_TRACING_ENABLED !== "false"
    && Boolean(env.LANGFUSE_PUBLIC_KEY?.trim() && env.LANGFUSE_SECRET_KEY?.trim() && destinoLangfuseSeguro(env.LANGFUSE_BASE_URL));
}

async function aguardarComLimite(tarefa: Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([tarefa, new Promise<void>((resolve) => { timer = setTimeout(resolve, 4_000); })]);
  } finally { if (timer) clearTimeout(timer); }
}

export async function iniciarLangfuse(): Promise<Runtime | null> {
  if (!langfuseConfigurado()) return null;
  inicializacao ??= (async () => {
    try {
      const [{ NodeSDK }, { LangfuseSpanProcessor }, { startObservation }] = await Promise.all([
        import("@opentelemetry/sdk-node"), import("@langfuse/otel"), import("@langfuse/tracing"),
      ]);
      const processador = new LangfuseSpanProcessor({
        baseUrl: destinoLangfuseSeguro(process.env.LANGFUSE_BASE_URL)!,
        timeout: 3,
        mediaUploadEnabled: false,
        shouldExportSpan: ({ otelSpan }) => otelSpan.name.startsWith("lojas.gemini."),
      });
      const sdk = new NodeSDK({
        serviceName: "lojas.avilaops.com",
        autoDetectResources: false,
        instrumentations: [],
        spanProcessors: [processador],
      });
      sdk.start();
      process.once("beforeExit", () => { void aguardarComLimite(sdk.shutdown()).catch(() => {}); });
      return { iniciar: startObservation, descarregar: () => aguardarComLimite(processador.forceFlush()) };
    } catch {
      // Observabilidade não pode impedir a geração nem imprimir credenciais.
      console.warn("[langfuse] Inicialização indisponível; geração continua sem rastreamento.");
      return null;
    }
  })();
  return inicializacao;
}

/** Gemini inclui tokens de raciocínio no total; eles também pertencem à saída. */
export function usoGemini(uso?: GenerateContentResponseUsageMetadata): Record<string, number> {
  const detalhes: Record<string, number> = {};
  if (!uso) return detalhes;
  const valido = (valor: number | undefined): valor is number => typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
  if (valido(uso.promptTokenCount)) detalhes.input = uso.promptTokenCount;
  if (valido(uso.candidatesTokenCount) || valido(uso.thoughtsTokenCount)) {
    detalhes.output = (valido(uso.candidatesTokenCount) ? uso.candidatesTokenCount : 0)
      + (valido(uso.thoughtsTokenCount) ? uso.thoughtsTokenCount : 0);
  }
  if (valido(uso.totalTokenCount)) detalhes.total = uso.totalTokenCount;
  return detalhes;
}

/** Captura exclusivamente metadados: nunca prompt, resposta, argumentos ou erro bruto. */
export async function rastrearGeracaoGemini<T extends GenerateContentResponse>(
  funcionalidade: "copy-produto" | "diagnostico-marca" | "seo-categoria",
  modelo: string,
  executar: () => Promise<T>,
): Promise<T> {
  const runtime = await iniciarLangfuse();
  let geracao: LangfuseGeneration | undefined;
  try {
    geracao = runtime?.iniciar(`lojas.gemini.${funcionalidade}`, {
      model: modelo,
      input: { formato: "json", conteudoCapturado: false },
      metadata: { funcionalidade, provedor: "google", politicaConteudo: "somente-metadados" },
    }, { asType: "generation" });
  } catch { /* falha de telemetria não muda a chamada ao provedor */ }

  try {
    const resposta = await executar();
    try {
      geracao?.update({
        usageDetails: usoGemini(resposta.usageMetadata),
        output: { conteudoCapturado: false, candidatos: resposta.candidates?.length ?? 0 },
      });
    } catch { /* resultado do provedor deve ser preservado */ }
    return resposta;
  } catch (erro) {
    try { geracao?.update({ level: "ERROR", statusMessage: "Falha na chamada ao provedor Gemini" }); } catch { /* preserva erro original */ }
    throw erro;
  } finally {
    try {
      geracao?.end();
      // Antes de retornar ao chamador: também cobre rotinas fora de requests Next.
      if (geracao) await runtime?.descarregar();
    } catch { /* exportação não altera sucesso/erro da geração */ }
  }
}
