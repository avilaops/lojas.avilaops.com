import type { ThermalBoxVisualInput } from "@avilaops/gerador-3d/thermal-box/schema";
import type { ConfiguracaoSobMedida } from "./configurador-sob-medida";

/**
 * Projeta somente o contrato técnico já existente no editor para o motor 3D.
 * Quantidade e observações permanecem na ficha e não viram geometria.
 */
export function configuracaoParaThermalBoxVisual(configuracao: ConfiguracaoSobMedida): ThermalBoxVisualInput {
  return {
    dimensionsCm: {
      width: configuracao.dimensoes.larguraCm,
      height: configuracao.dimensoes.alturaCm,
      depth: configuracao.dimensoes.profundidadeCm,
    },
    material: configuracao.materialExterno,
    finish: configuracao.acabamento,
    lid: configuracao.tampa,
    mobility: configuracao.mobilidade,
    dividers: configuracao.divisorias,
  };
}

