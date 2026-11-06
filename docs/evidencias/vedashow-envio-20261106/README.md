# VedaShow: ausência de shippingDetails, 06/11/2026

## Resultado comprovado

A ausência permanece no HTML público: 12 de 12 páginas amostradas responderam HTTP 200 e emitiram Product/Offer sem shippingDetails. O arquivo http-jsonld.json contém URLs, SKUs e ofertas extraídas, sem credenciais. Não é resultado do Rich Results Test nem aprovação do Google.

Sitemap público: 4.843 URLs de produto. Consulta somente leitura ao catálogo: 2.433 produtos ativos com preço positivo e imagens cadastradas; urls-candidatas.txt lista esse universo potencial. Não confundir candidatos derivados do banco com páginas verificadas por HTTP, nem com a lista privada de URLs afetadas no Search Console. A amostra contém itens com e sem estoque. O feed público `/feed/merchant.xml` respondeu com 2.432 itens e nenhum bloco `g:shipping`; a contagem é do feed, não do total de páginas nem do relatório privado Google.

Imagem do container consultada: sha256:d5ac618587edef0d75dcb83b4013d7a97073fc50067bcda0a5ccee8e88e3a9ad; label de revisão 7dd4eb7a57c282fd65e0a9a8eff3364d880927c6. A produção já avançou além da PR #216 (3b0f448). O HTML servido, e não apenas essa revisão, foi inspecionado.

Amostra adicional sequencial do sitemap: {'checked': 54, 'products': 44, 'missingShipping': 44, 'errors': 0}. Evidência em http-amostra-sitemap.json. A varredura foi limitada para não impor milhares de renderizações à produção; não é auditoria HTTP exaustiva do catálogo.

## Regras reais observadas

Tenant vedashow: cepOrigem 14085000; tabelaFrete []; entregaLocal []; freteGratisAcima null; despachoDiasUteis 0; melhorEnvioConectadoEm null; politicas {}; googleMerchantId null. Nenhum campo sensível foi coletado no relatório.

A política pública https://vedashow.com.br/politicas/envio informa despacho no mesmo dia para pagamentos durante o expediente útil, próximo útil fora dele, trânsito conforme transportadora/CEP e ausência de retirada no balcão.

src/lib/frete.ts cota transportadora por CEP, peso, caixa e valor declarado. Sem Melhor Envio conectado, usa CepCerto; fallback é a tabela cadastrada. Sem tabela/opções, não há promessa universal de entrega. src/lib/envio-declarado.ts não gera shippingDetails sem promoção garantida. A página aplica essa função às ofertas; o feed usa freteGratisGarantido. A PR #216 preservou esse comportamento.

## Decisão

Não há preço, prazo de trânsito ou cobertura fixa comprovada para inserir no JSON-LD. Manter a omissão é preferível a declarar frete grátis ou cotação pontual como regra geral. Não se adicionou shippingDetails vazio, transitTime fictício ou região presumida.

A documentação Google classifica shippingDetails como recomendado e permite políticas em Merchant Center/Search Console. Logo, a ausência isolada é um aviso de enriquecimento, não prova de inelegibilidade total. Uma validação de correção pode continuar falhando enquanto o campo permanece ausente. Configuração externa pode fornecer dados de entrega ao Google sem necessariamente eliminar o aviso sobre a propriedade no HTML.

O próximo passo operacional é inspecionar a conta verificada da VedaShow em Merchant Center > Envio e devoluções (ou Search Console > Compras > Envio e devoluções), comparar regras existentes às cotações e completar somente tarifas, zonas, pesos e prazos documentados. Não basta replicar uma cotação para um CEP. No Brasil, não presumir suporte ao cálculo automático de tarifas de transportadora do Merchant: a documentação limita essa opção a outros países e disponibiliza configuração por destino/tabelas.

O ID ausente no tenant não comprova ausência de conta/políticas no Google. Não houve acesso autenticado ao painel privado do Merchant Center nem à lista privada desse aviso; portanto nenhuma política externa foi declarada ausente ou alterada. Também não foi reiniciada a validação do Search Console.

## Alteração e validação

Somente testes de regressão, evidência e orientação operacional. Nenhuma mudança funcional comprovada se justifica para essa configuração. Testes asseguram que origem e despacho não inventam frete grátis e que tabela paga não passa a declarar gratuidade. PR deve permanecer em rascunho: o repositório tem merge/deploy automáticos para PR pronta. Sem merge/deploy autorizado.

Resultado local: 12/12 testes focados passaram. Lint foi bloqueado por dependência ESLint quebrada (`Cannot find module ./utils/lazy-loading-rule-map`) no ambiente preexistente. A tentativa de instalação limpa foi interrompida por custo de recursos do servidor; Typecheck com as dependências reaproveitadas falhou fora dos arquivos alterados, incluindo `TS2305` em `tests/integration/pix-manual.test.ts` (exports `crc16Pix` e `valorPixEmReais` ausentes). Não foi atribuída regressão a esses erros; lint/typecheck não estão certificados nesta entrega. Conferir a CI da PR antes de qualquer aprovação.

Comandos: `tsx --test src/lib/envio-declarado.test.ts src/lib/merchant-schema.test.ts`; `eslint src/lib/envio-declarado.test.ts`; `npm run typecheck`.

## Fontes oficiais consultadas

- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing#shipping-details
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing#shipping-and-return-settings-in-merchant-center
- https://support.google.com/merchants/answer/12577710
- https://support.google.com/webmasters/answer/14907594
