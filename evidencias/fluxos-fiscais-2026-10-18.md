# Fluxos fiscais — evidências de implementação

- PR: https://github.com/avilaops/lojas.avilaops.com/pull/125
- Base examinada: `1960c5f1e44ca3b92f9e558cbbe2206c63b27251`.
- Implementação inicial publicada: `759c884b662979ad925e132877069778e3e4bcfd`.
- Workflow n8n consultado, sem mutação: `p063mxq8dQijjBDL`, versão `d1169593-486c-4aae-b52b-9e191bc82dbc`, ativo e igual ao rascunho no momento da leitura. Não havia ramo fiscal.

## Verificação

- 1.125 testes unitários locais aprovados (25 suítes, zero falhas).
- TypeScript e ESLint dos arquivos afetados aprovados.
- Build local Next.js 16.2.10/Turbopack concluído; aviso de tracing do módulo preexistente de remoção de fundo, sem erro de compilação.
- Schema Prisma validado e client gerado.
- QA com Chromium e aplicação Next.js local: configuração por formulário, seleção manual, deduplicação, histórico, dados selecionados, filtro e recusas de sessão/origem/gerente/outra loja aprovados. Gerente não consegue remover nem reativar destino usado em regra fiscal.
- Layout verificado em 1440, 390 e 320 px, sem rolagem horizontal da página. O navegador não fez chamadas a destinos reais; `ROTINAS_AGENDADOR=0`.
- CI inicial: https://github.com/avilaops/lojas.avilaops.com/actions/runs/39164999972
- Job `117785978432`, **testes de integração**: migrações e **187 testes aprovados**, zero falhas, em PostgreSQL 18.6 nativo no runner. Inclui a transação de recebimento fiscal, rollback de XML/fila/NSU, concorrência, isolamento e assinatura.
- Job `117786229565`, **image / build**: aprovado. Deploy e fumaça de produção foram corretamente ignorados por se tratar de pull request.

O ambiente local não permite iniciar o Postgres nativo como outro usuário. A alternativa PGlite 18.6 aplicou todas as migrações e executou cenários positivos, mas o adaptador de protocolo apresentou erros ao simular violações SQL. Essa execução não é registrada como suíte aprovada; as provas negativas foram confirmadas no PostgreSQL nativo do CI.

## Continuação autorizada: implantação e consumidor

Após a solicitação para concluir as pendências, a implementação foi conciliada com os PRs #126/#127 (main `9152616`). A origem fiscal canônica do ERP e o bloqueio da coleta SEFAZ duplicada foram preservados.

- Suíte local atualizada: **1.128 testes unitários**, zero falhas.
- TypeScript e ESLint dos arquivos adicionais aprovados.
- Novos testes de integração: configuração idempotente e preservação de pausa; recepção HMAC e concorrência; recusa de assinatura falsa/expirada e troca de tenant/evento.
- Ramo fiscal de três nós acrescentado ao **rascunho** do workflow existente `p063mxq8dQijjBDL`, versão `dbeeca93-f794-4a57-813d-de8f4eff2ff0`. Credencial administrativa existente confirmada. Ramos anteriores e grupos preservados. O aviso de excesso de caixas no canvas refere-se aos nós comerciais anteriores; os dois nós novos de processamento estão agrupados.
- A recepção persiste somente referências de revisão, com `PENDENTE` e `nenhumaMovimentacao: true`; painel mostra a execução n8n. Configuração administrativa preserva regras existentes e não reenvia histórico.

Os resultados finais de CI, merge, deploy e ensaio em produção serão registrados na conversa do PR #125, incluindo IDs das execuções. Este arquivo não considera o rascunho como publicado nem os testes de produção como concluídos antecipadamente.

## Limites e ativação inicial

O PR está em rascunho. Não houve deploy, migração em produção, uso de certificados reais, movimentação de estoque, transação financeira ou alteração/publicação de workflows n8n. A entrega é um mecanismo configurável de encaminhamento para revisão; não comprova implementação de conferências no sistema de destino.

A migração é aditiva e cria zero regras. Para operar, revisar e implantar a plataforma, conferir a rotina existente `webhooks.entregar` e selecionar um destino que valide assinatura, deduplique `tenantId/id`, persista a entrada e imponha as aprovações do processo. O webhook central comercial do n8n não passa a entender esse contrato automaticamente. Instruções em `docs/FLUXOS-FISCAIS.md`.
