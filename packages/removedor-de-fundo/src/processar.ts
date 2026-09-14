import fs from 'node:fs/promises'
import path from 'node:path'
import type { Formato, NomeModelo, Opcoes } from './config.ts'
import { aplicarAlfa, carregar, gravar, montar } from './imagem.ts'
import type { Carregada } from './imagem.ts'
import { refinarBorda } from './borda.ts'
import { mascaraPorIA, areaPermitida } from './motor-ia.ts'
import {
  caixaDoProduto,
  cobertura,
  descontaminar,
  estimarFundo,
  mascaraPorCor,
  removerIlhas,
} from './mascara.ts'
import type { Caixa } from './mascara.ts'

export type MotorUsado = 'estudio' | 'ia' | 'hibrido' | 'origem' | '-'

export type Resultado = {
  entrada: string
  relativo: string
  saidas: string[]
  motor: MotorUsado
  avisos: string[]
  uniformidadeDoFundo: number
  ocupacao: number
  milissegundos: number
  status: 'ok' | 'pulado' | 'erro'
  erro?: string
}

export type Contexto = {
  iaPronta: boolean
  /** Permite ao painel web reaproveitar a mascara da rede entre um ajuste e outro. */
  mascaraIA?: (
    rgba: Uint8Array,
    largura: number,
    altura: number,
    modelo: NomeModelo,
  ) => Promise<Float32Array>
}

export type Recorte = {
  alfa: Float32Array
  motor: MotorUsado
  avisos: string[]
  uniformidadeDoFundo: number
  caixa: Caixa | null
}

const EXTENSAO: Record<Formato, string> = { png: '.png', webp: '.webp', jpg: '.jpg' }

export function destinosDe(relativo: string, opcoes: Opcoes): Map<Formato, string> {
  const semExtensao = relativo.slice(0, relativo.length - path.extname(relativo).length)
  const destinos = new Map<Formato, string>()
  for (const formato of opcoes.formatos) {
    destinos.set(formato, path.join(opcoes.saida, `${semExtensao}${EXTENSAO[formato]}`))
  }
  return destinos
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await fs.access(caminho)
    return true
  } catch {
    return false
  }
}

/**
 * Decide qual motor usar, calcula o alfa de cada pixel e ja devolve a caixa do produto.
 * O `rgba` sai daqui com a cor da borda limpa - o alfa ainda nao foi aplicado.
 */
