# Configuração de analytics • Lojas • Plano operacional

> Execução autorizada pelo proprietário após a auditoria de 14/11/2026.
> Procedimento de execução • superpowers:executing-plans, uma etapa por vez.

**Objetivo:** completar GTM, GA4 e Google Tag Gateway das lojas ativas e da
plataforma, preparar Vinhos Imperial e eliminar a duplicação da Brilhax.

**Arquitetura:** reutilizar Next.js/TypeScript, os campos de pixels por Tenant
e PLATAFORMA_GTM_ID, o consentimento nativo e contêineres/propriedades separados.
O Gateway da zona avilaops.com continua com o contêiner geral da Ávila;
gatilhos por hostname isolam seus disparos das lojas e da plataforma.

**Fontes:** API administrativa de produção, GTM/GA4 APIs, Cloudflare API e
auditoria em outputs/lojas-analytics-20261114 no workspace compartilhado.

## Restrições

- Preservar propriedades, streams, contêineres, histórico e configuração alheia.
- Criar recursos ausentes somente após inventário atual de toda a conta.
- Consentimento padrão denied e atualização nativa após escolha do visitante.
- Um page_view por carregamento e por mudança real de rota.
- Usar uma única fonte para pageviews, inclusive navegação SPA.
- A fonte de pageviews será a tag Google com medição aprimorada de mudanças
  de histórico habilitada. Tags page_view explícitas serão pausadas; os demais
  eventos de catálogo e contato serão preservados.
- Não alterar status, cobrança, pedidos, preços ou estoque.
- Não ativar lojas canceladas nem promover Vinhos Imperial para ATIVA.
- Não publicar alterações concorrentes existentes em workspaces de terceiros.
- Guardar snapshots e IDs de versões para reversão; nunca registrar segredos.
- Mudança em código de aplicação, se necessária, passa por testes/build no CI.
- Verificações operacionais usam navegador isolado e endpoints de produção.
- O material oficial enviado pelo proprietário também orienta a validação de
  ecommerce: GTM como único caminho, currency/value/items no nível correto e
  purchase somente para PAGO, EM_SEPARACAO, ENVIADO ou ENTREGUE. Cotação,
  aprovação comercial, espera de pagamento, cancelamento e estorno não disparam.

## Etapas e aceite

- [ ] Inventariar recursos atuais e associar hostname, tenant, GTM e stream GA4.
- [ ] Reutilizar os quatro conjuntos existentes e criar recursos dos tenants
  sem medição própria na conta já administrada pelo proprietário.
- [ ] Preparar workspaces exclusivos, com tags GA4, eventos de catálogo e
  isolamento de hostname. Corrigir a duplicação de pageviews da Brilhax.
- [ ] Revisar versões candidatas e conflitos antes da publicação no GTM.
- [ ] Reproduzir na CI a classificação incorreta de cotação/estorno como compra,
  corrigir a regra da página do pedido e confirmar a regressão na CI.
- [ ] Aplicar os critérios adicionais enviados pelo proprietário: ratear o
  desconto em centavos nos itens, enviar price líquido e discount por unidade,
  propagar coupon e confirmar value como soma da receita dos itens. Preservar
  quantidades e preços comerciais. Checkout aceita no máximo 50 itens; o
  rateio pode dividir quantidades em dois grupos por SKU, até 100 entradas GA4.
- [ ] Enviar marca, variante e in_stock somente quando os dados existirem;
  registrar in_stock como dimensão ITEM sem ultrapassar o limite da propriedade.
- [ ] Atualizar apenas IDs de pixels nos tenants e o GTM da plataforma no Render.
- [ ] Configurar Gateways ausentes nos domínios Cloudflare acessíveis,
  preservando os caminhos existentes e hideOriginalIp.
- [ ] Confirmar uma chamada page_view por navegação, caminho de coleta no
  domínio, consentimento e correspondência entre hostname e measurementId.
- [ ] Verificar recebimento em GA4 Realtime quando o acesso permitir.
- [ ] Registrar separadamente a limitação de DNS da PK e qualquer loja ainda
  em provisionamento. Publicação configurada não equivale a navegação comprovada.
- [ ] Atualizar controle da equipe e evidências com resultados e limitações.

## Revisão

Conferir especialmente mistura de dados entre tenants, duas fontes de pageview,
contêiner incorreto herdado da zona, coleta antes do estado de consentimento e
afirmações de sucesso sobre domínio inacessível. O escopo autorizado permite
publicar as configurações após revisão e verificações correspondentes.
