# CepCerto: token de consulta

> Execução: Codex implementa neste turno, com revisão final independente.

**Objetivo:** usar somente `CEPCERTO_CONSULTA_KEY` nas cotações CepCerto de
produto, carrinho e checkout, mantendo a credencial no servidor.

**Design:** [Contrato](../specs/2026-11-12-cepcerto-consulta-design.md).

**Stack:** Next.js, TypeScript, fetch e node:test existentes; sem dependências novas.

## Tarefa 1: contrato de consulta

- [x] Atualizar `src/lib/cepcerto.test.ts` e a integração de `frete.test.ts`:
  token exclusivo, GET, CEPs normalizados, gramas e caixa, PAC/SEDEX com desconto,
  ausência de chave, parâmetros inválidos e falhas sem vazamento de credenciais.
- [x] Abrir PR em rascunho e observar a falha desses testes no GitHub CI.
- [x] Adaptar `src/lib/cepcerto.ts`, mantendo as assinaturas públicas existentes.
- [x] Atualizar `.env.example`, comentários do `.env` local, sincronização n8n
  e `docs/MELHOR-ENVIO.md` para o campo `consumption_key` do token de consulta.
- [x] Verificar testes, tipos, lint e build pelo CI existente.
- [x] Revisar o diff, registrar commit/ambiente/execução e entregar o PR em rascunho.

## Foco da revisão

Credenciais não usadas não habilitam cotação; tokens especiais são codificados
na URL; preço de balcão não substitui desconto ausente; serviço sem prazo não
ganha prazo inventado; erro de rede não imprime URL ou token; Melhor Envio
conectado preserva sua conta; nenhuma chamada real integra os testes.

## Evidências

Preparação: branch isolada `feat/cepcerto-token-consulta`, base `5748f59`.
RED: commit `db3abe7`, run `43276484581`, testes unitários das duas partes
falharam. O job `131386617839` registrou a falha da integração de `frete.test.ts`:
esperava uma consulta da conta da plataforma e recebeu zero chamadas.
GREEN: commit `85113f7dd94454a9fe09039e589a8571e106225d`, run
`43277249722` concluído com sucesso. As duas partes unitárias passaram
(682/682 e 772/772); integrações PostgreSQL, contratos, tipos, lint,
compilação, navegador e construção da imagem também passaram.
Entrega no servidor, deploy e fumaça de produção foram pulados pelo fluxo de PR.

Revisão independente do diff `5748f59..85113f7`: nenhum finding Critical,
Important ou Minor. Conta real, credenciais dos ambientes, operação do
sincronizador e cotação real permanecem fora desta homologação de CI.

Entrega: <https://github.com/avilaops/lojas.avilaops.com/pull/235>, em rascunho.
CI: <https://github.com/avilaops/lojas.avilaops.com/actions/runs/43277249722>.
A evidência final altera apenas este plano e o registro da equipe;
o código avaliado permanece no commit `85113f7`.
