# Login do Lojas em localhost

O servidor de desenvolvimento usa <http://localhost:3080>. O cookie central
de `.avilaops.com` não é compartilhado com localhost; portanto preencher
somente `SSO_APP_ID` não conclui o login deste ambiente.

## Cadastro no Auth

Em <https://auth.avilaops.com/admin/integracoes>, com administrador e segundo
fator, cadastrar uma integração exclusiva para desenvolvimento:

- Identificador: `lojas-local`.
- Aplicação: `lojas-avilaops-com`.
- Nome: `Lojas — desenvolvimento local`.
- Retorno exato: `http://localhost:3080/api/painel/entrar/oidc`.
- Acesso à Meta: desativado.
- Não substituir nem rotacionar a integração de provisionamento existente.

O segredo é exibido uma única vez. Guardá-lo diretamente em `.env.local`,
fora do controle de versão; não enviar por mensagens nem gravar em documentos.

```dotenv
SSO_APP_ID=lojas-avilaops-com
SSO_URL=https://auth.avilaops.com
LOJAS_BASE_DOMAIN=localhost
LOJAS_OIDC_CLIENT_ID=lojas-local
LOJAS_OIDC_CLIENT_SECRET=
LOJAS_OIDC_REDIRECT_URI=http://localhost:3080/api/painel/entrar/oidc
ROTINAS_AGENDADOR=0
```

## Fluxo implementado

O início do login cria state, nonce e PKCE S256 em cookie cifrado de dez minutos.
O Auth autentica a pessoa e confirma o acesso à aplicação. O callback troca o
código no servidor, verifica a assinatura RS256 com as chaves públicas do Auth,
issuer, audience, expiração e nonce, e compara o subject com `/oauth/userinfo`.

A sessão OIDC usa cookie cifrado HttpOnly; tokens não são enviados ao JavaScript.
A consulta ao Auth continua conferindo a aplicação autorizada e o papel atual
antes da escolha de loja e do POST de entrada. A lista `LOJAS_EQUIPE` continua
valendo. Nenhuma sessão é criada sem autenticação central.

HTTP é aceito exclusivamente para loopback fora de produção. Os callbacks não
aceitam credenciais na URL, query, fragmento ou domínio diferente da plataforma.
Sem configuração completa, a tela local explica a etapa pendente e evita o
redirecionamento legado para HTTPS em localhost.

## Estado da verificação

Testes de configuração, integridade do fluxo e identidade foram preparados em
`src/lib/oidc.test.ts`. A política do projeto mantém suites e builds na CI;
esta continuação foi solicitada somente local, sem operações Git.

Na inspeção remota, não existia um cliente de desenvolvimento do Lojas. O
cadastro administrativo e o login interativo com uma conta autorizada ainda
estão pendentes. A implementação local não comprova um login concluído.

## Servidor local

O supervisor local está em `.work/lojas-dev-supervisor.ps1`. Ele inicia o Next
com Webpack e limite de heap de 2048 MB e tenta reiniciar após encerramento.
O PID fica em `.work/lojas-dev-supervisor.pid`; os logs ficam na pasta temporária
do usuário (`lojas-dev-supervisor.log` e `lojas-dev-supervisionado*.log`).
