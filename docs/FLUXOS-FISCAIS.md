# Fluxos do monitor fiscal

## Arquitetura verificada em 18/10/2026

- PR #105: recebimento A1/SEFAZ, XML e isolamento por loja.
- PR #118: separação visual entre NF-e e eventos; não acrescentou automações.
- `sincronizarNotas` não tinha emissão fiscal, nem foi encontrado outro emissor fiscal no código examinado.
- Workflow n8n `p063mxq8dQijjBDL`, **Lojas - Operação Completa**, ativo, versão `d1169593-486c-4aae-b52b-9e191bc82dbc`, consultado por conexão autorizada: webhook central, reivindicação em `AutomacaoEvento` e roteamento comercial, sem ramo fiscal. A busca por workflows fiscais não encontrou um consumidor fiscal das Lojas; o MCP central oferece ferramentas fiscais de consulta, o que não equivale a esse consumidor.
- A plataforma já possui destinos por loja (`WebhookApi`), fila `EntregaWebhook` e rotina `webhooks.entregar`, com assinatura HMAC, novas tentativas, trava de envio, estado e retenção. Esses mecanismos são reutilizados; não há segundo transportador, agendador ou credencial.

## Comportamento

Somente o dono, com permissão `fiscal`, configura os fluxos ou encaminha documentos. Vale o plano Loja Pro já exigido pelas integrações de servidor. Cada regra aponta para um **destino existente da própria loja**, seleciona eventos e grupos de dados e identifica uma finalidade:

| Finalidade | Uso do receptor |
| --- | --- |
| Fornecedores | Conferir identificação e cadastro |
| Compras | Comparar nota e compra, preparando a conciliação |
| Produtos | Preparar revisão de cadastro, exigindo XML completo |
| Divergências | Identificar diferenças e encaminhar a análise |

Eventos disponíveis: `fiscal.nfe-resumo`, `fiscal.nfe-recebida` e `fiscal.evento-recebido`. Grupos: fornecedor, totais, itens, evento. Identificação do documento acompanha todas as projeções; certificado, senha, XML bruto e grupos não selecionados não são enviados. Quantidade e preço unitário fiscal permanecem strings decimais para preservar precisão. Valores totais usam centavos; ausentes são `null`.

Na consulta à SEFAZ, **somente documentos novos** retornados por `createManyAndReturn(skipDuplicates)` alimentam a fila. Documento, marca de encaminhamento, entrega e avanço do NSU estão na mesma transação. Uma falha reverte tudo. O transporte acontece depois, pela rotina existente; não faz HTTP dentro da transação.

Regras novas não enviam o histórico automaticamente. **Usar no fluxo → Confirmar encaminhamento** permite escolher uma nota anterior e uma regra. Mesmo sob concorrência, a marca persistida em `DocumentoFiscalLoja.fluxosEnfileirados` impede repetir documento/regra após a retenção da fila. `eventId` deriva de tipo, tenant, CNPJ, NSU e fluxo. Entrega ao consumidor continua sendo **pelo menos uma vez**, exigindo deduplicação no receptor.

A FK composta impede associar uma regra a um destino de outro tenant. Todas as leituras/mutações do painel usam tenant da sessão. Mutações fiscais exigem a origem pública configurada. Há no máximo uma regra por tenant/destino/finalidade; edições preservam a identidade e não modificam corpos já enfileirados. Pausar uma regra interrompe novos enfileiramentos; para bloquear também a fila pendente, desligue o destino.

O monitor pesquisa todo o histórico da loja com paginação de 30 documentos, tipo e período de recebimento em horário de São Paulo. O histórico fiscal mostra as últimas 30 entregas, documento, fluxo, destino, IDs, tentativas e falhas, sem expor seu corpo completo. `ENTREGUE` significa aceite HTTP do destino, **não aprovação da conferência**.

## Contrato para n8n e outros receptores

Não aponte um fluxo fiscal ao webhook central comercial sem adaptar o receptor: o contrato fiscal é o da fila assinada, diferente do envelope comercial `AutomacaoEvento`.

O destino recebe POST JSON com `x-lojas-evento`, `x-lojas-entrega` e `x-lojas-assinatura`. A assinatura é `t=<segundos>,v1=HMAC-SHA256(segredo, t + '.' + corpoBruto)`. O segredo é o do destino já cadastrado. Compare em tempo constante e recuse timestamps fora de cinco minutos; o exemplo e a função de referência estão em `webhooks-api.ts` e `docs/API.md`.

O envelope fiscal contém:

- `id`, `versao: 1`, `tipo`, `criadoEm`, `tenantId`, `correlationId: fiscal:<documentoId>`;
- `fluxo`: id, nome, finalidade, configurador e solicitante manual quando aplicável;
- `controle`: `modo: REVISAO`, `exigeConfirmacaoFinanceira: true`, `exigeConfirmacaoEstoque: true`, `exigeConfirmacaoProdutos: true`;
- `dados.documento` e somente os grupos selecionados em `dados`.

No n8n: validar assinatura e versão → validar tenant e finalidade → reivindicar a chave `(tenantId, id)` em armazenamento durável → registrar entrada de revisão → responder 2xx após persistência. A conferência subsequente lê `dados.fornecedor`, `dados.totais`, `dados.itens` ou `dados.evento`. Resumo e evento não oferecem itens de NF-e completa.

O receptor deve respeitar as aprovações do processo antes de aplicar qualquer alteração. Esta implementação **apenas entrega dados**: não cadastra fornecedor, não altera produto, não movimenta estoque, não cria pagamento e não aprova conciliação. Não fornece credenciais administrativas no corpo nem chama APIs de escrita desses módulos.

Nenhum workflow n8n foi alterado, criado ou publicado por esta mudança. Antes de ativar uma regra operacional, o destino precisa implementar esse contrato e a etapa de revisão. Um endpoint que responde 200 sem persistir não comprova execução do processo.

## Publicação e retorno

Aplicar a migração aditiva `20261018210000_fluxos_fiscais` antes de iniciar o código novo. Ela cria regras vazias e marcadores vazios; não encaminha documentos existentes. Confirmar a rotina `webhooks.entregar` na implantação.

Para retornar ao código anterior, pausar novos fluxos e desligar seus destinos se houver fila pendente. As tabelas/colunas novas podem permanecer sem uso. Não remover a coluna de marcas nem reconstruir destinos como forma de retry: isso perde proteção de deduplicação. O histórico operacional deve ser mantido conforme a retenção vigente.
