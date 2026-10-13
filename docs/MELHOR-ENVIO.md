# Frete: conta do Melhor Envio conectada por loja

Desde 06/10/2026 a transportadora é cotada pela conta do Melhor Envio que o
lojista conecta em `/painel/configuracoes/entrega`, no contrato dele. A CepCerto
deixou de cotar (a conta ficou sem plano); a etiqueta ainda sai por ela e fica
travada para a loja que conectou o Melhor Envio (`src/lib/postagem.ts`).

## O que precisa existir uma vez (é da plataforma, não da loja)

Um aplicativo no Melhor Envio (Integrações, Área Dev, Aplicativos), na conta
da Ávila Ops:

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

## O que a loja sem Melhor Envio oferece

Só o que ela cadastrou em Entrega: tabela de frete por estado, entrega local
por faixa de CEP e retirada com endereço público. **CEP de origem sozinho não
cota nada.** Em 13/10/2026 o aplicativo ainda não estava em produção e nenhuma
loja tinha conta conectada: a Vedashow não devolvia forma de entrega nenhuma e
a Brilhax só a retirada.

Para a loja nessa situação:

- o checklist do painel deixa o passo Entrega pendente e diz a consequência
  (`src/lib/checklist-onboarding.ts`);
- o checkout avisa que não há entrega para o CEP e oferece o WhatsApp da loja;
- a operação recebe o alerta `frete.sem-opcao`, um por loja por dia
  (`docs/ISOLAMENTO-OPERACIONAL.md`).
