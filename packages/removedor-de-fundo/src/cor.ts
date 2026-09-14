export type Cor = { r: number; g: number; b: number }

const NOMES: Record<string, Cor> = {
  transparente: { r: 0, g: 0, b: 0 },
  branco: { r: 255, g: 255, b: 255 },
  preto: { r: 0, g: 0, b: 0 },
  cinza: { r: 244, g: 244, b: 245 },
}

/** Aceita `transparente`, nomes basicos em portugues, `#fff`, `#ffffff` ou `255,255,255`. */
export function lerCor(bruto: string): 'transparente' | Cor {
  const texto = bruto.trim().toLowerCase()
  if (texto === 'transparente' || texto === 'none' || texto === 'nenhum') return 'transparente'

  const nomeado = NOMES[texto]
  if (nomeado) return nomeado

  const hex = texto.startsWith('#') ? texto.slice(1) : texto
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return {
      r: parseInt(hex[0]! + hex[0]!, 16),
      g: parseInt(hex[1]! + hex[1]!, 16),
      b: parseInt(hex[2]! + hex[2]!, 16),
    }
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  const partes = texto.split(/[,\s]+/).map(Number)
  if (partes.length === 3 && partes.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
    return { r: partes[0]!, g: partes[1]!, b: partes[2]! }
  }

  throw new Error(`cor invalida: "${bruto}" (use transparente, branco, #RRGGBB ou R,G,B)`)
}

export function corParaHex(cor: Cor): string {
  const parte = (n: number) => n.toString(16).padStart(2, '0')
  return `#${parte(cor.r)}${parte(cor.g)}${parte(cor.b)}`
}
