# Contrato de cupom v1 — plano de implementação

**Objetivo:** fechar o módulo de payload da consulta de cupom com contrato,
consumidor e gate executáveis.

**Arquitetura:** schemas Zod compartilhados pela rota; exportação restrita e
comparação direcional no workflow existente. Consumidor com tipos próprios.

**Stack:** TypeScript, Zod 3, node:test, tsx e GitHub Actions existentes.

**Spec:** ../specs/2026-10-28-cupom-contract-design.md

## Restrições

Builds e testes somente no GitHub CI. Sem deploy, segredos ou mudanças nas
regras de cupom, autorização ou tenant. Preservar branch e trabalho existente.

## Execução

- [ ] Adicionar testes de compatibilidade direcional e os executar na CI antes
  da implementação; entrada mais restrita e saída mais ampla devem reprovar.
- [ ] Extrair ConsultaDeCupom para api-cupom-contrato.ts; acrescentar sucesso e
  erro usados pela rota. Exportar schemas suportados; unsupported deve falhar.
- [ ] Implementar consumidor independente, exemplos sintéticos e testes HTTP;
  corpo malformado, recusa, correlação e falha de protocolo devem ser visíveis.
- [ ] Exportar payloads, comparar com baseline explícito e preservar relatório
  com SHAs/hashes. Conectar ao job de integração já existente.
- [ ] Vincular respostas reais dos testes PostgreSQL aos schemas e consumidor.
- [ ] Revisar diff, conferir CI completa do SHA final e atualizar PR/Linear.

## Pontos de revisão

Normalização antes dos limites; campos opcionais; objetos estritos na entrada
e extensíveis no consumidor; fronteiras numéricas inclusivas; schema desconhecido;
baseline ausente somente na introdução; erros preservam código e correlação.
