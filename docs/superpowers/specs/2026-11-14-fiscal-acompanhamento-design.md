# P004 • acompanhamento operacional de NF-e

## Objetivo aprovado

O proprietário autorizou iniciar a implementação após a análise do módulo.
Este incremento fecha as três prioridades apresentadas: XML pendente,
sincronização fiscal recorrente e indicação das notas com entrada registrada.
Fornecedor, custos, conversões, recebimento parcial e financeiro permanecem
na demanda ampla AVL-254 e terão incrementos próprios.

## Abordagem

Reutilizar o coletor por NSU e sua reserva persistente por CNPJ. A obtenção
do XML posterior à manifestação passa pela mesma distribuição, fila e cursor,
sem consulta paralela por chave nem retransmissão automática de manifestação.
Resultados incertos são reconciliados exclusivamente com eventos completos
recebidos da SEFAZ, conferindo chave, autor, ambiente, tipo, sequência e
protocolo. Sem evidência, continuam explicitamente pendentes.

Uma fila nova de consultas por chave exigiria outro limite e coordenação por
CNPJ; reenviar intenções incertas poderia repetir um efeito fiscal. A escolha
do implementador é usar o coletor existente, com recuperação e observabilidade.

O relógio existente ganha o modo fiscal explícito `FISCAL_AGENDADOR=1` quando
o relógio geral estiver desligado. Nesse modo somente `fiscal.receber` pode
executar; cobranças, mensagens e demais rotinas permanecem fora da seleção.
O painel informa configuração, última execução, erro e próxima consulta.
Não alterar variáveis de produção nesta implementação.

## Contrato operacional

• Consultas de leitura nunca consultam a SEFAZ, enviam eventos ou movimentam estoque.
• O comando de ciência no resumo exige confirmação e usa a rota existente.
• Atualizar documentos é uma ação explícita e respeita o intervalo por CNPJ.
• A manifestação não comprova que o XML já foi recebido.
• Resumo e completo da mesma chave compartilham manifestação, recibo e cancelamento.
• Cancelamento posterior conserva o recibo e sinaliza revisão, sem estorno automático.
• A lista mostra estado operacional separado do estado fiscal e atualiza após entrada.
• CNPJ delegado ao P003 mantém sua autoridade e não recebe transmissão local.
• Preservar backend TypeScript e estoque transacional/idempotente existentes.
• Nenhum teste usa certificado, documento, manifestação ou estoque reais.

## Verificação e entrega

Testes e builds somente no GitHub CI. Escrever regressões primeiro e observar
RED antes da implementação. Cobrir recuperação por evento legítimo, rejeição
de evento divergente/inseguro, isolamento, recibo por chave, cancelamento e
modo fiscal isolado. Jornada de navegador com dados sintéticos verifica o
resumo acionável e a atualização da lista após entrada. Entregar PR em rascunho
com checks e evidências; merge e ativação operacional ficam separados.
