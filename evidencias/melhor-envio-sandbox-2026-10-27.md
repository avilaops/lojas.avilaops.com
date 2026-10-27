# Melhor Envio: preparação de sandbox em 27/10/2026

## Escopo e estado

O proprietário autorizou apenas sandbox e confirmou que ainda precisa cadastrar
ou preencher o aplicativo. Esta entrega prepara conexão OAuth e cotação no
Lojas; não implementa compra, geração ou impressão de etiquetas. A cotação
autenticada no provedor e a homologação permanecem pendentes.

O trabalho partiu de `0d38de822696d8314bc86ed3e773ff9b0f317fbe`, em checkout
isolado `D:/Projetos/SaaS/lojas-melhor-envio-20261027`, ramo
`feat/melhor-envio-contrato-20261027`. As alterações existentes no checkout
principal não foram incluídas nesta entrega.

## Alterações verificáveis

- Sandbox é o ambiente padrão. Configuração só aceita os dois domínios oficiais.
- O recurso `frete_melhor_envio_sandbox` em `Tenant.recursos` libera a loja de
  teste; ele nasce desligado e respeita a trava global de recursos. Nenhuma
  loja foi habilitada nem teve seus dados comerciais alterados nesta etapa.
- Conexão OAuth, callback, uso do token e cotação de prova respeitam essa
  liberação. Não há lista de lojas em variável de ambiente.
- O painel distingue ambiente, conta conectada e teste de cotação.
- Cotação envia volumes/seguro conforme o exemplo textual oficial; a
  inconsistência do schema publicado foi registrada no manual.
- Serviço com preço inválido ou sem prazo verificável é descartado. O prazo
  presumido de sete dias foi removido. Valores customizados têm precedência.
- Erro HTTP de OAuth não grava tokens. O retorno valida tipos e prazo antes
  da cifragem, mantém o filtro por loja e não expõe respostas nos logs.
- Requisições autenticadas não usam cache nem seguem redirecionamentos.

## Verificação local

- `npm ci --no-audit --no-fund`: concluído, sem mudança no lockfile.
- `npx --no-install prisma generate`: concluído.
- `npm run typecheck`: aprovado.
- `npm run lint`: zero erros; 24 avisos preexistentes em arquivos fora do escopo.
- Suíte completa: **1.289 testes aprovados, zero falhas**, após as mudanças finais.
- `git diff --check`: aprovado.

O primeiro teste completo revelou duas falhas de ambiente nos testes fiscais:
o OpenSSL do Strawberry aponta para um arquivo de configuração inexistente.
A repetição usou o OpenSSL já instalado com Git, somente no ambiente do processo:

```powershell
$env:PATH = 'C:\Program Files\Git\ucrt64\bin;' + $env:PATH
$env:OPENSSL_CONF = 'C:\Program Files\Git\ucrt64\etc\ssl\openssl.cnf'
$env:OPENSSL_MODULES = 'C:\Program Files\Git\ucrt64\lib\ossl-modules'
npm test
```

Nenhum arquivo fiscal foi alterado. Os testes de contrato usam respostas
simuladas, não credenciais reais e não comprovam uma cotação no Melhor Envio.
O build da imagem e os testes de banco seguem o CI do GitHub.

## Leitura do ambiente hospedado antes da publicação

Inspeção somente leitura em `applications`: container `lojas-avilaops` saudável,
revisão `0d38de822696d8314bc86ed3e773ff9b0f317fbe`. As variáveis
`MELHOR_ENVIO_CLIENT_ID` e `MELHOR_ENVIO_CLIENT_SECRET` não estavam presentes no
arquivo de ambiente nem no container. A credencial n8n **Lojas - Melhor Envio**
existe, tipo `httpCustomAuth`; seus valores não foram lidos nem registrados.

Verificação HTTP anônima em `https://lojas.avilaops.com`:

| Rota | Método | Resultado |
| --- | --- | --- |
| `/api/health` | GET | 200 |
| `/api/painel/entrega/melhor-envio` | GET | 307 para `/entrar` |
| `/api/painel/entrega/melhor-envio` | POST | 401 |
| `/melhor-envio/callback` sem parâmetros | GET | 307 com retorno incompleto |

Nenhum token, autorização OAuth ou teste de cotação real foi executado. Não
houve compra de frete, mensagem enviada ao Melhor Envio ou alteração direta
do aplicativo em `applications`.

## Continuação e reversão

O [manual de sandbox](../docs/MELHOR-ENVIO-SANDBOX.md) contém cadastro do
aplicativo, callback, escopos, habilitação da loja e roteiro da demonstração.
Faltam credenciais do aplicativo sandbox, definição da loja de testes,
configuração privada pelo fluxo aprovado e autorização OAuth dessa conta.

Para impedir o uso do sandbox, remover o recurso da loja ou usar a trava
`LOJAS_RECURSOS_DESLIGADOS=frete_melhor_envio_sandbox`, preservando outros
recursos eventualmente desligados. Para reverter o código, reverter o commit
da integração e publicar a imagem pelo GitHub CI. Esta entrega não altera
schema, não adiciona migração nem apaga dados.
