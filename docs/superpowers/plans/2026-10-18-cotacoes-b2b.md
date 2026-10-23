# Plano AVL-234 — cotações B2B

Spec: `docs/superpowers/specs/2026-10-18-cotacoes-b2b-design.md`

## Restrições globais

- TDD em cada tarefa.
- Isolamento multi-tenant em banco e domínio.
- Sem commit, push, merge ou publicação durante a execução.
- Sem reserva antes da conversão.

## Tarefa 1 — Persistência imutável

Criar enums, modelos, relações e migration SQL para cotações, versões, anexos
e eventos. Verificar chaves compostas, checks e triggers append-only.

## Tarefa 2 — Contratos e domínio

Criar schemas Zod e serviço para criar/listar/obter, contrapropor, submeter,
aprovar por alçada, cancelar/expirar e registrar histórico.

## Tarefa 3 — Conversão e recompra

Converter a versão aprovada em pedido uma única vez, preservar snapshot e
reservar estoque. Criar recompra com preços atuais e sem reaproveitar aprovação.

## Tarefa 4 — APIs administrativa, do painel e do comprador

Expor as operações em rotas autenticadas para administração, equipe da loja e
comprador, com isolamento por tenant, respostas de erro consistentes e
cobertura de integração.

## Tarefa 5 — Verificação integral

Executar Prisma generate/validate, testes unitários e de integração, lint,
typecheck e build. Revisar diff e registrar evidências. Prints não aplicáveis:
o issue entrega persistência, domínio e API, sem alteração visual.
