import sharp from 'sharp'

/**
 * Apara a borda do recorte. Um corte por cor sempre deixa uma franja clara: os pixels do
 * antialias original sao metade fundo, metade produto, e ficam longe demais da cor do fundo
 * para entrar na tolerancia. Aqui o alfa e borrado de leve e remapeado com o corte acima de
 * 0.5 - o que encolhe a silhueta em torno de meio pixel e transforma a franja em transicao
 * suave. O que sobra dela some na descontaminacao de cor.
 */
export async function refinarBorda(
  alfa: Float32Array,
  largura: number,
  altura: number,
  forcaEmPixels: number,
): Promise<void> {
  if (forcaEmPixels <= 0) return

  const bytes = Buffer.allocUnsafe(alfa.length)
  for (let i = 0; i < alfa.length; i++) bytes[i] = Math.round(alfa[i] * 255)

  const suave = await sharp(bytes, { raw: { width: largura, height: altura, channels: 1 } })
    .blur(Math.max(0.3, forcaEmPixels * 0.6))
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const passo = suave.info.channels
  for (let i = 0; i < alfa.length; i++) {
    const valor = suave.data[i * passo] / 255
    alfa[i] = Math.min(1, Math.max(0, (valor - 0.55) / 0.4))
  }
}
