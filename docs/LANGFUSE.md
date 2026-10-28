# Observabilidade Gemini

As três chamadas reais de Gemini (`copy-produto`, `diagnostico-marca` e
`seo-categoria`) geram observações `generation`, com modelo, duração, contagem
de candidatos, tokens de entrada/saída e estado de erro do provedor.

Configure `LANGFUSE_BASE_URL`, `LANGFUSE_PUBLIC_KEY` e `LANGFUSE_SECRET_KEY`
somente no ambiente do servidor. Ausência de qualquer variável mantém o
rastreamento desligado. `LANGFUSE_TRACING_ENABLED=false` desativa explicitamente.
O SDK 6.0.2 exige Langfuse v4 >= 4.59.0. OpenTelemetry Node 0.223.0 é a última
versão compatível com os peers 2.x de Langfuse 6.0.2; Node 0.300.0 usa peers 3.x.

Prompts, respostas, nomes de lojas/produtos, identificadores de clientes,
argumentos, chaves e mensagens brutas de erro não são exportados. Input/output
contêm somente resumos fixos de privacidade. Tokens de raciocínio são somados
aos tokens de saída; tokens desconhecidos não são estimados. Esta política
permite medir custo e falhas, mas não avaliar o conteúdo gerado no Langfuse.
Validação JSON/Zod posterior permanece fora da observação da chamada ao provedor.

O gancho Node do Next inicializa o SDK uma vez por processo; não registra
instrumentações automáticas de HTTP ou banco. Somente spans `lojas.gemini.*`
são exportados. Cada chamada encerra sua observação e aguarda `forceFlush()`
antes de devolver resultado, inclusive nas rotinas fora de uma requisição.
O exportador usa timeout de três segundos; falhas de exportação preservam o
resultado/erro original e nunca repetem a chamada ao Gemini.

Tipos, lint, testes e build são executados exclusivamente pelo workflow
existente `Build e deploy` no GitHub. O teste `src/lib/langfuse.test.ts` entra
na suíte `npm test` já executada no build da imagem. Nenhum comando da aplicação
deve ser executado no servidor para validar a integração.

Após aprovação, CI verde e deploy solicitado, valide uma geração real de cada
funcionalidade e consulte as três observações no Langfuse. Confira nome, tipo,
modelo, tokens, duração, erro e ausência de conteúdo privado conforme as
[boas práticas atuais](https://langfuse.com/docs/observability/best-practices).
Sem esse exercício e as credenciais configuradas, não há evidência de entrega
de traces no ambiente de destino.
