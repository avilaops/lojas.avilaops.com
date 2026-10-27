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

A cotação usa a porta do "Frete no seu site" (`widget_frete/api/cotacao`), com
a chave pública da conta (`src/lib/cepcerto.ts` explica por que não as outras
duas portas). Consome o plano de consultas da conta.

1. **Chave:** `CEPCERTO_PUBLIC_KEY` no `.env`, vinda da credencial do n8n
   "CepCerto Lojas Avila Ops (chave pública do cotador de frete)":

   ```bash
   /opt/lojas/sincronizar-apps-do-n8n.sh cepcerto
   ```

   O roteiro termina com uma cotação de prova de dentro do container.
2. **IP autorizado:** no painel da CepCerto, Frete no seu site, Personalizar,
   Domínios e IPs, o IP de saída do servidor `applications` (`178.105.82.48` em
   13/10/2026). Sem isso a resposta é 401 "Chave pública, domínio ou IP não
   autorizado" e a loja fica só com tabela, entrega local e retirada.

O roteiro só grava a chave depois de uma cotação de prova passar: com a chave
no `.env` o painel dá a Entrega como pronta para toda loja com CEP de origem.

**Estado em 13/10/2026:** IP autorizado e chave aceita (`api/acesso` responde
com a conta), mas toda cotação devolve 500 "Não foi possível calcular o frete",
pela chave pública e pelo token de postagem; a chave de consumo responde
"Cliente sem ciclo transacional ativo para consumo de API". O cotador público
do site deles calcula normalmente, então a falha é da conta, não do cálculo.
A chave **não** está em produção. O formato da resposta em `cepcerto.ts` saiu
do script do widget e ainda não foi conferido com uma cotação real.

Ficam de fora o preço de balcão dos Correios (é a tabela cheia do mesmo
serviço) e o Mini Envios (a CepCerto cota e não posta). A emissão de etiqueta
usa o token de postagem e o saldo da carteira da CepCerto, que estava em
R$ 0,00 em 13/10/2026: sem saldo a loja despacha por fora e cola o rastreio.

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
