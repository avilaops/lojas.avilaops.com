# Downloads fiscais e conferência de entrada de estoque

## Problema e evidência

O proprietário pede download e seleção de NF-e para entrada no estoque, e
reportou erro de controle de consulta na sincronização. Produção Bereta possui
151 procNFe,192 resNFe e367 eventos. Probe autenticado somente leitura confirmou
XML completo200 e idêntico ao banco, DANFE503 por serviço não configurado e
resumo409. A tabela desktop não oferece seleção; ações fiscais ficam fora da
área visível em telas estreitas. O parser exige NSU com15dígitos, enquanto a
NT2014.002 permite de1a15.

## Abordagem

Manter backend TypeScript e o razão multilocal já existente. O caminho escolhido
para CNPJ sem ERP configurado é conferência dentro do Lojas, sem motor fiscal
ou escrituração financeira novos. Para CNPJ integrado, preservar a autoridade
do ERP e impedir escrita local concorrente. Essa escolha é do implementador,
baseada no estoque já implementado e na ausência de ERP no ambiente recuperado;
a preferência foi perguntada ao proprietário e continua aberta a orientação.

Alternativas consideradas: exigir recuperar o ERP inteiro antes de oferecer
qualquer conferência, ou criar outro estoque/razão independente. Ambas ampliam
o escopo ou duplicam controles que o Lojas já possui. A entrada local apenas
vincula a NF-e recebida aos movimentos existentes, com confirmação explícita.

## Contrato

- Normalizar NSUs recebidos válidos de1a15dígitos para15dígitos antes de
  comparar/persistir; recusar valores inválidos e preservar cursor/intervalo
  em erro. Não antecipar consultas reais ao horário liberado pela SEFAZ.
- Resumo não contém os itens de uma nota completa. Exibir o estado e as ações
  para manifestação explicitamente, sem envio automático de evento fiscal.
- Restabelecer gerador privado de DANFE com biblioteca BrazilFiscalReport,
  executado isoladamente do backend TypeScript. Autenticação servidor-servidor,
  limites de corpo, XML sem entidades/DOCTYPE, NF-e modelo55 com protocolo
  autorizado e conteúdo imutável. Não transmitir XML de clientes ao CI.
- Notas completas podem ser abertas na lista desktop/mobile. Conferência mostra
  fornecedor, número, itens, código/GTIN/unidade/quantidade e valores originais.
  Seleção de variante é explícita; sugestões não vinculam produtos sozinhas.
- Usuário revisa unidades de estoque e local antes de confirmar. Não converter
  unidade comercial silenciosamente; estoque atual usa quantidades inteiras.
- Confirmar entrada exige permissões fiscal e catálogo e mesma origem. Bloquear
  resumo, cancelamento conhecido, NF de outro destinatário/tenant e CNPJ delegado
  ao ERP. Revalidar documento e variantes no servidor.
- Uma transação para todos os itens: razão, saldos, projeções e recibo. Usar
  chave natural tenant/NF-e contra duplicidade, inclusive entre NSUs e requisições
  concorrentes. Repetição idêntica devolve recibo; alteração conflita. Nenhuma
  movimentação decorre de consultar, baixar XML ou selecionar uma nota.
- Cancelamento posterior não estorna estoque automaticamente: conservar recibo
  e indicar revisão necessária. Cadastro de fornecedor, financeiro, criação
  automática de produtos e transmissão fiscal ficam fora desta entrega.

## Verificação e publicação

Builds/testes exclusivamente no GitHub CI: NSU variável/malformado, parser de
itens, autorização por tenant, destinatário, cancelamento, duplicidade,
concorrência, rollback integral e navegador desktop/mobile com dados sintéticos.
Gerador privado deve produzir PDF com conteúdo extraído verificável. Revisão
antes de merge; backup/migração/release exata no Render; smoke real de XML/PDF
e estado de estoque somente leitura, sem entrada em estoque ou manifestação
fiscal real como teste. PK permanece fora no servidor anterior.
