# Estrutura de desenvolvimento de Lojas no padrão MLOps

## Responsabilidade

O proprietário determinou em 28/10/2026 que demandas sem responsável pertencem
ao responsável do projeto. Em Lojas, essa identidade é o agente `codex`.
O cadastro o distingue de uma pessoa humana. Atribuições explícitas prevalecem;
campos legados nulos herdam o responsável sem apagar o histórico.

O perfil `.agents/mlops/project.json` e `controle.json` precisam concordar
sobre o responsável padrão. O CI recusa identidades desconhecidas e gera os
responsáveis efetivos de todas as tarefas no relatório de CI.
Essa regra não concede credenciais nem amplia autorização operacional.

## Base comum e módulos

Experiments é a base compartilhada de inventário, avaliação e rastreabilidade
para melhorar o desenvolvimento dos projetos. Lojas adota seus contratos
versionados e avaliadores, preservando os serviços que executam o negócio.
Não é necessário reescrever os produtos ou migrá-los para um monorepo.

O perfil inicial organiza fundação, comércio B2B, fiscal e CMS. É um primeiro
recorte, não um inventário exaustivo de todas as capacidades do Lojas 360.
CMS é um módulo de conteúdo/publicação; a implementação de Lojas não possui
integração CMS identificada nesta inspeção. O módulo permanece `planned`,
com lacunas explícitas, até seu contrato e adaptador serem implementados.
Isso não declara inexistência do produto CMS nem propõe substituí-lo.

Cada módulo informa dependências, fontes, contratos, testes e planos de fluxo.
`existing` significa apenas que há implementação/referências no checkout.
Não significa completo, homologado ou implantado. Dependência ausente, ciclo,
arquivo inexistente ou módulo existente sem referência de teste reprovam o CI.

## Fluxo de desenvolvimento

1. Registrar demanda com responsável herdado ou explícito, objetivo e aceite.
2. Identificar módulo, autoridade dos dados, identidade, tenant e contrato.
3. Definir o plano antes de implementar: interface, requisição, autorização,
   domínio, persistência, efeitos, falhas e resposta.
4. Implementar na stack existente, sem executar código nos servidores.
5. Enviar ao GitHub; CI testa, gera inventário e compara contratos.
6. Vincular observações reais aos checks, com ambiente, versão, runId e hashes.
7. Revisar e implantar somente no escopo autorizado, usando imagem da CI.
8. Verificar o comportamento implantado e registrar separadamente sua evidência.

O primeiro plano é cotação → aprovação → pedido, priorizado no SETUP do
Experiments e relacionado à AVL-234. O adapter do job de integração preserva o
TAP integral, exige os nomes exatos declarados no mapa versionado, recalcula o
SHA-256 do artefato e usa o avaliador fixado do Experiments. Ele vincula somente
autorização, domínio, efeitos e resposta. Interface, requisição, persistência e
falhas permanecem `not_run` até existirem provas que satisfaçam seus critérios.

O adaptador runtime complementar vincula as demais asserções quando executadas;
nenhuma dimensão é aprovada sem sua própria evidência.

## Artefatos executáveis

O job de contratos do workflow existente produz:

- `inventory.json`: fontes de rotas em `route-inventory/2`.
- `compatibility.json`: comparação da superfície v1 com baseline explícito.
- `development.json`: módulos, dependências, responsáveis efetivos, fontes com
  hashes e planos avaliados pelo próprio Experiments em `flow-verification/1`.

O job de integração produz `cotacao-pedido.json` e o TAP que lhe dá origem no
artefato `lojas-flow-observations-<sha>`. A avaliação é do ambiente PostgreSQL
isolado da CI e declara `originAuthenticated: false`, conforme o contrato do
Experiments; não é evidência de staging ou produção.

O JSON Schema rejeita campos desconhecidos do perfil. O verificador confere
referências dentro do checkout, responsável cadastrado, dependências e as oito
dimensões obrigatórias de cada plano. Os hashes do relatório de estrutura cobrem
somente os arquivos referenciados, não o repositório inteiro.

Sem observações, o avaliador retorna `not_run`. Observação ausente ou sem método
compatível não ganha aprovação por inferência. CI estrutural verde significa
que a estrutura é consistente; o relatório funcional parcial também não aprova
o fluxo completo nem autoriza publicação. Testes, build e infraestrutura
continuam exclusivamente na CI. O job não importa dados no laboratório, não
chama provedores e não executa IA.

### Observações reais do piloto B2B

O job de integração agora preserva `lojas-runtime-<sha>`. Após asserções reais
em PostgreSQL, o helper de testes grava um resumo de asserções e métricas
sintéticas, sem serializar comprador, pedido, credenciais ou corpos comerciais.
O registro vincula check, commit, execução/tentativa da CI e hash do plano.

O job de contratos depende da integração e baixa somente o artefato da mesma
execução. O adaptador confere identidade do check, commit, ambiente isolado,
plano e bytes do artefato antes de chamar o avaliador real do Experiments.
Commit/execução/plano divergentes, hashes alterados ou caminhos externos
reprovam o gate. Não existe busca automática de evidência em runs anteriores.

`development.json` conserva a análise estrutural e acrescenta `runtime`.
Os checks de preço, isolamento no domínio, idempotência e releitura podem
receber observações. A regressão de expiração, revisão antiga e falta de
aprovação também registra o check de falhas quando aprovada. Os demais permanecem
`not_run`; o fluxo completo fica
inconclusivo enquanto faltar qualquer dimensão. Esse resultado não bloqueia
a evolução da implementação nem declara o módulo concluído.

O isolamento testado aqui é do domínio/banco, não da sessão HTTP. Não há prova
de interface ou reinício do serviço nesta captura. Os registros são produzidos
por código da CI e conferidos por hashes; isso não é atestação remota e
`originAuthenticated` permanece falso no contrato de Experiments.

### Conversão de cotação

Reserva, criação de pedido e evento de conversão usam a mesma transação.
Falha reverte o conjunto e permite retry; chamadas concorrentes convergem no
pedido da cotação. Preço e condições vêm da versão aprovada; empresa, unidade
e centro de custo são preservados. A projeção do comprador seleciona somente
os campos necessários e nunca serializa hash de senha. Totais recusam valores
fora do limite persistível por Prisma Int antes de tentar gravá-los.

## Próximas entregas sobre esta base

1. Completar as observações ainda ausentes do piloto cotação/pedido: navegador
   desktop/mobile, corpo HTTP inválido, reinício controlado e falhas de expiração,
   revisão conflitante e ausência de aprovação.
2. Completar contratos de payload e consumidores da AVL-343.
3. Expandir os módulos e os planos conforme o Lojas 360; CMS requer contrato
   de conteúdo/publicação, identidade/tenant, prévia, confirmação e reversão.
4. Reutilizar o mesmo formato nos outros projetos, inspecionando seus contratos,
   responsáveis e CI antes de alterar cada repositório.

Referências: [Lojas 360](https://linear.app/avilaops/document/175d6093-f313-4b77-be7c-33eb5ebd1f72),
[MLOps](https://linear.app/avilaops/project/mlops-d5c4c72bf4ac),
[Experiments](https://github.com/avilaops/experiments),
[contratos do CI](CONTRATOS-EXPERIMENTS.md).
