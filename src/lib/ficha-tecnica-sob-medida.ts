import { z } from "zod";
import {
  ConfiguracaoSobMedidaSchema,
  OPCOES_CONFIGURADOR,
  type ConfiguracaoSobMedida,
} from "./configurador-sob-medida";

export const VERSAO_FICHA_TECNICA_SOB_MEDIDA = 1;
export const VERSAO_PREVIA_SOB_MEDIDA = 1;

const referencia = z.string().regex(/^CFG-[A-Z0-9]{12}$/);
const itemTecnico = <T extends Record<string, string>>(opcoes: T) => z.object({
  codigo: z.enum(Object.keys(opcoes) as [keyof T & string, ...(keyof T & string)[]]),
  rotulo: z.string().min(1),
}).superRefine((item, contexto) => {
  if (opcoes[item.codigo] !== item.rotulo) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ["rotulo"], message: "Rótulo técnico não corresponde ao código." });
  }
});

export const FichaTecnicaSobMedidaSchema = z.object({
  versao: z.literal(VERSAO_FICHA_TECNICA_SOB_MEDIDA),
  previaVersao: z.literal(VERSAO_PREVIA_SOB_MEDIDA),
  referencia,
  referenciaOrigem: referencia.nullable(),
  contratoVersao: z.number().int().positive(),
  criadaEm: z.string().datetime({ offset: true }),
  dimensoes: ConfiguracaoSobMedidaSchema.shape.dimensoes,
  materialExterno: itemTecnico(OPCOES_CONFIGURADOR.materialExterno),
  acabamento: itemTecnico(OPCOES_CONFIGURADOR.acabamento),
  tampa: itemTecnico(OPCOES_CONFIGURADOR.tampa),
  mobilidade: itemTecnico(OPCOES_CONFIGURADOR.mobilidade),
  divisorias: ConfiguracaoSobMedidaSchema.shape.divisorias,
  quantidade: ConfiguracaoSobMedidaSchema.shape.quantidade,
  observacoes: ConfiguracaoSobMedidaSchema.shape.observacoes,
});

export type FichaTecnicaSobMedida = z.infer<typeof FichaTecnicaSobMedidaSchema>;

interface EntradaFichaTecnica {
  referencia: string;
  referenciaOrigem: string | null;
  contratoVersao: number;
  criadaEm: Date;
  configuracao: ConfiguracaoSobMedida;
}

function item<T extends Record<string, string>>(opcoes: T, codigo: keyof T & string) {
  return { codigo, rotulo: opcoes[codigo] };
}

export function criarFichaTecnicaSobMedida(entrada: EntradaFichaTecnica): FichaTecnicaSobMedida {
  const configuracao = ConfiguracaoSobMedidaSchema.parse(entrada.configuracao);
  return FichaTecnicaSobMedidaSchema.parse({
    versao: VERSAO_FICHA_TECNICA_SOB_MEDIDA,
    previaVersao: VERSAO_PREVIA_SOB_MEDIDA,
    referencia: entrada.referencia,
    referenciaOrigem: entrada.referenciaOrigem,
    contratoVersao: entrada.contratoVersao,
    criadaEm: entrada.criadaEm.toISOString(),
    dimensoes: configuracao.dimensoes,
    materialExterno: item(OPCOES_CONFIGURADOR.materialExterno, configuracao.materialExterno),
    acabamento: item(OPCOES_CONFIGURADOR.acabamento, configuracao.acabamento),
    tampa: item(OPCOES_CONFIGURADOR.tampa, configuracao.tampa),
    mobilidade: item(OPCOES_CONFIGURADOR.mobilidade, configuracao.mobilidade),
    divisorias: configuracao.divisorias,
    quantidade: configuracao.quantidade,
    observacoes: configuracao.observacoes,
  });
}

const CORES_MATERIAL: Record<FichaTecnicaSobMedida["materialExterno"]["codigo"], { frente: string; topo: string; lateral: string }> = {
  aco_galvanizado: { frente: "#cbd5e1", topo: "#e2e8f0", lateral: "#94a3b8" },
  aco_pintado: { frente: "#2563eb", topo: "#60a5fa", lateral: "#1d4ed8" },
  aco_inoxidavel: { frente: "#dbe4ea", topo: "#f1f5f9", lateral: "#a8b4c0" },
  aluminio: { frente: "#d1d5db", topo: "#f3f4f6", lateral: "#9ca3af" },
};

function numero(valor: number): string {
  return Number(valor.toFixed(2)).toString();
}

function pontos(...valores: number[]): string {
  const pares: string[] = [];
  for (let indice = 0; indice < valores.length; indice += 2) pares.push(`${numero(valores[indice])},${numero(valores[indice + 1])}`);
  return pares.join(" ");
}

