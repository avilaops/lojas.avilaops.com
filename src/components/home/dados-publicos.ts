import { numeroDeContato } from "@/lib/canais-publicos";
import type { DadosHome } from "./tipos";

/** Mesma disponibilidade de atendimento para a composição e o carrinho. */
export function dadosPublicosDaHome(dados: DadosHome): DadosHome {
  return {
    ...dados,
    t: { ...dados.t, whatsapp: numeroDeContato(dados.t.whatsapp) },
  };
}
