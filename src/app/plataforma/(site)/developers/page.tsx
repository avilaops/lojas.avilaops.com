import Link from "next/link";
import type { Metadata } from "next";
import { indiceDaApi } from "@/lib/api-indice";
import { recurso } from "@/lib/mcp-oauth";
import { AREAS, FERRAMENTAS, ehEscrita } from "@/lib/mcp-permissoes";

export const metadata: Metadata = {
  title: "Desenvolvedores & IA",
  description: "Documentação do conector MCP e da API para integrar a loja a um assistente de IA, a um ERP ou a um site próprio.",
};

const EXPLICACAO_DO_ERRO: Record<string, string> = {
  chave_ausente: "A requisição veio sem chave.",
  chave_invalida: "Chave em formato desconhecido ou que não existe.",
  chave_revogada: "A chave foi revogada no painel.",
  escopo_insuficiente: "A chave não tem o escopo que a rota exige.",
  plano_sem_api: "Chave secreta é do plano Loja Pro.",
  loja_fora_do_ar: "A loja não está no ar.",
  parametro_invalido: "Campo errado, faltando ou desconhecido. A mensagem diz qual.",
  nao_encontrado: "Não existe nesta loja.",
  conflito: "O pedido é válido, mas o estado atual não permite: slug ou SKU já em uso, pedido ainda não pago.",
  limite_excedido: "Requisições demais por minuto. O cabeçalho Retry-After diz quanto esperar.",
  erro_interno: "Erro do nosso lado. Informe o id da requisição ao suporte.",
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * A documentação pública para quem integra.
 *
 * **Nada aqui é texto solto.** As rotas, os escopos e os códigos de erro vêm de
 * `indiceDaApi` (o mesmo dado de `GET /api/v1`); as ferramentas do conector vêm
 * de `FERRAMENTAS`. A página já teve uma lista escrita à mão com cinco das 26
 * ferramentas e uma chave que não era mais emitida.
 */
export default function DevelopersPage() {
  const api = indiceDaApi();
  const ferramentas = Object.entries(FERRAMENTAS);

  return (
    <div className="container-loja py-16 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Documentação Técnica</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">Conector de IA e API</h1>
        <p className="mt-3 text-muted-foreground">
          Duas formas de ligar a loja a outro sistema: o conector MCP, para um assistente de IA operar a loja por conversa, e a API,
          para um ERP, um PDV ou um site próprio.
        </p>
      </div>

      <div className="grid gap-6">
        <Bloco titulo="Conector MCP">
          <code className="mt-3 block rounded-lg bg-muted p-3 text-sm font-mono">{recurso()}</code>
          <p className="mt-3 text-sm text-muted-foreground">
            Adicione este endereço como conector no Claude, no ChatGPT ou no Codex e autorize a loja pelo login do painel. O
            assistente descobre o fluxo sozinho (OAuth 2.1 com PKCE e registro dinâmico de cliente). Na autorização você escolhe o
            que ele pode: consultar e alterar, só consultar, ou área por área. Exclusivo do plano Loja Pro.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Para automações sem tela, como n8n e scripts, crie no painel uma chave secreta com o escopo{" "}
            <code className="font-mono text-xs">mcp:usar</code> e envie no cabeçalho{" "}
            <code className="font-mono text-xs">Authorization: Bearer lojas_sk_…</code>.
          </p>
        </Bloco>

        <Bloco titulo={`Ferramentas do conector (${ferramentas.length})`}>
          <p className="mt-2 text-sm text-muted-foreground">
            O assistente só vê as ferramentas que a conexão pode usar. As que alteram a loja vêm marcadas, para ele pedir
            confirmação antes de agir.
          </p>
          <div className="mt-4 grid gap-5">
            {AREAS.map((area) => {
              const daArea = ferramentas.filter(([, f]) => f.escopo === area.ler || f.escopo === area.escrever);
              return (
                <div key={area.id}>
                  <h3 className="text-sm font-bold">{area.nome}</h3>
                  <ul className="mt-1 divide-y divide-border text-sm text-muted-foreground">
                    {daArea.map(([nome, f]) => (
                      <li key={nome} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                        <span>
                          <code className="font-mono text-xs text-foreground">{nome}</code> {f.titulo}
                        </span>
                        <span className="text-xs">{ehEscrita(f.escopo) ? "altera" : "consulta"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Bloco>

        <Bloco titulo={`API ${api.versao}`}>
          <dl className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <div>
              <dt className="font-bold text-foreground">Autenticação</dt>
              <dd>{api.autenticacao} As chaves são criadas em Painel, IA e API.</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Dinheiro</dt>
              <dd>{api.dinheiro}</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Paginação</dt>
              <dd>
                Parâmetros {api.paginacao.parametros.join(" e ")}; {api.paginacao.padrao} itens por página, no máximo {api.paginacao.maximo}.
              </dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Resposta</dt>
              <dd>
                Sucesso: <code className="font-mono text-xs">{`{ "dados": … }`}</code>. Erro:{" "}
                <code className="font-mono text-xs">{`{ "erro": { "codigo", "mensagem" }, "requisicao" }`}</code>. Compare o{" "}
                <code className="font-mono text-xs">codigo</code>; a mensagem é para gente e pode mudar.
              </dd>
            </div>
          </dl>
        </Bloco>

        <Bloco titulo="Rotas">
          <ul className="mt-3 divide-y divide-border text-sm">
            {api.rotas.map((r) => (
              <li key={`${r.metodo} ${r.caminho}`} className="py-3">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-xs font-bold">{r.metodo}</span>
                  <code className="font-mono text-xs text-foreground">{r.caminho}</code>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{r.escopo}</span>
                </p>
                <p className="mt-1 text-muted-foreground">{r.descricao}</p>
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco titulo="Compra pelo site ou app próprio">
          <p className="mt-2 text-sm text-muted-foreground">{api.compra.quem}</p>
          <dl className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <div>
              <dt className="font-bold text-foreground">Corpo de POST /api/v1/vitrine/checkout</dt>
              <dd><code className="font-mono text-xs break-words">{api.compra.corpo}</code></dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Regras</dt>
              <dd>{api.compra.regras}</dd>
            </div>
          </dl>
        </Bloco>

        <Bloco titulo="Webhooks">
          <p className="mt-2 text-sm text-muted-foreground">
            Em vez de consultar os pedidos de tempos em tempos, seu sistema é avisado. {api.webhooks.cadastro}
          </p>
          <ul className="mt-3 divide-y divide-border text-sm text-muted-foreground">
            {Object.entries(api.webhooks.eventos).map(([tipo, descricao]) => (
              <li key={tipo} className="py-1.5">
                <code className="font-mono text-xs text-foreground">{tipo}</code> {descricao}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <div>
              <dt className="font-bold text-foreground">Corpo</dt>
              <dd><code className="font-mono text-xs">{api.webhooks.corpo}</code></dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Assinatura</dt>
              <dd>{api.webhooks.assinatura}</dd>
            </div>
            <div>
              <dt className="font-bold text-foreground">Entrega</dt>
              <dd>{api.webhooks.entrega}</dd>
            </div>
          </dl>
        </Bloco>

        <Bloco titulo="Escopos">
          <ul className="mt-3 divide-y divide-border text-sm text-muted-foreground">
            {Object.entries(api.escopos).map(([escopo, descricao]) => (
              <li key={escopo} className="py-1.5">
                <code className="font-mono text-xs text-foreground">{escopo}</code> {descricao}
              </li>
            ))}
          </ul>
        </Bloco>

        <Bloco titulo="Erros">
          <ul className="mt-3 divide-y divide-border text-sm text-muted-foreground">
            {Object.entries(api.erros).map(([codigo, status]) => (
              <li key={codigo} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                <span className="font-mono text-xs font-bold">{status}</span>
                <code className="font-mono text-xs text-foreground">{codigo}</code>
                <span>{EXPLICACAO_DO_ERRO[codigo] ?? ""}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>

      <div className="mt-10 flex gap-4">
        <Link href="/" className="btn-secundario">Voltar ao início</Link>
        <Link href="/painel" className="btn-primario">Acessar Painel</Link>
      </div>
    </div>
  );
}