function escaparXml(valor: string): string {
  return valor.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function gerarPreviaSvgSobMedida(entrada: FichaTecnicaSobMedida): string {
  const ficha = FichaTecnicaSobMedidaSchema.parse(entrada);
  const { larguraCm, alturaCm, profundidadeCm } = ficha.dimensoes;
  const escala = Math.min(420 / larguraCm, 260 / alturaCm, 180 / profundidadeCm);
  const largura = Math.max(60, larguraCm * escala);
  const altura = Math.max(50, alturaCm * escala);
  const deslocamentoX = Math.max(24, profundidadeCm * escala * 0.55);
  const deslocamentoY = Math.max(18, profundidadeCm * escala * 0.3);
  const esquerda = 90;
  const base = 430;
  const topo = base - altura;
  const direita = esquerda + largura;
  const trasEsquerda = esquerda + deslocamentoX;
  const trasDireita = direita + deslocamentoX;
  const trasTopo = topo - deslocamentoY;
  const cores = CORES_MATERIAL[ficha.materialExterno.codigo];
  const divisorias = Array.from({ length: ficha.divisorias }, (_, indice) => {
    const x = esquerda + (largura * (indice + 1)) / (ficha.divisorias + 1);
    return `<line x1="${numero(x)}" y1="${numero(topo + 4)}" x2="${numero(x)}" y2="${numero(base - 4)}" stroke="#475569" stroke-width="2" stroke-dasharray="6 5"/>`;
  }).join("");
  const dimensoes = `${larguraCm} × ${alturaCm} × ${profundidadeCm} cm`;
  const referenciaSegura = escaparXml(ficha.referencia);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" role="img" aria-labelledby="titulo descricao">
<title id="titulo">Prévia técnica ${referenciaSegura}</title>
<desc id="descricao">Caixa térmica de ${dimensoes}, ${escaparXml(ficha.materialExterno.rotulo)}.</desc>
<rect width="960" height="640" fill="#f8fafc"/>
<text x="64" y="56" fill="#0f172a" font-family="Arial, sans-serif" font-size="24" font-weight="700">${referenciaSegura}</text>
<text x="64" y="84" fill="#475569" font-family="Arial, sans-serif" font-size="16">Representação conceitual · Prévia v${ficha.previaVersao}</text>
<polygon data-face="topo" points="${pontos(esquerda, topo, trasEsquerda, trasTopo, trasDireita, trasTopo, direita, topo)}" fill="${cores.topo}" stroke="#334155" stroke-width="3"/>
<polygon data-face="lateral" points="${pontos(direita, topo, trasDireita, trasTopo, trasDireita, base - deslocamentoY, direita, base)}" fill="${cores.lateral}" stroke="#334155" stroke-width="3"/>
<polygon data-face="frente" points="${pontos(esquerda, topo, direita, topo, direita, base, esquerda, base)}" fill="${cores.frente}" stroke="#334155" stroke-width="3"/>
${divisorias}
<line x1="${numero(esquerda)}" y1="${numero(base + 28)}" x2="${numero(direita)}" y2="${numero(base + 28)}" stroke="#64748b" stroke-width="2"/>
<text x="${numero((esquerda + direita) / 2)}" y="${numero(base + 52)}" text-anchor="middle" fill="#334155" font-family="Arial, sans-serif" font-size="15">L ${larguraCm} cm</text>
<line x1="${numero(esquerda - 28)}" y1="${numero(topo)}" x2="${numero(esquerda - 28)}" y2="${numero(base)}" stroke="#64748b" stroke-width="2"/>
<text x="${numero(esquerda - 42)}" y="${numero((topo + base) / 2)}" transform="rotate(-90 ${numero(esquerda - 42)} ${numero((topo + base) / 2)})" text-anchor="middle" fill="#334155" font-family="Arial, sans-serif" font-size="15">A ${alturaCm} cm</text>
<text x="560" y="155" fill="#0f172a" font-family="Arial, sans-serif" font-size="28" font-weight="700">${dimensoes}</text>
<text x="560" y="205" fill="#334155" font-family="Arial, sans-serif" font-size="18">Material: ${escaparXml(ficha.materialExterno.rotulo)}</text>
<text x="560" y="239" fill="#334155" font-family="Arial, sans-serif" font-size="18">Acabamento: ${escaparXml(ficha.acabamento.rotulo)}</text>
<text x="560" y="273" fill="#334155" font-family="Arial, sans-serif" font-size="18">Abertura: ${escaparXml(ficha.tampa.rotulo)}</text>
<text x="560" y="307" fill="#334155" font-family="Arial, sans-serif" font-size="18">Base: ${escaparXml(ficha.mobilidade.rotulo)}</text>
<text x="560" y="341" fill="#334155" font-family="Arial, sans-serif" font-size="18">Divisórias: ${ficha.divisorias}</text>
<text x="560" y="375" fill="#334155" font-family="Arial, sans-serif" font-size="18">Quantidade: ${ficha.quantidade}</text>
<text x="64" y="590" fill="#991b1b" font-family="Arial, sans-serif" font-size="16" font-weight="700">Sujeito à validação da fábrica; não é desenho liberado para fabricação.</text>
</svg>`;
}
