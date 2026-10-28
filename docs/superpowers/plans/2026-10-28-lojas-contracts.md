# Plano de contratos Lojas e Experiments

**Objetivo:** entregar o primeiro gate da AVL-343 alinhado ao Lojas 360.

**Arquitetura:** reutilizar por SHA o inventário estático AST de Experiments
em um job do workflow existente. Comparar a superfície pública v1 contra o
SHA base do PR; preservar relatórios compatíveis com `route-inventory/2`.

**Stack:** Node 24 no analisador, módulos ESM, node:test e GitHub Actions.

## Tarefas

- [x] Conferir código, CI, factories da API e contrato de importação do laboratório.
- [x] Escrever testes para remoções, renomeação, catch-all, adições, exports
  não funcionais, conflitos, erros sintáticos e inventário vazio.
- [x] Implementar comparação conservadora e captura sem executar handlers.
- [x] Integrar no workflow existente como dependência da imagem e guardar artefatos.
- [ ] Validar exclusivamente no GitHub CI e registrar o resultado do commit exato.

## Revisão

Factories desconhecidas são pendências explícitas, não resultados funcionais.
Não modificar runtime, domínio fiscal ou o repositório Experiments neste incremento.
PR deve ser rascunho: o workflow existente integra e implanta PRs prontos.
Autorização atual cobre implementação e CI; implantação não foi solicitada.
