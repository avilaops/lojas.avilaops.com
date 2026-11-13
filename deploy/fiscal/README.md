# Gerador privado de DANFE

Serviço estateless isolado para o contrato `/v1/documentos/nfe/danfe.pdf` já
consumido pelo Lojas. O backend web e as APIs da aplicação permanecem TypeScript.
Este processo Python apenas desenha PDF a partir do XML completo autorizado;
não contém certificado, não chama SEFAZ e não acessa banco ou buckets.

`X-Fiscal-Service-Key` deve conter segredo aleatório de32a128caracteres, igual
ao `FISCAL_SHARED_SERVICE_KEY` configurado no Lojas. O endereço HTTPS do serviço
vai em `FISCAL_SHARED_API_URL`. Sem chave forte o processo não inicia. Rota de
saúde `/healthz` não expõe XML, chave ou certificado. Não habilitar CORS ou
logar corpos/cabeçalhos. O Lojas autoriza o tenant antes de chamar o gerador.

Limite de12MiB por corpo, duas renderizações simultâneas, prazo de leitura15s,
XML sem DTD/entidades, modelo55 e protocolo100 pertencente à mesma chave.
Respostas privadas/no-store. Os PDFs permanecem em memória; cache e isolamento
dos arquivos são responsabilidade das rotas existentes e do R2 privado.

Python3.13.18 e dependências com hashes aprovados no GitHub CI. No Render a
etapa de preparação instala somente wheels com `--no-compile`; testes e builds
da aplicação executam exclusivamente no CI. `render-resources.json` registra
configuração sem credenciais; publicação deve fixar o commit aprovado.

Biblioteca dinâmica: [BrazilFiscalReport1.3.1](https://github.com/Engenere/BrazilFiscalReport/tree/v1.3.1),
LGPLv3, código-fonte e licença no upstream e metadados da distribuição instalada.
Demais dependências/licenças ficam nos seus pacotes; versões/hashes em
`requirements.lock`. Testes usam fixture própria de homologação sem dados reais.
