# Frete: Melhor Envio da loja ou CepCerto da plataforma

**Escopo atual (27/10/2026): somente sandbox.** O ambiente padrão mudou para
`https://sandbox.melhorenvio.com.br`, com autorização explícita das lojas de
teste. As credenciais do aplicativo de sandbox ainda precisam ser cadastradas;
nenhuma cotação real no provedor foi comprovada nesta etapa. Siga o
[roteiro de sandbox e demonstração](MELHOR-ENVIO-SANDBOX.md). O diagnóstico e os
comandos operacionais de outubro abaixo são históricos, não uma autorização
para executar código ou builds diretamente em `applications`.

A transportadora é cotada por uma de duas contas (`cotarTransportadora` em
`src/lib/frete.ts`):

- a loja que conectou o **Melhor Envio** em `/painel/configuracoes/entrega`
  cota no contrato dela;
- a que não conectou cota pela **CepCerto**, na conta da plataforma, com o CEP
  de origem dela.

Uma loja nunca mistura as duas: quem conectou o Melhor Envio não cai na
CepCerto quando ele falha. A etiqueta ainda sai pela CepCerto e fica travada
para a loja que conectou o Melhor Envio (`src/lib/postagem.ts`).

## CepCerto (conta da plataforma)

Produto, carrinho e checkout usam o mesmo adaptador do servidor. O navegador
envia CEP e IDs/quantidades para `POST /api/frete`; o servidor resolve a loja,
os preços, o peso e a caixa pelo catálogo antes de consultar a CepCerto.

A cotação usa exclusivamente `CEPCERTO_CONSULTA_KEY`, o **Token de consulta**
do módulo Integração. A chamada é `GET /ws/json-frete/{origem}/{destino}/`
`{peso_gramas}/{altura}/{largura}/{comprimento}/{token}` em
`https://cepcerto.com`. A chave pública e o token de postagem não habilitam
essa consulta. Nunca enviar o token ao navegador ou registrar a URL completa.

A API de consumo retorna PAC e SEDEX. O adaptador oferece apenas os preços
`valorpac_desconto_cepcerto` e `valorsedex_desconto_cepcerto`, com prazo válido,
mantendo os nomes que a emissão de etiqueta reconhece. Preço de balcão e Mini
Envios não entram na oferta. A API básica não recebe valor declarado:
esta cotação não confirma seguro adicional sobre o valor dos produtos.

Configure o token no ambiente que executa a aplicação e reinicie o processo.
O `.env` local não configura produção. Para usar
`deploy/sincronizar-apps-do-n8n.sh cepcerto`, a credencial n8n deve conter
`json.body.consumption_key` com o token de consulta. O roteiro recusa a chave
antiga do widget, consulta PAC/SEDEX e só grava o token após obter cotação.

É necessário um ciclo/plano de consumo ativo. Em erro HTTP, resposta inválida
ou ausência de preço/prazo, o fluxo mantém as alternativas cadastradas:
tabela por UF, entrega local e retirada. Sem token, a API não é chamada.
Não há tentativa com outra credencial. A loja conectada ao Melhor Envio
continua usando o contrato dela.

A emissão de etiquetas continua usando `CEPCERTO_POSTAGEM_KEY`, saldo da
carteira e as regras existentes de pedido pago. Configurar o token de consulta
não comprova emissão, saldo suficiente ou liberação da conta.

**Evidência histórica:** a verificação local anterior à mudança retornou HTTP
422, “Cliente sem ciclo transacional ativo para consumo de API”. A liberação
solicitada ao suporte e a cotação real precisam de verificação própria.
Documentação oficial: <https://cepcerto.com/integracao>.

## Melhor Envio (conta de cada loja)

O que precisa existir uma vez (é da plataforma, não da loja): um aplicativo no
Melhor Envio (Integrações, Área Dev, Aplicativos), na conta
da Ávila Ops.

1. **URL de retorno:** `https://lojas.avilaops.com/melhor-envio/callback`.
2. **Permissões:** `shipping-calculate` e `users-read`. Nada de compra de
   etiqueta.
3. No `.env` do servidor: `MELHOR_ENVIO_CLIENT_ID` e
   `MELHOR_ENVIO_CLIENT_SECRET`. Sem os dois o botão de conectar não aparece.

Os dois saem da credencial do n8n **"Melhor Envio Lojas Avila Ops (client id e
secret)"** (`httpCustomAuth`, corpo com `client_id` e `client_secret`). Colar lá
e rodar no servidor `applications`:

```bash
/opt/lojas/sincronizar-apps-do-n8n.sh melhor-envio
```

O roteiro (`deploy/sincronizar-apps-do-n8n.sh`) grava o `.env` e recria o
container. O Melhor Envio não confere aplicativo sem a conta de quem conecta: a
prova é o botão no painel e a cotação de teste da própria loja.

## Quando nenhuma das duas cota

A loja oferece só o que cadastrou em Entrega: tabela de frete por estado,
entrega local por faixa de CEP e retirada com endereço público. **CEP de origem
sozinho não cota nada.** Foi o que aconteceu de 06/10 a 13/10/2026, com a
CepCerto retirada e o aplicativo do Melhor Envio sem configurar: a Vedashow não
devolvia forma de entrega nenhuma e a Brilhax só a retirada.

Para a loja nessa situação:

- o checklist do painel deixa o passo Entrega pendente e diz a consequência
  (`src/lib/checklist-onboarding.ts`);
- o checkout avisa que não há entrega para o CEP e oferece o WhatsApp da loja;
- a operação recebe o alerta `frete.sem-opcao`, um por loja por dia
  (`docs/ISOLAMENTO-OPERACIONAL.md`).
