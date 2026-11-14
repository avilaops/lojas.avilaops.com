# P004 • acompanhamento de NF-e recebidas

## Escopo e versão

Primeiro incremento da AVL-254 autorizado em 14/11/2026: resumo acionável,
recuperação de resultados incertos, coleta fiscal restrita e recibo por chave.
Branch `codex/p004-fiscal-operacao`, base `beab5bd`,
[PR #262](https://github.com/avilaops/P004/pull/262), mantido em rascunho.

Backend TypeScript preservado. Sem migração ou dependência nova. A coleta usa
a reserva de CNPJ, a fila e o cursor existentes. Resultados incertos somente
mudam para aceitos mediante evento completo correspondente e protocolo; o
resumo pode indicar manifestação prévia sem criar uma intenção ou protocolo.

## Regressões observadas

• RED 43610426856: coleta mantinha `PENDENTE_CONFERENCIA` quando deveria
  reconciliar `ACEITA`; módulos de acompanhamento/configuração ausentes.
• CI 43611326831 identificou import de hash ainda usado na assinatura,
  colisão entre CNPJs de fixtures e chamada de atualização de estado no efeito.
  Causas corrigidas sem relaxar os checks.
• CI 43611731432, código `6612a60`: unitários, três shards PostgreSQL, tipos,
  lint, build, contratos e navegador aprovados. A execução geral falhou no
  guard de publicação: disparo manual em branch não pode publicar imagem.
• RED 43611935738: resumo com ciência prévia aparecia incorretamente como
  `AGUARDANDO_MANIFESTACAO`; esperado `AGUARDANDO_XML`. Correção preparada.
• Resultado final da versão corrente deve ser lido nos checks do PR; os runs
  acima são evidências intermediárias e não declaram o HEAD aprovado.

## Cobertura

• XML em outro NSU, recibo compartilhado por chave e isolamento entre lojas.
• Cancelamento posterior conserva recibo e movimentos e pede revisão.
• Autor, chave, ambiente, tipo, sequência e protocolo divergentes não conciliam.
• XML inseguro e resumo de evento sem evidência completa não confirmam intenção.
• Falha de cursor após conciliação reverte evento, resultado e auditoria juntos.
• Ciência ou confirmação já informada pelo resumo acompanha obtenção do XML;
  desconhecimento/operação não realizada pedem revisão.
• Relógio fiscal isolado seleciona somente `fiscal.receber`.
• Navegador sintético: abrir resumo e recusar ciência não criam manifestação;
  confirmar entrada conserva idempotência e a lista mostra o recebimento.

Capturas sintéticas da CI ficam no artefato `lojas-fiscal-entry-browser-<sha>`:
`resumo.png`, `desktop.png`, `mobile-form.png` e `mobile.png`. Capturas de
`6612a60` baixadas e inspecionadas nesta sessão, sem overflow detectado pelo QA.

## Limites da entrega

Produção permanece sem alterações desta branch. Publicação e ativação de
`FISCAL_AGENDADOR=1` são etapas operacionais posteriores; manter
`ROTINAS_AGENDADOR=0` permite ativar somente a coleta. Nenhuma manifestação
fiscal ou entrada real foi executada como teste. A ausência de um evento de
retorno não é interpretada como autorização para retransmitir.

Fornecedor, criação assistida, conversões, custos, recebimento parcial,
compras e financeiro continuam no escopo amplo da AVL-254.
