# Template de farmácia (segmento `farmacia`)

## Por que este segmento existe

Uma farmácia não é uma loja de cosméticos que por acaso vende dipirona. Três
coisas a tornam diferente, e nenhuma delas é visual:

1. **A tarja decide o que a loja pode fazer.** Medicamento sob controle
   especial (Portaria SVS/MS 344/98) não pode ser vendido pela internet —
   RDC 44/2009, art. 62. Uma loja que exibe "comprar" ao lado de um clonazepam
   não tem um defeito de vitrine: está cometendo infração sanitária. Por isso a
   regra mora no dado (`Produto.tarja`) e não no bom senso de quem cadastra.
2. **Quem compra procura pela substância.** O que está escrito na receita tanto
   pode ser a marca ("Novalgina") quanto a molécula ("dipirona monoidratada"), e
   o genérico do mesmo princípio, na mesma dose, é intercambiável por lei
   (Lei 9.787/99). Mostrar os equivalentes lado a lado é o direito do comprador
   de pagar menos pelo mesmo tratamento — é o análogo exato da compatibilidade
   de motopeças ("o que serve no lugar deste").
3. **Farmácia virtual precisa se identificar.** Farmacêutico responsável, CRF e
   licença sanitária visíveis são exigência da RDC 44/2009, art. 55.

O que varia entre lojas continua sendo *dado*, nunca *código*: nenhuma condição
por loja foi acrescentada em lugar nenhum.

## O que liga o quê

| Ligado por | O que acontece |
|---|---|
| `Tenant.segmento = "farmacia"` | rodapé com responsável técnico e aviso legal; consulta de equivalentes na página do produto; campos do medicamento no painel |
| `Tenant.tema.layout = "farmacia"` | home que abre pela busca e pelos atalhos de necessidade |
| `Produto.tarja` | selo no card, aviso na página e — em controle especial — remoção do carrinho |

Os dois são independentes de propósito: uma drogaria pode preferir o layout
Mercado e continuar com toda a regra farmacêutica valendo.

## Estado persistido

Migration: `prisma/migrations/20260917100000_farmacia`.

Em `Produto`:

- `tarja`: `nenhuma` (padrão) | `livre` | `vermelha` | `vermelha-retencao` | `preta`;
- `principioAtivo`: a substância como está na caixa;
- `apresentacao`: dose e quantidade ("500 mg · 20 comprimidos");
- `registroAnvisa`: 13 dígitos, guardado sem máscara;
- `tipoMedicamento`: `referencia` | `generico` | `similar` | `novo` | `fitoterapico` | `manipulado`.

O padrão `nenhuma` é o correto para todo o catálogo que já existe e para a maior
parte do de uma drogaria: fralda, shampoo e dermocosmético não são medicamento e
não restringem nada.

Em `Tenant`: `farmaceuticoResponsavel`, `farmaceuticoCrf`, `licencaSanitaria`,
`autorizacaoAnvisa`.

A mesma migration acrescenta `principioAtivo` e `apresentacao` ao gatilho
`produto_texto_de_busca`, então a busca que já existia passa a achar por
substância sem nenhuma consulta nova. O índice
`Produto_tenantId_principioAtivo_idx` atende a busca por equivalentes.

## A regra que não pode quebrar

```
tarja                 receita   retenção   vende pela internet
nenhuma                 não       não            sim
livre (MIP)             não       não            sim
vermelha                sim       não            sim
vermelha-retencao       sim       sim            NÃO
preta                   sim       sim            NÃO
```

Em `vermelha-retencao` e `preta` a vitrine **continua mostrando** o produto, com
preço e informações: quem procura precisa achar e saber que a loja tem. O que
sai é o caminho de compra — e sai também o "pedir pelo WhatsApp", porque o que a
norma veda é a venda a distância, e o pedido por mensagem seria a mesma infração
por outro meio. No lugar fica o aviso de dispensação presencial, e o dado
estruturado da oferta passa a declarar `InStoreOnly`.

`src/lib/farmacia.test.ts` trava isso. Se aquele teste começar a falhar, a loja
está cometendo infração sanitária, não exibindo um botão a mais.

## Equivalentes

`equivalentesDoProduto` (em `src/lib/catalogo.ts`) busca por igualdade
insensível a caixa — que o índice atende — e refina em memória com
`equivalentes` de `src/lib/farmacia.ts`, que colapsa as grafias que os ERPs de
fato entregam ("Dipirona Monoidratada", "dipirona mono-hidratada") e compara a
apresentação. Exige mesma substância **e** mesma dose; sem apresentação
cadastrada dos dois lados o item entra assim mesmo e a tela mostra a
apresentação de cada um para o comprador conferir.

Dose em unidades diferentes (1 g e 1000 mg) **não** é colapsada de propósito:
converter unidade aqui seria adivinhar, e na dúvida é melhor faltar um
equivalente do que sugerir a dose errada.

A tela nunca manda trocar: quem troca é o farmacêutico, e o texto diz isso.

## Conformidade coberta

- **RDC 44/2009, art. 55** — responsável técnico, CRF, licença sanitária e AFE
  no rodapé de toda página (`src/components/Footer.tsx`). Sem os dados
  cadastrados o rodapé não inventa um nome: fica só o aviso legal.
- **RDC 44/2009, art. 62** — venda remota de controlado bloqueada.
- **Lei 9.294/96 e RDC 96/2008** — aviso de medicamento em caixa alta no rodapé
  da loja de farmácia (`AVISO_MEDICAMENTO`).
- **Lei 9.787/99** — o similar aparece rotulado pelo que é; só o genérico é
  tratado como intercambiável.

O Decreto 7.962/2013 (razão social, CNPJ e endereço) já era atendido pelo rodapé
para todas as lojas — ver `docs/CONFORMIDADE.md`.

## Onde mexer

| Arquivo | O quê |
|---|---|
| `src/lib/farmacia.ts` | as regras, puras: tarja, equivalência, pendências de cadastro |
| `src/components/home/Farmacia.tsx` | a home do segmento |
| `src/components/Medicamento.tsx` | o bloco da página do produto |
| `src/components/painel/EditarProduto.tsx` | os campos, visíveis só no ramo farmácia |
| `src/components/painel/Marca.tsx` | ramo da loja e responsável técnico |

## O que ainda não está aqui

- **Preço máximo ao consumidor (PMC/CMED).** Medicamento tem teto de preço por
  UF publicado pela CMED. Hoje o lojista digita o preço; a loja não confere
  contra a tabela. É o próximo passo natural — e exige a tabela atualizada como
  dado, não como código.
- **Upload da receita no checkout.** Tarja vermelha comum é vendável a distância
  com a receita exigida na entrega; hoje o aviso está na página, mas o checkout
  não coleta a imagem.
- **SNGPC.** Escrituração de controlados não entra enquanto a venda remota deles
  for proibida — o que o sistema precisa fazer é justamente não vendê-los.
- **Semente de categorias.** `CATEGORIAS_FARMACIA` existe e é usada como
  sugestão; ainda não é aplicada automaticamente ao criar a loja.
