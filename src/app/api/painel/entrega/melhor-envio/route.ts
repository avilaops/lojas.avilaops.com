import { redirect } from "next/navigation";
import { sessaoDoPainel } from "@/lib/sessao";
import { exigir, permite } from "@/lib/operadores";
import { caixaDoCarrinho, pesoTotalKg } from "@/lib/frete";
import { cotarMelhorEnvio } from "@/lib/melhor-envio";
import { aplicativoConfigurado, desconectar, tokenDaLoja, urlDeAutorizacao } from "@/lib/melhor-envio-conta";

/**
 * O lojista conecta, testa e desconecta a própria conta do Melhor Envio.
 *
 * GET manda para a autorização, POST faz uma cotação de prova e DELETE apaga
 * a credencial daqui.
 */
export const dynamic = "force-dynamic";

const DESTINO = "/painel/configuracoes/entrega";

export async function GET() {
  const s = await sessaoDoPainel();
  if (!s) redirect("/entrar");
  // Balcão não troca a conta que cota o frete da loja inteira.
  if (!permite(s.papel, "configuracoes")) redirect(`${DESTINO}?me=sem-permissao`);
  if (!aplicativoConfigurado()) redirect(`${DESTINO}?me=indisponivel`);

  const base = `https://${process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com"}`;
  // O slug vem da sessão, nunca da URL, e segue assinado no `state`.
  redirect(urlDeAutorizacao(s.tenant.slug, base));
}

/**
 * POST: cota um pacote de prova, da loja até a Avenida Paulista.
 *
 * "Conectado" só diz que o token existe. O que o lojista precisa saber é se o
 * comprador vai ver frete no checkout, e isso depende também do CEP de origem
 * e de a conta ter transportadora habilitada. Por isso o teste é uma cotação
 * de verdade, com a caixa e o peso padrão da loja.
 */
export async function POST() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const loja = s.tenant;

  const origem = (loja.cepOrigem ?? "").replace(/\D/g, "");
  if (origem.length !== 8) {
    return Response.json({ ok: false, mensagem: "Falta o CEP de origem da loja. Preencha o endereço em Dados da empresa." });
  }

  const token = await tokenDaLoja(loja);
  if (!token) {
    return Response.json({ ok: false, mensagem: "A conexão com o Melhor Envio caiu. Conecte a conta de novo." });
  }

  const opcoes = await cotarMelhorEnvio(token, {
    cepOrigem: origem,
    cepDestino: "01310100",
    pesoKg: pesoTotalKg(loja, []),
    caixa: caixaDoCarrinho(loja, []),
    valorDeclarado: 100,
  });
  if (!opcoes) {
    return Response.json({
      ok: false,
      mensagem: "O Melhor Envio não devolveu nenhum frete para um pacote de prova. Confira na sua conta se há transportadora habilitada.",
    });
  }

  return Response.json({
    ok: true,
    mensagem: `Funcionando: ${opcoes.length} ${opcoes.length === 1 ? "serviço cotado" : "serviços cotados"} até São Paulo.`,
    opcoes: opcoes.slice(0, 6).map((o) => ({ nome: o.nome, preco: o.preco, prazoDiasUteis: o.prazoDiasUteis })),
  });
}

/**
 * DELETE apaga a credencial, e só ela. A loja volta a cotar pela tabela
 * própria; os pedidos já feitos não mudam.
 */
export async function DELETE() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  await desconectar(s.tenant.id);
  return Response.json({ desconectado: true });
}
