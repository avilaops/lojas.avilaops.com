# Recuperação de arquivos públicos • Vedashow

Os sete arquivos originais foram encontrados no pacote público de marca de
08/09/2026, em `marketing/materiais/Material/vedashow-2026-09-08/vedashow-extraidas/vedashow`.
O manifesto registra bytes e SHA256; não há imagens redesenhadas ou dados privados.

O workflow manual `marca-publica.yml` começa em `auditar`. Ele consulta somente
o estado de publicação da Vinhos Imperial em transação PostgreSQL somente leitura
e verifica os sete objetos da Vedashow. Não altera cadastro, cobrança ou catálogo.

`restaurar-vedashow` envia somente objetos que responderem 404 e verifica os bytes
depois da escrita. Qualquer objeto existente é preservado, mesmo com hash diferente.
As operações são serializadas no GitHub. A verificação de ausência precede o PUT;
o serviço de armazenamento existente não oferece criação condicional para uploads.
Não executar durante alterações simultâneas desses mesmos arquivos no painel.

A credencial operacional existente é obtida em memória, somente para a variável
`LOJAS_STORAGE_TOKEN` do serviço Render fixo. Não há enumeração de ambiente,
persistência da chave em arquivos, inclusão em argumentos ou logs de respostas.
Uma negativa do provedor encerra a operação, sem ampliar permissões.
[Contrato oficial da leitura individual](https://api-docs.render.com/reference/retrieve-env-var).

Os testes são executados no GitHub CI, sem credenciais nem chamadas reais.
Uma restauração deve ser seguida da conferência dos URLs públicos e da marca.
O logo original da Brilhax ainda depende de recuperação da fonte correta.
