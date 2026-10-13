import { PagBankProvider } from "./pagbank.ts";
import type { DefinicaoProvedor } from "./types.ts";

/**
 * PagBank no registro. A conexão é OAuth (PagBank Connect): a documentação
 * publica a autorização em `https://connect.pagbank.com.br/oauth2/authorize`
 * e a troca do `code` em `POST /tokens`. Este arquivo só consome o access
 * token já obtido, como a definição do Mercado Pago. O redirect fica para a
 * tela de Recebimento.
 *
 * `segredos.accessToken` é obrigatório. `segredos.chavePublicaWebhook` é a
 * chave pública (`type=webhook`) em Base64; sem ela, a primeira notificação
 * consulta `GET /public-keys/webhook`. `segredos.ambiente=sandbox` aponta
 * para o host de teste.
 */
export const definicaoPagBank: DefinicaoProvedor = {
  id: "pagbank",
  nome: "PagBank",
  capacidades: {
    pix: true,
    cartao: true,
    boleto: true,
    estorno: true,
    estornoParcial: true,
    webhook: true,
    confirmacaoAutomatica: true,
  },
  tipoConexao: "oauth",
  campos: [],
  guia: [],
  async testarConexao({ segredos }) {
    const token = segredos.accessToken?.trim();
    if (!token) {
      return { ok: false, mensagem: "Nenhuma conta conectada ainda. Conecte o PagBank.", avisos: [] };
    }
    const avisos: string[] = [];
    if (token.startsWith("TEST-")) {
      avisos.push("Esta é uma credencial de TESTE: as vendas não entram de verdade.");
    }
    if (segredos.ambiente === "sandbox") {
      avisos.push("O ambiente sandbox está ligado: as vendas não entram de verdade.");
    }
    const base = segredos.ambiente === "sandbox" ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
    let resposta: Response;
    try {
      // Leitura da chave pública de cartão: não cobra e não cria chave.
      resposta = await fetch(`${base}/public-keys/card`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, mensagem: "Não consegui falar com o PagBank agora. Tente de novo em alguns minutos.", avisos };
    }
    if (resposta.status === 401 || resposta.status === 403) {
      return { ok: false, mensagem: "O PagBank recusou o acesso. Conecte a conta de novo.", avisos };
    }
    if (!resposta.ok) {
      return { ok: false, mensagem: `O PagBank respondeu com erro (${resposta.status}). Tente de novo daqui a pouco.`, avisos };
    }
    return { ok: true, mensagem: "Conta conectada e pronta para receber.", avisos };
  },
  criar({ segredos, notificationUrl, descritorFatura }) {
    const accessToken = segredos.accessToken?.trim();
    if (!accessToken) throw new Error("PagBank sem access token.");
    return new PagBankProvider({
      accessToken,
      chavePublicaWebhook: segredos.chavePublicaWebhook,
      notificationUrl,
      descritorFatura,
      ambiente: segredos.ambiente === "sandbox" ? "sandbox" : "producao",
    });
  },
};
