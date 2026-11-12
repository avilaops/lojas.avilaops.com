# Melhor Envio: sandbox e demonstração da integração

## Escopo autorizado

Esta etapa atende conexão OAuth e cotação de fretes em sandbox. A implementação
agora também contém o ciclo operacional explícito de uma postagem — carrinho,
compra, geração, impressão, consulta de rastreio e webhook assinado — mas não
habilita produção no Melhor Envio nem executa compra de etiqueta sozinha. A
hospedagem do Lojas pode continuar
no domínio público habitual; o ambiente da API de frete é sandbox.

As credenciais do aplicativo e a autorização da conta são requisitos distintos.
O proprietário confirmou em 27/10/2026 que ainda precisa cadastrar ou preencher
o aplicativo. Não há prova de conexão nem de cotação autenticada no sandbox.

## Preparar o aplicativo e a loja de teste

1. Criar a conta de testes no [sandbox do Melhor Envio](https://sandbox.melhorenvio.com.br/).
2. Cadastrar o aplicativo na [Área Dev do sandbox](https://app-sandbox.melhorenvio.com.br/integracoes/area-dev).
3. Usar nome alusivo ao Ávila Lojas, contatos válidos e descrição fiel:
   conexão de conta e consulta de preços/prazos; sem compra de etiquetas.
4. Cadastrar exatamente o callback
   `https://lojas.avilaops.com/melhor-envio/callback`.
5. Solicitar `cart-write`, `shipping-calculate`, `shipping-checkout`, `shipping-generate`,
   `shipping-print`, `shipping-cancel`, `shipping-tracking` e `users-read`.
6. Preencher `client_id` e `client_secret` na credencial privada do n8n
   **Lojas - Melhor Envio**, tipo `httpCustomAuth`. Nunca enviar esses valores
   no chat, commit, gravação ou apresentação. A existência da credencial não
   prova que ela tenha valores válidos.
7. Definir uma loja de teste com acesso administrativo próprio, CEP de origem e
   produtos sintéticos com peso, dimensões e preço. Não usar dados de clientes.
8. Pela configuração privada e fluxo de implantação aprovado, disponibilizar:

   ```dotenv
   MELHOR_ENVIO_URL=https://sandbox.melhorenvio.com.br
   MELHOR_ENVIO_CLIENT_ID=VALOR_PRIVADO_DO_APLICATIVO_SANDBOX
   MELHOR_ENVIO_CLIENT_SECRET=VALOR_PRIVADO_DO_APLICATIVO_SANDBOX
   ```

Os textos em maiúsculas acima são instruções, não credenciais funcionais.
Habilitar somente na loja de teste o recurso `frete_melhor_envio_sandbox` em
`Tenant.recursos`, preservando os demais recursos existentes. Ele nasce desligado
para todas as lojas e respeita `LOJAS_RECURSOS_DESLIGADOS`, a trava global do
projeto. A liberação permanece um dado da loja no banco, não uma lista de slugs
em variável de ambiente.
Não reutilizar credenciais ou tokens de produção no sandbox. Não compilar nem
executar scripts de configuração ad hoc em `applications`: build e entrega
seguem o GitHub CI. Até a configuração privada ser concluída, a publicação do
código não constitui ativação do provedor.

## Demonstração reproduzível

### Configurar a liberação pela API administrativa

O incremento do PR #237 corrige o PATCH que descartava `recursos` apesar de
responder 200. O procedimento abaixo depende da publicação dessa versão;
aprovação de CI e PR em rascunho não comprovam implantação. A liberação já
conferida da `demo` permanece um registro operacional separado da correção.

Somente o chamador administrativo, autenticado com o Bearer de
`LOJAS_ADMIN_TOKEN`, pode alterar essa configuração. O formulário do lojista e
o contrato de criação de loja não recebem permissão para conceder recursos.

1. Consultar `GET /api/admin/tenants/demo` e revisar a lista `recursos` atual.
2. Enviar `PATCH /api/admin/tenants/demo` com a **lista completa desejada**.
   Este exemplo corresponde aos recursos previamente conferidos na demo:

   ```json
   {
     "recursos": [
       "recebimento_v2",
       "pagamentos_pix_manual",
       "frete_melhor_envio_sandbox"
     ]
   }
   ```

3. Repetir o GET e conferir os recursos persistidos. Omitir o campo preserva
   a configuração, inclusive códigos legados; `{"recursos":[]}` revoga todos.
   Para revogar somente o sandbox, enviar a lista completa sem esse código.

Os códigos aceitos são os de `src/lib/recursos.ts`. Nome desconhecido,
duplicado, `null`, tipo incorreto ou lista maior que o catálogo retornam 422
sem salvar os demais campos da requisição. Um código legado precisa ser
retirado explicitamente de uma substituição; não se deve reenviar a lista
antiga de forma automática. Alterações simultâneas seguem a semântica de
substituição: prevalece a última escrita válida, portanto coordenar a edição
e conferir a leitura posterior.

O slug da URL determina a loja e o bloqueio global
`LOJAS_RECURSOS_DESLIGADOS` continua prevalecendo sobre o dado salvo. Habilitar
o recurso não cria token OAuth nem comprova cotação autenticada. Não registrar
o Bearer administrativo ou os segredos retornados por outras ferramentas.

### Conectar a conta e testar cotações

1. Entrar no painel da loja de teste e abrir **Configurações → Entrega**.
2. Conferir o aviso **Sandbox**. A loja deve ter o recurso de teste habilitado.
3. Usar **Conectar Melhor Envio**, conferir o domínio sandbox na autorização,
   autorizar a conta de teste e retornar ao painel.
4. Usar **Testar cotação**. Esse teste consulta o trecho entre o CEP da loja e
   `01310100`, com o peso/caixa de prova; não compra frete.
5. Abrir a vitrine da loja de teste, adicionar os produtos sintéticos ao
   carrinho e cotar destinos controlados. Conferir no provedor os mesmos CEPs,
   peso em kg, medidas em cm, valor em reais, serviços, preços e prazos customizados.
6. Demonstrar que serviço com erro, preço inválido ou prazo ausente não é
   oferecido como entrega válida. Em indisponibilidade, a loja mantém somente
   as alternativas próprias cadastradas; não muda para contrato CepCerto.
7. Demonstrar recusa e retorno incompleto do OAuth, acesso anônimo negado,
   operador sem permissão impedido e loja fora da lista de sandbox bloqueada.
8. Desconectar a conta de teste e conferir a remoção da conexão no painel.

Registrar data, commit, ambiente, slug da loja, origem/destino, SKU sintético,
peso/medidas, status HTTP, opções efetivamente retornadas e resultado esperado
versus observado. Ocultar endereços pessoais, cookies, tokens, secret, codes e
parâmetros de state nas capturas e vídeos. Não chamar testes com respostas
simuladas de prova de acesso ao Melhor Envio.

## Contrato implementado

- `POST /api/v2/me/shipment/calculate`, Bearer token e User-Agent da plataforma.
- Caixa calculada pelo Lojas enviada em `volumes`, com `insurance` em reais.
- `custom_price` e `custom_delivery_time` têm precedência; a faixa publicada
  pode fornecer o prazo máximo. Sem prazo válido o serviço é descartado.
- Respostas OAuth exigem HTTP de sucesso, tokens em texto não vazio e validade
  válida antes da gravação cifrada. O retorno confere sessão e tenant.
- Requisições autenticadas não usam cache nem seguem redirecionamentos.
- Somente os domínios oficiais de produção e sandbox são aceitos na configuração;
  o padrão é sandbox. Produção requer configuração explícita e etapa posterior.
- O painel mostra a conexão separada do resultado do teste de cotação.
- O pedido persiste o `freteId` escolhido, e a postagem persiste o provedor, o
  ID da etiqueta, protocolo, status externo e URL de rastreio.
- `POST /api/painel/pedidos/{id}/etiqueta` insere o envio no carrinho. Essa
  chamada não paga a etiqueta.
- `POST /api/painel/pedidos/{id}/etiqueta/operacao` recebe uma ação explícita:
  `comprar`, `gerar`, `imprimir`, `cancelar` ou `rastrear`. Todas as consultas
  usam a sessão e o tenant do painel.
- `POST /api/webhooks/melhor-envio` valida `X-ME-Signature` com HMAC-SHA256,
  deduz a postagem pelo ID do provedor e atualiza o status/rastreio do pedido.
  Evento repetido é seguro porque a escrita converge para o mesmo registro.

Há uma inconsistência na referência publicada: o texto demonstra `volumes` com
`height`/`length`, mas o schema contém `heigth`/`lenght` e ainda marca `products`
como obrigatório. A implementação segue o exemplo textual de volumes, com
regressões locais; a aceitação pelo sandbox continua pendente das credenciais.
Não declaramos esse contrato homologado sem a chamada autenticada.

## Verificação formal pelo Melhor Envio

As páginas oficiais distinguem desenvolvimento em sandbox e solicitação formal:
depois dos testes, a solicitação de verificação ocorre com aplicativo de
produção. Isso não autoriza esta entrega a trocar de ambiente. A passagem para
produção será uma decisão posterior do proprietário.

Para preparar a apresentação, reunir nome/ID do aplicativo, descrição fiel das
funções existentes, manual de ativação e acesso dedicado à loja de testes,
conforme o processo indicado pelo Melhor Envio. Não enviar mensagem nem
solicitação de verificação automaticamente.

Fontes consultadas em 27/10/2026:

- [Sandbox](https://docs.melhorenvio.com.br/docs/sandbox).
- [Autenticação](https://docs.melhorenvio.com.br/docs/autenticacao).
- [Cálculo de fretes](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos).
- [Fluxo de autorização](https://docs.melhorenvio.com.br/reference/fluxo-de-autorização).
- [Verificação](https://docs.melhorenvio.com.br/docs/verificacao).
- [Solicitar verificação](https://docs.melhorenvio.com.br/docs/1-solicitar-verificacao).
- [Validações realizadas](https://docs.melhorenvio.com.br/docs/3-realizacao-de-testes).
