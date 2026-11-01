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

- [x] Adicionar testes de compatibilidade direcional e os executar na CI antes
  da implementação; entrada mais restrita e saída mais ampla devem reprovar.
- [x] Extrair ConsultaDeCupom para api-cupom-contrato.ts; acrescentar sucesso e
  erro usados pela rota. Exportar schemas suportados; unsupported deve falhar.
- [x] Implementar consumidor independente, exemplos sintéticos e testes HTTP;
  corpo malformado, recusa, correlação e falha de protocolo devem ser visíveis.
- [x] Exportar payloads, comparar com baseline explícito e preservar relatório
  com SHAs/hashes. Conectar ao job de integração já existente.
- [x] Vincular respostas reais dos testes PostgreSQL aos schemas e consumidor.
- [ ] Revisar diff, conferir CI completa do SHA final e atualizar PR/Linear.

## Pontos de revisão

Normalização antes dos limites; campos opcionais; objetos estritos na entrada
e extensíveis no consumidor; fronteiras numéricas inclusivas; schema desconhecido;
baseline ausente somente na introdução; erros preservam código e correlação.

## Registro de execução

RED efetivo: CI 40639817817, nove falhas explícitas por funcionalidades
ausentes. A tentativa anterior falhou no carregador CJS/ESM dos testes;
corrigida usando .mjs, sem contar essa falha como prova comportamental.

Revisão independente encontrou coerção omitida e unidade Unicode incorreta.
CI 40640349284 reproduziu o problema UTF-16 antes da correção. O teste inicial
de coerção usava o entrypoint ESM de Zod, com construtor distinto do produtor
CommonJS; foi corrigido para eliminar esse falso positivo. CI 40640581776
reproduziu a coerção omitida com o mesmo construtor do produtor. Coerção passou
a ser recusada; extensões UTF-16 preservam as regras Zod existentes.

Decisão: exportação é um contrato com extensões explícitas, não JSON Schema
puro para corpo bruto. Custo: leitores externos precisam entender essas
extensões. Não se altera o comportamento da API para simplificar o exportador.
