# Integração corporativa com o Auth

Provisionamento: `avila.corporativo.v2`. Consulta de contexto: `avila.corporativo.v1`.

O Auth é a fonte de contas, organizações autorizadas, papéis e alçadas. O Lojas é a fonte do cadastro comercial. Uma projeção local de contexto serve somente para diagnóstico; cada operação protegida deve consultar o contexto atual no Auth.

## Referências externas

- Organização: `lojas:<tenantId>:empresa:<empresaId>`.
- Unidade: `lojas:<tenantId>:unidade:<unidadeId>`.

Os IDs locais tornam as referências únicas dentro do único `client_id` usado pelo Lojas.

## Provisionamento

Antes deste endpoint, a conta deve existir em `POST /api/provisionamento/acessos`.

```http
POST /api/provisionamento/corporativo
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/json
```

```json
{
  "versao": "avila.corporativo.v2",
  "intencaoVersao": 7,
  "organizacaoVersao": 11,
  "email": "compras@industria.example",
  "organizacao": {
    "referencia": "lojas:tenant-1:empresa:empresa-1",
    "nome": "Indústria Aurora"
  },
  "unidades": [
    {
      "referencia": "lojas:tenant-1:unidade:unidade-1",
      "nome": "Matriz"
    }
  ],
  "autorizacoes": [
    {
      "papel": "COMPRADOR",
      "referenciaUnidade": null,
      "limiteAprovacaoCentavos": null
    }
  ],
  "convidadoPor": "dono@industria.example"
}
```

O POST substitui o conjunto completo de autorizações daquele e-mail na organização. O Lojas persiste uma intenção versionada antes de chamar o Auth, portanto retry envia a fotografia inteira e nunca um delta incompleto.

Resposta de sucesso estável:

```json
{
  "contrato": "avila.corporativo.v2",
  "organizacaoId": "uuid",
  "vinculoId": "uuid",
  "versao": 1,
  "intencaoVersaoAplicada": 7,
  "organizacaoVersaoAplicada": 11
}
```

`organizacaoId` e `vinculoId` são persistidos no Lojas. O Auth confirma
`intencaoVersaoAplicada` e `organizacaoVersaoAplicada`; uma resposta de outra
versão é rejeitada. IDs de
unidades não vêm no POST; são reconciliados pela consulta de contexto.

## Contexto atual

```http
GET /api/corporativo/contextos
Authorization: Bearer ACCESS_TOKEN
```

O token precisa do escopo `corporate_context`. O parser do Lojas exige o mesmo contrato, a referência exata da organização e somente referências de unidades cadastradas no tenant atual. Papel desconhecido, alçada inválida ou unidade divergente fecha o acesso.

O login atual do Lojas ainda usa a sessão compartilhada `/api/session?app=` e não possui access token OIDC. A ativação operacional deste endpoint depende de Authorization Code + PKCE, callback com `state` e `nonce`, tokens cifrados no servidor, vínculo do `sub`, refresh e reautenticação.

## Suspensão e revogação

```http
DELETE /api/provisionamento/corporativo?email=EMAIL&organizacao=REFERENCIA&situacao=SUSPENSO&contrato=avila.corporativo.v2&intencaoVersao=8
Authorization: Basic base64(client_id:client_secret)
```

`situacao` aceita `SUSPENSO` ou `REVOGADO`. O Auth também confirma
`intencaoVersaoAplicada`. O Lojas mantém o cadastro comercial e registra a
transição; o Auth deixa de devolver o vínculo imediatamente.

## Papéis

`ADMINISTRADOR`, `COMPRADOR`, `APROVADOR`, `FINANCEIRO` e `VENDEDOR`. `referenciaUnidade: null` vale para toda a organização. A alçada é um inteiro não negativo em centavos ou `null` quando não configurada.

Segredos, access tokens e refresh tokens não entram em auditoria ou payload de CRM.
