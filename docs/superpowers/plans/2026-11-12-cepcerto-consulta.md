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
- [ ] Verificar testes, tipos, lint e build pelo CI existente.
- [ ] Revisar o diff, registrar commit/ambiente/execução e entregar o PR em rascunho.

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
GREEN e revisão serão registrados após os resultados reais.
