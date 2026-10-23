# Plano de Implementação — OMNI-0.2

<!-- markdownlint-disable MD013 -->

## Objetivo

Entregar um inventário versionado das integrações do Lojas 360, sustentado por evidência do código, documentação e consulta somente leitura ao n8n.

## Etapas

1. Criar um teste de contrato para esquema, cobertura mínima, lacunas rastreáveis e ausência de segredos.
2. Executar o teste antes do inventário e confirmar a falha esperada.
3. Criar `docs/integracoes/lojas-360.v1.json` com o retrato datado das capacidades.
4. Criar `docs/OMNI-INVENTARIO-INTEGRACOES.md` como visão operacional e guia de manutenção.
5. Registrar OMNI-0.2 e integrações relevantes no controle da equipe.
6. Executar teste direcionado, suíte geral, TypeScript, ESLint, markdownlint e verificação do diff.
7. Revisar o conteúdo, concluir um único commit, publicar a branch e abrir PR sem merge ou deploy.
