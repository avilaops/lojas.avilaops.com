# Download integral de NF-e — 24/10/2026

## Escopo

Validação do download autenticado de XML original e DANFE PDF no Monitor de
Notas, com isolamento por tenant. Nenhuma manifestação fiscal foi enviada e
nenhum workflow n8n foi alterado.

## Diagnóstico de produção

Verificação sanitizada no dispositivo `ubuntu-4gb-nbg1-1`, sem imprimir
segredos, CNPJ, chave de acesso, XML, cookie ou identificadores internos:

| Configuração | Presença |
| --- | --- |
| `ERP_API_URL` | ausente |
| `ERP_APP_URL` | ausente |
| `ERP_API_KEYS_BY_CNPJ` | ausente; zero chaves configuradas |
| `FISCAL_SHARED_API_URL` | presente |
| `FISCAL_SHARED_SERVICE_KEY` | presente |
| `CLOUDFLARE_ACCOUNT_ID` | presente |
| `FISCAL_R2_CREDENTIALS_FILE` | presente |

O caminho ERP não opera em produção enquanto URL e chave por CNPJ não forem
configuradas. O caminho local opera pelo serviço fiscal compartilhado. R2 é
somente cache e sua indisponibilidade não bloqueia a geração sob demanda.

Uma sessão assinada foi criada apenas em memória dentro do container de
produção para um tenant que possui `procNFe`. As rotas HTTP reais retornaram:

- XML: HTTP 200, `application/xml`, anexo privado, 8.305 bytes e hash idêntico
  ao XML original persistido;
- DANFE: HTTP 200, `application/pdf`, anexo privado, 5.491 bytes e assinatura
  `%PDF-` válida;
- tentativa com o mesmo ID por outro tenant: HTTP 404;
- tentativa de baixar `resNFe` na versão publicada: HTTP 200, defeito
  reproduzido e corrigido neste branch para HTTP 409.

## Causa e correção

A rota local de XML filtrava por tenant, mas devolvia qualquer schema salvo.
Assim, um `resNFe` podia receber nome e tipo de XML integral. O proxy do ERP
também encaminhava o corpo sem comprovar tipo, tamanho ou conteúdo; um erro
JSON do upstream podia chegar ao navegador com extensão fiscal.

A correção centraliza os downloads e exige:

- `procNFe` contendo `NFe` e `infNFe`, sem DTD ou entidade;
- consulta conjunta por `id` e `tenantId`;
- DANFE com tipo `application/pdf`, limite de 12 MiB e assinatura `%PDF-`;
- XML do ERP com tipo XML e conteúdo integral válido;
- `Content-Disposition`, `Cache-Control: private, no-store` e `nosniff`;
- queda controlada quando ERP ou gerador compartilhado não está configurado;
- continuidade sem R2, usando banco para XML e geração sob demanda para PDF.

## Integrações verificadas

- Linear: AVL-254, AVL-91, AVL-94 e AVL-95 lidas; nenhuma issue duplicada.
- n8n: `GA9NuruDG2OdyK25` permanece inativo e apenas valida contrato;
  `p063mxq8dQijjBDL` permanece ativo sem consumidor de NSU.
- Next.js: Route Handlers podem devolver `Response` binária com cabeçalhos.
- Prisma: a consulta de documento combina `id` e `tenantId` no `where`.
- OpenAI: nenhuma dependência adicionada.

## Validação local

- 12 testes fiscais direcionados aprovados;
- 1.270 testes da suíte completa aprovados;
- TypeScript aprovado;
- ESLint direcionado aprovado sem avisos;
- build de produção Next.js aprovado;
- teste PostgreSQL local não executado porque o host não possui Docker; o
  cenário foi adicionado à suíte de integração para execução no CI.
- CI `40103746135` aprovado no PR #172: 195 testes de integração em PostgreSQL
  18, 1.271 testes na imagem, lint, TypeScript e build de 116 rotas.

## Pendências externas

- configurar `ERP_API_URL` ou `ERP_APP_URL` e uma entrada por CNPJ em
  `ERP_API_KEYS_BY_CNPJ` para habilitar o caminho canônico do ERP;
- manifestação real continua fora do escopo e depende de ação humana explícita.

## Revalidação após deploy

O PR #172 foi mesclado no commit `dcabcf6`. O run de produção `40104406643`
aprovou integração, imagem, deploy e fumaça; o container saudável expôs o mesmo
commit no rótulo de revisão.

A prova autenticada foi repetida dentro do container já publicado:

- XML integral: HTTP 200, 8.305 bytes, tipo e cabeçalhos corretos e hash
  idêntico ao original persistido;
- DANFE: HTTP 200, 5.491 bytes, `application/pdf` e assinatura `%PDF-`;
- abertura do DANFE com `pypdf`: uma página, não criptografada e com área de
  página válida;
- `resNFe`: HTTP 409;
- documento de outro tenant: HTTP 404.

O arquivo PDF temporário e o ambiente do parser foram removidos ao fim da
prova. Nenhum conteúdo fiscal, identificador, cookie ou segredo foi impresso.
