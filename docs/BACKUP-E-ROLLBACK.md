# Backup, migração e rollback do Lojas

Como a plataforma sai de uma versão para outra, o que protege o banco no
caminho e como voltar. Quem faz o deploy, o que ele garante e onde está o dump
diário foram conferidos no servidor em 08/10/2026. O dump antes de migração
está instalado nos dois caminhos de deploy (o do Actions desde 09/10/2026),
mas **ainda não foi visto rodando num deploy de verdade**: o que está provado
e o que não está fica em "Não conferido em produção". O procedimento em si
(dump, migração, volta ao dump) tem um ensaio que qualquer um roda sem
servidor: `npm run banco:ensaio`, descrito em "Ensaio".

| Caminho de deploy | Quem migra | Quem reverte | Onde está o script |
|---|---|---|---|
| Pipeline (o normal) | `avila-deploy`, antes de trocar o container e, havendo migração pendente, depois do dump | `avila-deploy`, para a imagem anterior, se a saúde falhar | `.github/workflows/deploy-production.yml` aqui; `deploy-container.sh` no repositório `infra` |
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
- **Antes de migração pendente**: instalado nos dois caminhos de deploy, ainda
  sem prova em deploy de verdade. Ver abaixo.

### Dump antes da migração: o que cada caminho faz hoje

Conferido no código do `infra` e nos relatos de instalação da equipe (tarefas
241 e 247 em 08/10/2026, tarefa 262 em 09/10/2026), não em deploy de verdade:
ver "Não conferido em produção".

| Caminho | Script no servidor | Dump antes de migração pendente |
|---|---|---|
| GitHub Actions (o do dia a dia) | `/usr/local/sbin/avila-deploy` (fonte: `deploy-container.sh`, na pasta `scripts` do `infra`), versão instalada em 09/10/2026 07:30 UTC | instalado; ainda não visto num deploy |
| Manual, por arquivo de imagem | `/usr/local/sbin/avila-deploy-local` (fonte: `deploy-container-local.sh`, na pasta `scripts` do `infra`), versão instalada em 08/10/2026 | instalado; ainda não visto num deploy |

**Pelo Actions, o `avila-deploy` com o dump está instalado desde 09/10/2026
07:30 UTC** (tarefa 262 do quadro da equipe). Até essa hora, toda migração do
Lojas por esse caminho rodou sem dump colado nela: o script era o de
18/09/2026, anterior ao dump. **O que não está provado é o dump em si**: até a
última conferência de operações (09/10/2026 13:26 UTC, tarefa 291) nenhum
deploy do Lojas tinha passado pelo script novo, então a linha `dump conferido`
e o arquivo `pre-migracao-*` nunca foram vistos em produção por esse caminho.
Três outras aplicações já publicaram pelo script novo sem falha, nenhuma com
dump ligado. Em 12/10/2026 18:03 UTC o Lojas publicou pelo script novo pela
primeira vez (run 38288388707 do Actions): não havia migração pendente e o log
diz `sem migracao pendente; dump dispensado`. Isso prova o script e o ramo sem
migração, não o dump. Quem acompanha o primeiro
deploy do Lojas com migração é a raia de operações (tarefa 305 do quadro).
Enquanto essa prova não existir, a regra do dump à mão, mais abaixo, continua
valendo.

**Pelo `avila-deploy-local`** (o caminho do `BUILD-MANUAL.md` do `infra`, para
quando o Actions não pode construir nem publicar), o dump está ligado para o
Lojas pela linha `MIGRATE_DUMP_DB=lojas` em
`/etc/avilaops/deploy/lojas.avilaops.com.conf`. O `deploy-container.sh` do
Actions liga o dump pela mesma variável e escreve as mesmas mensagens (lido no
`infra` em 09/10/2026); os passos, pela leitura dos dois scripts:

1. **Conferência do banco, em todo deploy**, com ou sem migração pendente: o
   nome do banco na `DATABASE_URL` do `.env` tem de ser `lojas`, o mesmo de
   `MIGRATE_DUMP_DB`. Diferente, ou URL que não dá para ler, o deploy para com
   `Banco da URL de migracao nao e o de MIGRATE_DUMP_DB; nada foi migrado nem trocado.`
   Só o nome é conferido: host e porta não. O dump sai sempre do Postgres do
   próprio servidor.
2. **Sem migração pendente** (`prisma migrate status` em dia): nenhum arquivo,
   e o log diz `==> sem migracao pendente; dump dispensado`.
3. **Com migração pendente**: `pg_dump` do banco `lojas` para
   `/opt/backups/db/pre-migracao-lojas.avilaops.com-<AAAAMMDD>-<HHMMSS>.sql.gz`
   (hora em UTC). O arquivo só assume esse nome depois da mesma conferência do
   diário: gzip íntegro, com conteúdo e com o marcador de fim do `pg_dump`. O
   log de sucesso é `==> dump conferido: <arquivo> (<bytes> bytes)`, e só
   depois dele a migração é aplicada.
