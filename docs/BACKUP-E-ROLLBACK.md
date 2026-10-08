# Backup, migração e rollback do Lojas

Como a plataforma sai de uma versão para outra, o que protege o banco no
caminho e como voltar. O que fala do servidor foi conferido em produção em
08/10/2026; o que ainda não vale está marcado. O procedimento em si (dump,
migração, volta ao dump) tem um ensaio que qualquer um roda sem servidor:
`npm run banco:ensaio`, descrito em "Ensaio".

| Caminho de deploy | Quem migra | Quem reverte | Onde está o script |
|---|---|---|---|
| Pipeline (o normal) | `avila-deploy`, antes de trocar o container | `avila-deploy`, para a imagem anterior, se a saúde falhar | `.github/workflows/deploy-production.yml` aqui; `deploy-container.sh` no repositório `infra` |
| Pacote `standalone.tgz` (legado, parado) | o próprio script, antes de extrair a versão nova | o próprio script, para `app.anterior`, se saúde, CSS ou `/uploads` falharem | `deploy/deploy.sh` |

Nos dois, a migração que falha aborta antes da troca, e o rollback devolve o
código, nunca o schema.

## Quem faz o deploy

**Não é o `deploy/deploy.sh` deste repositório.** Ele é da época em que o
build subia como `standalone.tgz`; no servidor está parado desde 28/09/2026.

O deploy é do repositório `avilaops/infra`:

1. `Build e deploy` (`.github/workflows/deploy-production.yml`) constrói a
   imagem. Tipos, testes e build rodam dentro do `Dockerfile`.
2. O job `deploy` entra por SSH no servidor `applications` com uma chave presa
   a um comando: `avila-deploy lojas.avilaops.com <imagem>`.
3. `/usr/local/sbin/avila-deploy` (fonte: `deploy-container.sh`, na pasta
   `scripts` do `infra`) lê `/etc/avilaops/deploy/lojas.avilaops.com.conf` e faz o resto.

Só o run mais novo publica: o job confere se outro run do mesmo workflow
passou na frente antes de enviar a imagem. Sem isso, dois pushes seguidos
podiam terminar com a versão mais antiga em produção (aconteceu em 08/10/2026).

## O que o `avila-deploy` garante

| Passo | O que faz | Se falhar |
|---|---|---|
| Migração | `prisma migrate deploy` contra o banco, com o schema tirado da imagem nova, **antes** de trocar o container | o deploy para; o container atual segue no ar |
| Troca | sobe a imagem nova | segue para a saúde |
| Saúde | `GET /api/health` (banco incluído) | **rollback automático** para a imagem anterior |
| Fumaça | job `fumaca`: saúde, `/v1/health` e a folha de estilo seguida do HTML | o run fica vermelho; a versão nova continua no ar |

O rollback troca a imagem. **Ele não desfaz migração**: a tabela alterada
continua alterada. Por isso migração do Lojas só acrescenta (tabela, coluna
nula, índice), e o que remove coluna vai em deploy separado, depois de o
código que a usava ter saído. Dito de outro jeito: **toda migração precisa
funcionar com a versão anterior do código**. Apertar restrição (`NOT NULL`,
`UNIQUE`) e renomear coluna entram na mesma regra de remover.

### Migração que falhou no meio

O `migrate deploy` para e o deploy não troca a versão, mas a migração fica
marcada como falha em `_prisma_migrations` e a próxima tentativa recusa
continuar. Olhe o banco antes de escolher:

- **Nada da migração ficou aplicado** (o Postgres desfez a transação, que é o
  caso comum): `prisma migrate resolve --rolled-back <nome>`, corrija a causa e
  publique de novo. O deploy aplica a migração inteira.
- **Ficou aplicada pela metade e você terminou o resto à mão** (acontece com
  comando que não roda em transação, como `CREATE INDEX CONCURRENTLY`):
  `prisma migrate resolve --applied <nome>`. O deploy seguinte não tenta de
  novo.

Marcar `--applied` sem o schema estar de fato completo é o erro que não
aparece no deploy: aparece como 500 na tela que usa a coluna que não existe.

## Backup do banco

- **Diário, 3h30 UTC**: `/usr/local/bin/backup-todos-bancos.sh` grava
  `/opt/backups/db/host-lojas-<data>.sql.gz`. Cada dump só assume o nome final
  depois de conferido (gzip íntegro, com conteúdo, com o marcador de fim do
  `pg_dump`). Rotação às 3h40: fica o mais recente de cada família, os outros 7
  dias.
- **Antes de migração pendente**: `pre-migracao-lojas.avilaops.com-<data>-<hora>.sql.gz`,
  no mesmo diretório e com a mesma conferência. Só existe quando há o que
  migrar, e se o dump falhar o deploy para antes de tocar no banco.
  **Ainda não vale em produção**: está em `avilaops/infra#8`, e o `avila-deploy`
  instalado no servidor está atrás do repositório. Instalar é decisão do
  Nicolas, porque o script é o mesmo para dez aplicações.

Enquanto o dump pré-migração não está instalado, quem sobe migração que mexe em
dado existente faz o dump à mão antes (regra do `AGENTS.md`). Migração que só
cria tabela ou coluna nula não precisa: o dump do dia cobre.

