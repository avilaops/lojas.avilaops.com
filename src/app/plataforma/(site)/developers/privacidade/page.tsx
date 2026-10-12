import Link from "next/link";
import type { Metadata } from "next";
import { RETENCAO_DIAS } from "@/lib/mcp-historico";
import { recurso, VALIDADE } from "@/lib/mcp-oauth";
import { FERRAMENTAS } from "@/lib/mcp-permissoes";

export const metadata: Metadata = {
  title: "Privacidade do conector de IA",
  description: "Que dados o conector MCP da loja lê, guarda e por quanto tempo, quando um assistente de IA como o Claude opera a loja.",
  alternates: { canonical: "/developers/privacidade" },
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">{titulo}</h2>
      <div className="mt-3 grid gap-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

const DIA_MS = 86_400_000;

/**
 * Política de privacidade do conector MCP: é o link que o diretório de plugins
 * do Claude mostra (`plugin/.claude-plugin/plugin.json`).
 *
 * Prazos e listas vêm do código que os aplica (`RETENCAO_DIAS`, `VALIDADE`,
 * `FERRAMENTAS`), para a página não prometer o que o sistema não faz.
 */
export default function PrivacidadeDoConectorPage() {
  const deClientes = Object.entries(FERRAMENTAS)
    .filter(([, f]) => f.escopo === "clientes:ler" || f.escopo === "pedidos:ler")
    .map(([nome]) => nome);
  const horasDoAcesso = VALIDADE.acessoMs / 3_600_000;
  const diasDaRenovacao = VALIDADE.renovacaoMs / DIA_MS;

  return (
    <div className="container-loja py-16 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Privacidade</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Conector de IA da loja</h1>
        <p className="mt-3 text-muted-foreground">
          Como o conector <code className="font-mono text-xs">{recurso()}</code> trata dados quando um assistente de IA (Claude,
          ChatGPT, Codex ou automações como n8n) opera uma loja da plataforma Lojas por Avila Ops. Complementa a{" "}
          <a href="https://avilaops.com/politica-de-privacidade/" className="underline">política de privacidade da Avila Ops</a>.
        </p>
      </div>

      <div className="grid gap-6">
        <Bloco titulo="Quem controla o acesso">
          <p>
            O lojista. A conexão só existe depois que ele entra no painel e autoriza; na autorização ele escolhe o que o assistente
            pode fazer (consultar e alterar, só consultar, ou área por área). Ele muda ou desliga a conexão quando quiser em Painel,
            IA e API. O assistente não amplia o próprio acesso.
          </p>
        </Bloco>

        <Bloco titulo="Que dados o assistente lê">
          <p>
            Os da loja autorizada: catálogo, estoque, pedidos, cupons, avaliações e resumos de vendas. Com acesso a clientes ou
            pedidos, as ferramentas {deClientes.map((n, i) => (
              <span key={n}>
                {i > 0 ? (i === deClientes.length - 1 ? " e " : ", ") : ""}
                <code className="font-mono text-xs">{n}</code>
              </span>
            ))}{" "}
            devolvem dados pessoais de quem comprou na loja, como nome, e-mail e endereço de entrega.
          </p>
          <p>
            Esses dados já estão na plataforma por causa das vendas da loja. O conector entrega ao assistente só o que a ferramenta
            pedida devolve e não faz cópia deles.
          </p>
        </Bloco>

        <Bloco titulo="O que fica guardado e por quanto tempo">
          <ul className="list-disc pl-5 grid gap-2">
            <li>
              <strong className="text-foreground">Histórico de uso:</strong> uma linha por chamada, com a ferramenta, o horário, se
              alterou a loja, se deu certo e o código do item tocado (SKU, número do pedido). Sem argumentos e sem resultados: nome,
              e-mail ou endereço de cliente não entram. Uma faxina diária apaga, de todas as lojas, o que passou de
              {RETENCAO_DIAS} dias.
            </li>
            <li>
              <strong className="text-foreground">O que o assistente cria ou altera</strong> (produto, preço, estoque, cupom, status de
              pedido) passa a fazer parte da loja e fica como qualquer alteração feita pelo painel.
            </li>
            <li>
              <strong className="text-foreground">Credenciais:</strong> o acesso vale {horasDoAcesso} hora e se renova enquanto a
              conexão é usada; conexão parada por {diasDaRenovacao} dias vence. Guardamos só o hash das credenciais, nunca o valor.
            </li>
          </ul>
        </Bloco>

        <Bloco titulo="Para onde os dados vão">
          <p>
            Só para o assistente que o lojista conectou, como resposta às ferramentas que ele chamou. O conector não envia dados da
            loja a outros serviços. O que o assistente faz com a resposta segue a política do provedor dele (para o Claude, a da
            Anthropic).
          </p>
        </Bloco>

        <Bloco titulo="Direitos e contato">
          <p>
            Clientes de uma loja exercem os direitos da LGPD com a própria loja, que é a controladora dos dados dos seus compradores.
            Para dúvidas sobre o conector, escreva para{" "}
            <a href="mailto:nicolas@avilaops.com" className="underline">nicolas@avilaops.com</a>.
          </p>
        </Bloco>
      </div>

      <div className="mt-10 flex gap-4">
        <Link href="/developers" className="btn-secundario">Documentação do conector</Link>
      </div>
    </div>
  );
}
