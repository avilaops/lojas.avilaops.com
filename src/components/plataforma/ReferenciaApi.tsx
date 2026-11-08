import { indiceDaApi } from "@/lib/api-indice";
import { AREAS, FERRAMENTAS, ehEscrita } from "@/lib/mcp-permissoes";

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

export function FerramentasConector() {
  const ferramentas = Object.entries(FERRAMENTAS);
  return <div className="documentacao-referencia">
    <p className="mt-2 text-sm text-muted-foreground">
      O assistente só vê as ferramentas que a conexão pode usar. As que alteram a loja vêm marcadas como destrutivas
      (sobrescrevem, mudam status ou excluem), para ele pedir confirmação antes de agir.
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
                  <span className="text-xs">{!ehEscrita(f.escopo) ? "consulta" : f.aditiva ? "acrescenta" : "altera"}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  </div>;
}

export function ResumoApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
    <p className="documentacao-versao">Versão {api.versao}</p>
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
  </div>;
}

export function RotasApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
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
  </div>;
}

export function CompraApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
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
  </div>;
}

export function WebhooksApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
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
  </div>;
}

export function EscoposApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
    <ul className="mt-3 divide-y divide-border text-sm text-muted-foreground">
      {Object.entries(api.escopos).map(([escopo, descricao]) => (
        <li key={escopo} className="py-1.5">
          <code className="font-mono text-xs text-foreground">{escopo}</code> {descricao}
        </li>
      ))}
    </ul>
  </div>;
}

export function ErrosApi() {
  const api = indiceDaApi();
  return <div className="documentacao-referencia">
    <ul className="mt-3 divide-y divide-border text-sm text-muted-foreground">
      {Object.entries(api.erros).map(([codigo, status]) => (
        <li key={codigo} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
          <span className="font-mono text-xs font-bold">{status}</span>
          <code className="font-mono text-xs text-foreground">{codigo}</code>
          <span>{EXPLICACAO_DO_ERRO[codigo] ?? ""}</span>
        </li>
      ))}
    </ul>
  </div>;
}