O dump à mão, no servidor, com o endereço lido do `.env` como o
`deploy/deploy.sh` faz (o container fala com `host.docker.internal`; do host é
`127.0.0.1`):

```bash
cd /opt/lojas
DBURL=$(grep ^DATABASE_URL= .env | cut -d= -f2- | sed "s/host.docker.internal/127.0.0.1/")
pg_dump "$DBURL" | gzip > /opt/backups/db/manual-lojas-$(date +%Y%m%d-%H%M).sql.gz
gzip -t /opt/backups/db/manual-lojas-*.sql.gz && ls -la /opt/backups/db | grep manual-lojas
```

Código não é backup e não se copia no servidor: a versão antiga mora no GitHub
(`AGENTS.md`).

## Como conferir

```bash
ssh applications 'ls -la --time-style=long-iso /opt/backups/db | grep lojas | tail -5'
```

Tem de haver um `host-lojas-<hoje>` com alguns megabytes. Para saber qual foi a
última migração aplicada e quando:

```bash
ssh applications "sudo -u postgres psql -d lojas -At -c 'select migration_name, finished_at from _prisma_migrations order by started_at desc limit 3'"
```

## Como restaurar

O teste de restauração foi feito de verdade em 30/08/2026 (`docs/ROTINAS.md`,
"Backup e restauração"): o dump restaurado num banco descartável bateu com o
vivo. O caminho é o mesmo para um desastre:

1. Parar o container (`docker stop lojas-avilaops`), para ninguém escrever.
2. Restaurar o dump num banco novo, conferir contagens (`Tenant`, `Produto`,
   `Pedido`, `_prisma_migrations`) e só então trocar o nome dos bancos.
3. Publicar o commit cuja última migração é a do dump (ver abaixo).

Não restaure por cima do banco vivo: o estado ruim é a única evidência do que
aconteceu.

## Como voltar uma versão

Voltar versão é **publicar o commit de novo**, não copiar pasta no servidor:

```bash
gh workflow run deploy-production.yml --ref <commit ou branch>
```

Se a versão a que se quer voltar é anterior a uma migração, o código antigo
roda contra o schema novo. Com migração que só acrescenta, isso funciona: o
código antigo não conhece a coluna nova e não a usa. É mais um motivo para a
regra acima.

## Ensaio

`npm run banco:ensaio` (`scripts/ensaio-banco.mts`) repete o ciclo inteiro no
Postgres descartável (`lojas-db-test`, o mesmo Postgres 18 de produção), sem
tocar em servidor nenhum:

1. cria uma base com todas as migrações **menos a última**: o banco antes do
   deploy;
2. grava duas lojas e tira o retrato (linhas por tabela, migrações aplicadas,
   funções, gatilhos e índices);
3. faz o `pg_dump` em SQL puro, o formato do dump de produção;
4. aplica a última migração: o deploy;
5. restaura o dump **numa base nova** e compara com o retrato do passo 2. Tem
   de bater em tudo e ter exatamente a última migração pendente;
6. aplica a migração na base restaurada e confere `prisma migrate status`;
7. apaga as duas bases, também quando um passo falha.

```bash
npm run banco:teste          # sobe o lojas-db-test
npm run banco:ensaio         # sai com 0; a última linha é um JSON com "divergencias":0
npm run banco:teste:parar
```

Qualquer diferença sai listada (o que divergiu, antes e depois) e o comando
sai com 1. O script recusa destino que não seja `127.0.0.1`, a porta do
container de teste e base terminada em `_test`: a regra é `destinoDeEnsaio`,
em `src/lib/ensaio-banco.ts`, e está presa em `npm test`
(`src/lib/ensaio-banco.test.ts`) junto com duas afirmações deste documento: o
`deploy/deploy.sh` migra antes de trocar e não engole falha de migração, e
todo arquivo deste repositório citado aqui existe.

O ensaio prova o **procedimento**. Não prova que o dump desta madrugada
restaura: isso é a conferência de "Como conferir" e o teste de "Como
restaurar", no servidor.

## Falta

- **Dump automático antes de migração pendente**: escrito em
  `avilaops/infra#8`, não instalado (ver "Backup do banco").
- **Fotos das lojas** (`/opt/lojas/uploads`): `deploy/docker-compose.producao.yml`
  marca o container com `avilaops.backup: "false"` porque o banco é do host, e
  nada neste repositório diz se o volume de fotos é copiado. Pergunta aberta
  para quem cuida do servidor.
- **Migração de reversão** (`down`): o Prisma não gera, e não escrevemos. A
  regra é a de compatibilidade com a versão anterior do código.
- **Ensaio dentro do pipeline**: a imagem é construída sem Docker disponível
  no build, então o ensaio roda à mão, antes de entregar migração que mexe em
  dado existente.

## Não conferido em produção

O que foi acrescentado junto com o ensaio (a tabela do topo, "Migração que
falhou no meio", o comando do dump à mão, "Ensaio" e "Falta") vem da leitura
dos scripts e do ensaio no Postgres descartável, não de acesso ao servidor.
Em particular: o comando do dump à mão não foi executado em produção, e o
`prisma migrate resolve` nunca precisou ser usado lá.