4. **Dump que falha, sai incompleto ou não chega ao nome final**: o deploy
   para antes de migrar. O serviço segue na imagem anterior e nada foi migrado
   nem trocado.

O que saber sobre esses arquivos:

- **Não vão para o R2.** O envio diário para fora do servidor
  (`applications/sync-r2.sh`, no `infra`) deixa `pre-migracao-*` de fora de
  propósito: o dump serve para desfazer a migração nas horas seguintes, e o
  estado novo do banco sobe no diário. Se o disco do servidor se perder, o
  `pre-migracao` vai junto.
- **Rotação**: a mesma do diretório, segundo o `infra`: fica o mais recente da
  família, os outros 7 dias. Não há teto por quantidade.
- **Deploy que para na migração obriga a reenviar a imagem.** O
  `avila-deploy-local` apaga o arquivo da imagem logo depois de carregá-la,
  antes da migração. Se parar ali (dump que falha, banco que não confere,
  migração que falha), corrigida a causa é rodar a publicação manual inteira
  de novo (`publicar-manual.ps1`, no `infra`): build e transferência.
- **Ainda não existe nenhum `pre-migracao-*`**: até 09/10/2026 não houve deploy
  do Lojas com migração pendente depois das instalações, por nenhum dos dois
  caminhos.

Enquanto o dump do deploy não for visto funcionando em produção, **quem sobe
migração que mexe em dado existente faz o dump à mão antes** (regra do
`AGENTS.md`). Migração que só cria tabela ou coluna nula não precisa: o dump
do dia cobre.

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
7. apaga as duas bases e a pasta temporária, também quando um passo falha ou
   o ensaio é interrompido (Ctrl+C, `SIGTERM`): ele para entre dois passos,
   limpa e sai com 130 ou 143. `SIGKILL` não dá para tratar; aí as bases somem
   com `npm run banco:teste:parar` e sobra `/tmp/lojas-ensaio-*`.

```bash
npm run banco:teste          # sobe o lojas-db-test
npm run banco:ensaio         # sai com 0; a última linha é um JSON com "divergencias":0
npm run banco:teste:parar
```

Qualquer diferença sai listada (o que divergiu, antes e depois) e o comando
sai com 1. O script recusa destino que não seja `127.0.0.1`, a porta do
container de teste e base terminada em `_test`, e recusa `TEST_DB_PORT=5432`,
a porta do Postgres de verdade: as regras são `destinoDeEnsaio` e
`portaDeEnsaio`, em `src/lib/ensaio-banco.ts`, e estão presas em `npm test`
(`src/lib/ensaio-banco.test.ts`) junto com duas afirmações deste documento: o
`deploy/deploy.sh` migra antes de trocar e não engole falha de migração, e
todo arquivo deste repositório citado aqui existe.

O ensaio prova o **procedimento**. Não prova que o dump desta madrugada
restaura: isso é a conferência de "Como conferir" e o teste de "Como
restaurar", no servidor.

## Falta

- **Prova, em deploy de verdade, do dump antes de migração**: o `avila-deploy`
  com o dump foi instalado em 09/10/2026 07:30 UTC (tarefa 262 do quadro da
  equipe) e o `avila-deploy-local` em 08/10/2026, mas nenhum dos dois publicou
  o Lojas com migração pendente desde então (o deploy de 12/10/2026 passou
  pelo `avila-deploy` novo sem migração: dump dispensado). Falta ver a linha `dump conferido`
  e o arquivo `pre-migracao-*` num deploy do Lojas (acompanhamento na tarefa
  305). Ver "Backup do banco".
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

O dump antes da migração do `avila-deploy-local` foi instalado em 08/10/2026,
mas **nunca rodou num deploy de verdade**: a conferência do banco, o arquivo
`pre-migracao-*` e a linha `dump conferido` foram provados em teste, contra um
banco descartável. O filtro que tira `pre-migracao-*` do envio ao R2 foi
provado por listagem, não por um envio. A prova em produção é o primeiro
deploy do Lojas por esse caminho com migração pendente.

O `avila-deploy` do Actions com o dump foi instalado em 09/10/2026 07:30 UTC
e **também não rodou num deploy do Lojas**: no acompanhamento de operações do
mesmo dia (tarefa 291), três aplicações publicaram por ele sem falha (`tms`,
`app` e `auth`), nenhuma com dump ligado e nenhuma com migração pendente; o
Lojas não tinha publicado. Nada neste documento afirma que o dump do Actions
funciona em produção: afirma que está instalado. A prova é o primeiro deploy
do Lojas pelo Actions, e ela só é completa com migração pendente (linha
`dump conferido` e arquivo `pre-migracao-*`).