export async function calcularRecorte(
  imagem: Carregada,
  opcoes: Opcoes,
  contexto: Contexto,
): Promise<Recorte> {
  const { rgba, largura, altura } = imagem
  const avisos: string[] = []
  const fundo = estimarFundo(rgba, largura, altura)
  const pedirMascaraIA = contexto.mascaraIA ?? mascaraPorIA

  let alfa: Float32Array
  let motor: MotorUsado

  if (imagem.transparenciaOriginal > 0.02) {
    alfa = new Float32Array(largura * altura)
    for (let i = 0; i < alfa.length; i++) alfa[i] = rgba[i * 4 + 3] / 255
    motor = 'origem'
    avisos.push('a foto ja veio recortada; apenas reenquadrei e converti')
  } else {
    const fundoUniforme = fundo.uniformidade >= 0.6
    const soIA = opcoes.motor === 'ia' || (opcoes.motor === 'auto' && !fundoUniforme)

    if (soIA && contexto.iaPronta) {
      const bruta = await pedirMascaraIA(rgba, largura, altura, opcoes.modelo)
      alfa = new Float32Array(bruta.length)
      for (let i = 0; i < bruta.length; i++) {
        alfa[i] = Math.min(1, Math.max(0, (bruta[i] - 0.2) / 0.6))
      }
      motor = 'ia'
      if (!fundoUniforme) avisos.push('fundo nao uniforme: usei so a rede neural')
    } else {
      const tolerancia = (opcoes.tolerancia / 100) * 255
      alfa = mascaraPorCor(rgba, largura, altura, {
        cor: fundo.cor,
        interna: tolerancia * 0.35,
        externa: tolerancia,
        sombra: (opcoes.sombra / 100) * 255,
        furos: opcoes.furos,
        furoMin: opcoes.furoMin,
        furoMax: opcoes.furoMax,
      })
      motor = 'estudio'

      if (opcoes.motor === 'auto' && contexto.iaPronta) {
        const alfaIA = await pedirMascaraIA(rgba, largura, altura, opcoes.modelo)
        const areaIA = fracaoOpaca(alfaIA)
        const areaCor = fracaoOpaca(alfa)
        if (areaIA > 0.005 && areaIA > areaCor * 0.45) {
          const folga = Math.max(3, Math.round(Math.min(largura, altura) * 0.006))
          const permitida = await areaPermitida(alfaIA, largura, altura, folga)
          for (let i = 0; i < alfa.length; i++) if (!permitida[i]) alfa[i] = 0
          motor = 'hibrido'
        } else {
          avisos.push('a rede discordou do recorte por cor; mantive apenas o recorte por cor')
        }
      } else if (opcoes.motor === 'auto' && !contexto.iaPronta && !fundoUniforme) {
        avisos.push('fundo pouco uniforme e modelo ausente: rode "pnpm run setup" para ligar a IA')
      }
    }

    if (opcoes.limpar) removerIlhas(alfa, largura, altura, 0.0004)
    if (opcoes.borda > 0) await refinarBorda(alfa, largura, altura, opcoes.borda)
    if (fundo.uniformidade >= 0.5) descontaminar(rgba, alfa, fundo.cor)
  }

  const restante = cobertura(alfa)
  if (restante > 0.97) avisos.push('quase nada foi removido; confira se o fundo e mesmo liso')
  if (restante < 0.01) avisos.push('quase tudo foi removido; reduza a tolerancia')

  const caixa = caixaDoProduto(alfa, largura, altura)
  if (
    caixa &&
    (caixa.esquerda === 0 ||
      caixa.topo === 0 ||
      caixa.esquerda + caixa.largura >= largura ||
      caixa.topo + caixa.altura >= altura)
  ) {
    avisos.push('o produto encosta na borda da foto original')
  }

  return { alfa, motor, avisos, uniformidadeDoFundo: fundo.uniformidade, caixa }
}

export async function processarArquivo(
  entrada: string,
  relativo: string,
  opcoes: Opcoes,
  contexto: Contexto,
): Promise<Resultado> {
  const comecou = Date.now()
  const destinos = destinosDe(relativo, opcoes)
  const base: Resultado = {
    entrada,
    relativo,
    saidas: [...destinos.values()],
    motor: '-',
    avisos: [],
    uniformidadeDoFundo: 0,
    ocupacao: 0,
    milissegundos: 0,
    status: 'ok',
  }

  if (!opcoes.sobrescrever) {
    const jaFeitos = await Promise.all([...destinos.values()].map(existe))
    if (jaFeitos.every(Boolean)) {
      return { ...base, status: 'pulado', milissegundos: Date.now() - comecou }
    }
  }

  const imagem = await carregar(entrada)
  const recorte = await calcularRecorte(imagem, opcoes, contexto)
  const resultado: Resultado = {
    ...base,
    motor: recorte.motor,
    avisos: recorte.avisos,
    uniformidadeDoFundo: recorte.uniformidadeDoFundo,
  }

  if (!recorte.caixa) {
    return {
      ...resultado,
      status: 'erro',
      erro: 'nao sobrou nenhum pixel de produto',
      milissegundos: Date.now() - comecou,
    }
  }

  aplicarAlfa(imagem.rgba, recorte.alfa)
  resultado.ocupacao =
    (recorte.caixa.largura * recorte.caixa.altura) / (imagem.largura * imagem.altura)

  for (const destino of destinos.values()) {
    await fs.mkdir(path.dirname(destino), { recursive: true })
  }
  const quadro = await montar(imagem.rgba, imagem.largura, imagem.altura, recorte.caixa, opcoes)
  await gravar(quadro, destinos, opcoes)

  return { ...resultado, milissegundos: Date.now() - comecou }
}

function fracaoOpaca(alfa: Float32Array): number {
  let opacos = 0
  for (let i = 0; i < alfa.length; i++) if (alfa[i] > 0.5) opacos++
  return opacos / alfa.length
}
