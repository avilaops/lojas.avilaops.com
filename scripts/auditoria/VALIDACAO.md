# Validação da versão 1.0.0

Data: 15/10/2026.

- Nove testes locais passaram: parser, entradas inseguras, sitemap, classificação comercial, transporte, ausência de certificação indevida, isolamento de lojas, remoção de contatos e separação da autenticação administrativa das consultas públicas.
- ESLint dos scripts de coleta, gerador e testes passou. O SDK gerado foi validado no plugin n8n, não tratado como um script Node comum.
- Workflow n8n final: `valid: true`, seis nós, sem advertências retornadas pelo validador.
- O validador da primeira conexão sofreu falha interna nas tentativas finais; a validação somente leitura pela segunda conexão respondeu com sucesso. Isso não demonstrou que qualquer workflow foi salvo ou executado remotamente.
- Coleta pública real da PK: 67 verificações, 57 passaram, zero falharam, zero bloqueadas, dez não testadas. Prontidão comercial continua `NAO_CERTIFICADA`.
- Resultado da coleta: `D:\Projetos\outputs\auditorias-padronizadas\2026-10-15T18-03-08-037Z\pkvedacoes.json` e `.md`.
- A primeira coleta sofreu falhas de transporte e preservou quatro resultados `BLOQUEADO`, em pasta distinta. A nova execução não apagou o histórico nem transformou o erro em falha comercial.
- Somente a PK foi coletada ao vivo. O manifesto completo de lojas será obtido pelo GET administrativo quando o workflow for salvo e testado com a conexão escolhida.
- Não houve publicação, agendamento, execução do fluxo operacional existente ou alteração de loja.

## Pendente

O plugin disponibiliza duas conexões chamadas “n8n - Codex”; foi solicitada a escolha antes de uma escrita remota. O arquivo `workflow.n8n.js` está pronto para salvar como rascunho após essa definição. Publicação não faz parte desta entrega.

Depois de salvar: testar com dados fixados de duas lojas, comparar com uma execução real autorizada, revisar a lista de domínios e o objetivo comercial de cada loja. O teste local dos nós Code simula os contratos de entrada/saída; não é uma execução real no runtime n8n.
