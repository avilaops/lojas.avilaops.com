import { validarChavePix } from "../core/pix-chave.ts";
import { PixManualProvider } from "./pix-manual.ts";
import type { DefinicaoProvedor } from "./types.ts";

const AVISO = "Não há confirmação automática nem estorno por aqui. A loja confere o Pix na conta e libera o pedido.";

/**
 * Pix na conta do lojista. A conexão pede só a chave e o nome de quem recebe;
 * `validarChavePix` confere o formato, porque o DICT não entra nesta chamada.
 */
export const definicaoPixManual: DefinicaoProvedor = {
  id: "pix_manual",
  nome: "Pix na conta",
  capacidades: {
    pix: true,
    cartao: false,
    boleto: false,
    estorno: false,
    estornoParcial: false,
    webhook: false,
    confirmacaoAutomatica: false,
  },
  tipoConexao: "pix_direto",
  campos: [
    {
      chave: "chavePix",
      rotulo: "Chave Pix",
      segredo: false,
      obrigatorio: true,
      ajuda: "CPF, CNPJ, e-mail, celular com DDD ou chave aleatória.",
    },
    {
      chave: "nomeRecebedor",
      rotulo: "Nome de quem recebe",
      segredo: false,
      obrigatorio: true,
      ajuda: "Como aparece no banco de quem paga. Até 25 caracteres.",
    },
  ],
  guia: [
    { texto: "No app do banco, copie a chave Pix da conta que vai receber." },
    { texto: "O nome de quem recebe é o que aparece para quem paga. Até 25 caracteres." },
  ],
  async testarConexao({ publicos }) {
    const chave = validarChavePix(publicos.chavePix ?? "");
    if (!chave.ok) return { ok: false, mensagem: chave.mensagem, avisos: [] };
    const nome = (publicos.nomeRecebedor ?? "").trim();
    if (!nome) return { ok: false, mensagem: "Informe o nome de quem recebe.", avisos: [] };
    if (new TextEncoder().encode(nome).length > 25) {
      return { ok: false, mensagem: "O nome de quem recebe pode ter no máximo 25 caracteres.", avisos: [] };
    }
    return {
      ok: true,
      mensagem: "Chave conferida. O Pix cai direto nesta conta e a loja confirma o pagamento na mão.",
      conta: nome,
      avisos: [AVISO],
    };
  },
  criar({ publicos, pixManual }) {
    const chave = validarChavePix(publicos.chavePix ?? "");
    if (!chave.ok) throw new Error(chave.mensagem);
    const nome = (publicos.nomeRecebedor ?? "").trim();
    if (!nome) throw new Error("Informe o nome de quem recebe.");
    if (new TextEncoder().encode(nome).length > 25) throw new Error("O nome de quem recebe pode ter no máximo 25 caracteres.");
    if (!pixManual) throw new Error("Pix manual sem o registro da loja.");
    const cidade = (publicos.cidade ?? "").trim() || "BRASILIA";
    return new PixManualProvider({
      chave: chave.chave,
      nomeRecebedor: nome,
      cidade,
      expiraEmMinutos: 24 * 60,
      porta: pixManual,
    });
  },
};
