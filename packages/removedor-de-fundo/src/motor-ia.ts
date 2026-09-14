import sharp from 'sharp'
import * as ort from 'onnxruntime-node'
import type { NomeModelo } from './config.ts'
import { caminhoDoModelo } from './modelo.ts'

const LADO = 320
const MEDIA = [0.485, 0.456, 0.406]
const DESVIO = [0.229, 0.224, 0.225]

let sessaoAtual: Promise<ort.InferenceSession> | null = null
let modeloDaSessao: NomeModelo | null = null

export async function abrirSessao(nome: NomeModelo): Promise<ort.InferenceSession> {
  if (!sessaoAtual || modeloDaSessao !== nome) {
    modeloDaSessao = nome
    sessaoAtual = ort.InferenceSession.create(caminhoDoModelo(nome), {
      executionProviders: ['cpu'],
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
      graphOptimizationLevel: 'all',
      logSeverityLevel: 3,
    })
  }
  return sessaoAtual
}

export async function encerrarSessao(): Promise<void> {
  if (!sessaoAtual) return
  const sessao = await sessaoAtual
  sessaoAtual = null
  modeloDaSessao = null
  await sessao.release()
}

/**
 * Silhueta do produto pela rede U-2-Net. Devolve alfa 0-1 por pixel no tamanho original.
 * A rede acerta o recorte macro (inclusive vaos internos e sombras), mas trabalha em
 * 320x320 - a borda fina quem resolve e o motor de estudio.
 */
export async function mascaraPorIA(
  rgba: Uint8Array,
  largura: number,
  altura: number,
  nome: NomeModelo,
): Promise<Float32Array> {
  const reduzida = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
    raw: { width: largura, height: altura, channels: 4 },
  })
    .flatten({ background: '#ffffff' })
    .resize(LADO, LADO, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer()

  let maximo = 1
  for (let i = 0; i < reduzida.length; i++) if (reduzida[i] > maximo) maximo = reduzida[i]

  const entrada = new Float32Array(3 * LADO * LADO)
  const pixels = LADO * LADO
  for (let i = 0; i < pixels; i++) {
    const p = i * 3
    entrada[i] = (reduzida[p] / maximo - MEDIA[0]) / DESVIO[0]
    entrada[pixels + i] = (reduzida[p + 1] / maximo - MEDIA[1]) / DESVIO[1]
    entrada[2 * pixels + i] = (reduzida[p + 2] / maximo - MEDIA[2]) / DESVIO[2]
  }

  const sessao = await abrirSessao(nome)
  const nomeEntrada = sessao.inputNames[0]
  const saida = await sessao.run({
    [nomeEntrada]: new ort.Tensor('float32', entrada, [1, 3, LADO, LADO]),
  })
  const bruto = saida[sessao.outputNames[0]].data as Float32Array

  let menor = Infinity
  let maior = -Infinity
  for (let i = 0; i < pixels; i++) {
    if (bruto[i] < menor) menor = bruto[i]
    if (bruto[i] > maior) maior = bruto[i]
  }
  const amplitude = maior - menor || 1

  const cinza = Buffer.allocUnsafe(pixels)
  for (let i = 0; i < pixels; i++) {
    cinza[i] = Math.round((Math.min(Math.max((bruto[i] - menor) / amplitude, 0), 1)) * 255)
  }

  // toColourspace('b-w') e obrigatorio: sem ele o sharp devolve o raw em 3 canais
  // e a mascara sai embaralhada.
  const ampliada = await sharp(cinza, { raw: { width: LADO, height: LADO, channels: 1 } })
    .resize(largura, altura, { fit: 'fill', kernel: 'lanczos3' })
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const passo = ampliada.info.channels
  const alfa = new Float32Array(largura * altura)
  for (let i = 0; i < alfa.length; i++) alfa[i] = ampliada.data[i * passo] / 255
  return alfa
}

/**
 * Transforma a silhueta da rede em uma "area permitida" com folga: tudo que ficar fora
 * dela e fundo com certeza (sombra projetada, vao da alca, reflexo no chao). A folga evita
 * que a imprecisao dos 320x320 coma a borda real do produto.
 */
export async function areaPermitida(
  alfaIA: Float32Array,
  largura: number,
  altura: number,
  folgaEmPixels: number,
): Promise<Uint8Array> {
  const binaria = Buffer.allocUnsafe(alfaIA.length)
  for (let i = 0; i < alfaIA.length; i++) binaria[i] = alfaIA[i] > 0.5 ? 255 : 0

  const desfocada = await sharp(binaria, { raw: { width: largura, height: altura, channels: 1 } })
    .blur(Math.max(0.4, folgaEmPixels / 2))
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const passo = desfocada.info.channels
  const permitida = new Uint8Array(alfaIA.length)
  for (let i = 0; i < permitida.length; i++) permitida[i] = desfocada.data[i * passo] > 18 ? 1 : 0
  return permitida
}
