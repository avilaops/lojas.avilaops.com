# Documentação Completa das APIs CepCerto

> **Fontes Oficiais:** [https://cepcerto.com/apis](https://cepcerto.com/apis) e [https://cepcerto.com/integracao](https://cepcerto.com/integracao)  
> **Ambientes:**  
> - **Produção:** `https://cepcerto.com`  
> - **Desenvolvimento / Sandbox:** `https://dev.cepcerto.com`

---

## 1. Visão Geral e Arquitetura de Credenciais

O CepCerto divide seus serviços em **três tipos de credenciais**, com finalidades distintas que **não são intercambiáveis**:

| Credencial | Nome no Painel | Onde é enviada | Finalidade |
| :--- | :--- | :--- | :--- |
| **`postage_token`** | Token de Postagem | JSON (`token_cliente_postagem`) ou Header `Authorization: Bearer` | Cotação operacional multi-transportadoras (Correios, Jadlog, Loggi), consulta de saldo, geração de PIX de recarga, emissão de etiquetas, cancelamento com estorno, rastreamento de envios, comprovante de entrega e busca de logradouro. |
| **`consumption_key`** | Chave de Consumo (`sua_chave`) | Último segmento da URL em endpoints `/ws/...` | APIs diretas de consulta de CEP e cálculo de frete Correios balcão + desconto (PAC, SEDEX, Mini Envios, valor declarado, AR, mão própria e cilindros). |
| **`widget_public_key`** | Chave Pública do Widget | Header `X-CepCerto-Public-Key` ou tag `<script data-public-key>` | Cotador de frete para e-commerce / frontend. Protegido por lista de domínios ou IPs autorizados no painel. |

---

## 2. Planos e Modelos de Consumo (`/apis`)

As APIs da família `/ws/` utilizam pacotes de créditos acumulativos:

| Plano | Consultas / Mês | Valor Mensal | Custo Unitário Médio |
| :--- | :--- | :--- | :--- |
| **Grátis** | 20 consultas | R$ 0,00 | Período único para testes |
| **Bronze** | 500 consultas | R$ 17,50 | R$ 0,035 / consulta |
| **Prata** | 1.000 consultas | R$ 35,00 | R$ 0,035 / consulta |
| **Ouro** | 2.000 consultas | R$ 70,00 | R$ 0,035 / consulta |
| **Diamante** | 5.000 consultas | R$ 175,00 | R$ 0,035 / consulta |
| **Pérola** | 10.000 consultas | R$ 350,00 | R$ 0,035 / consulta |
| **Flex** | A partir de 100 | R$ 0,20 / consulta | Mínimo de R$ 20,00 |

### Ciclos e Regras de Débito:
- **Ciclos disponíveis:** Mensal, Trimestral (acumula 3 meses), Semestral (acumula 6 meses) e Anual (acumula 12 meses).
- **Consumo:** 
  - Cotação de frete com PAC e SEDEX na mesma requisição debita **2 consultas**.
  - Busca de endereço por CEP debita **1 consulta**.
- **Alertas de limite:** Notificações automáticas ao restar 20 consultas e ao atingir 100% da franquia.

---

## 3. APIs de Consulta Pública e Frete Correios (`/ws/`)

Autenticadas pela `consumption_key` inserida no final da URL.

---

### 3.1. Busca de Endereço por CEP

* **JSON:** `GET https://cepcerto.com/ws/json/{cep}/{sua_chave}`
* **XML:** `GET https://cepcerto.com/ws/xml/{cep}/{sua_chave}`

#### Parâmetros:
- `cep`: CEP com 8 dígitos (somente números ou formatado).
- `sua_chave`: Chave de consumo CepCerto.

#### Resposta JSON (Exemplo):
```json
{
  "cep": "01310930",
  "logradouro": "Avenida Paulista, 2100",
  "complemento": "",
  "bairro": "Bela Vista",
  "localidade": "São Paulo",
  "uf": "SP",
  "numeroLocalidade": 96681
}
```

---

### 3.2. Cotação Balcão e CepCerto (PAC, SEDEX e Mini Envios)

Compara o preço oficial de balcão dos Correios com o valor com desconto CepCerto.

* **JSON:** `GET https://cepcerto.com/ws/json-frete/{cep_origem}/{cep_destino}/{peso_gramas}/{altura_cm}/{largura_cm}/{comprimento_cm}/{sua_chave}`
* **XML:** `GET https://cepcerto.com/ws/xml-frete/{cep_origem}/{cep_destino}/{peso_gramas}/{altura_cm}/{largura_cm}/{comprimento_cm}/{sua_chave}`

#### Regras dos Parâmetros:
- `peso_gramas`: Maior que 0 até 30.000 g (ex: `1000` para 1kg). *Valores entre 0.1 e 30 são interpretados como kg por compatibilidade retroativa.*
- `altura_cm`, `largura_cm`, `comprimento_cm`: De 1 a 100 cm cada.
- `Soma das dimensões`: Máximo de 200 cm.

#### Resposta JSON (Exemplo):
```json
{
  "ceporigem": "01527050",
  "cepdestino": "11440001",
  "peso_gramas": 300,
  "altura_cm": 4,
  "largura_cm": 16,
  "comprimento_cm": 24,
  "valorpac": "25,80",
  "valorpac_desconto_cepcerto": "21,34",
  "economiapac_cepcerto": "4,46",
  "prazopac": "6",
  "valorsedex": "27,60",
  "valorsedex_desconto_cepcerto": "25,80",
  "economiasedex_cepcerto": "1,80",
  "prazosedex": "2",
  "valorminienvios_cepcerto": "14,90",
  "prazominienvios_cepcerto": "7 dias"
}
```

> **Elegibilidade Mini Envios:** Aparece somente quando o pacote pesar até 300g, medidas até 4×16×24cm, valor declarado até R$ 100,00, sem AR, sem Mão Própria e com destino interestadual/fora da mesma cidade.

---

### 3.3. Cotação com Serviços Opcionais (Valor Declarado, Mão Própria e AR)

* **JSON:** `GET https://cepcerto.com/ws/json-frete-opcional/{origem}/{destino}/{peso}/{altura}/{largura}/{comprimento}/{valor_declarado}/{mao_propria}/{aviso_recebimento}/{sua_chave}`
* **XML:** `GET https://cepcerto.com/ws/xml-frete-opcional/{origem}/{destino}/{peso}/{altura}/{largura}/{comprimento}/{valor_declarado}/{mao_propria}/{aviso_recebimento}/{sua_chave}`

#### Parâmetros extras:
- `valor_declarado`: Valor em reais com ponto (ex: `550.25`).
- `mao_propria`: `1` para ativar, `0` para desativar.
- `aviso_recebimento`: `1` para ativar, `0` para desativar.

---

### 3.4. Cotação para Objetos Cilíndricos (Rolo / Cilindro)

* **JSON:** `GET https://cepcerto.com/ws/json-frete-cilindro/{origem}/{destino}/{peso}/{comprimento}/{diametro}/{sua_chave}`
* **XML:** `GET https://cepcerto.com/ws/xml-frete-cilindro/{origem}/{destino}/{peso}/{comprimento}/{diametro}/{sua_chave}`

#### Parâmetros:
- `comprimento`: 13 a 100 cm.
- `diametro`: 10 a 91 cm.

---

### 3.5. Cotação por Código de Serviço Específico dos Correios

* **Caixa:** `GET https://cepcerto.com/ws/json-frete-servico/{origem}/{destino}/{peso}/{altura}/{largura}/{comprimento}/{codigo_servico}/{sua_chave}`
* **Cilindro:** `GET https://cepcerto.com/ws/json-frete-servico-cilindro/{origem}/{destino}/{peso}/{comprimento}/{diametro}/{codigo_servico}/{sua_chave}`

#### Códigos de Serviço:
- `04510`: PAC
- `04014`: SEDEX

---

## 4. API de Cotação, Postagem e Operação (`/api-.../`)

Família autenticada via `postage_token` no corpo da requisição JSON (ou via Header `Authorization: Bearer <postage_token>`).

### Limites Globais de Encomenda:
- **Peso:** Maior que 0 e até 30 kg (em quilogramas nos endpoints JSON).
- **Dimensões:** Cada lado de 1 a 100 cm; soma máxima de 200 cm.
- **Valor Declarado (Seguro):** Mínimo de R$ 50,00 e máximo de R$ 35.000,00.

---

### 4.1. `POST /api-cotacao-frete/` (Cotação Multi-Transportadoras)

Cota Correios (PAC, SEDEX), Jadlog (Package, .COM) e Loggi.

#### Corpo JSON (Volume Único):
```json
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "cep_remetente": "01001000",
  "cep_destinatario": "20040002",
  "peso": "1.0",
  "altura": "10",
  "largura": "15",
  "comprimento": "20",
  "valor_encomenda": "50.00"
}
```

#### Corpo JSON (Múltiplos Volumes):
```json
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "cep_remetente": "01001000",
  "cep_destinatario": "20040002",
  "valor_encomenda": "150.00",
  "volumes": [
    { "peso": "0.5", "altura": "10", "largura": "15", "comprimento": "20", "quantidade": 2 },
    { "peso": "1.0", "altura": "20", "largura": "20", "comprimento": "30", "quantidade": 1 }
  ]
}
```

#### Resposta de Sucesso:
```json
{
  "status": "sucesso",
  "frete": {
    "valor_pac": "18,90",
    "valor_pac_balcao": "24,30",
    "prazo_pac": "até 6 dias",
    "valor_sedex": "29,70",
    "valor_sedex_balcao": "36,10",
    "prazo_sedex": "até 2 dias",
    "valor_jadlog_package": "17,50",
    "prazo_jadlog_package": "até 4 dias",
    "valor_loggi": "19,20",
    "prazo_loggi": "até 3 dias"
  }
}
```

---

### 4.2. `POST /api-consulta-logradouro/` (Busca de CEP por Endereço)

#### Corpo JSON:
```json
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "uf": "SP",
  "cidade": "São Paulo",
  "logradouro": "Avenida Paulista",
  "bairro": "",
  "limite": 20,
  "pagina": 1
}
```

---

### 4.3. `POST /api-saldo/` (Consulta de Saldo da Carteira)

```json
// Requisição
{ "token_cliente_postagem": "SEU_POSTAGE_TOKEN" }

// Resposta
{
  "nome_cliente": "MINHA EMPRESA LTDA",
  "saldo_atual": "R$ 150,00",
  "data_requisicao": "27/08/2026 12:00:00"
}
```

---

### 4.4. `POST /api-credito/` (Gerar Cobrança PIX para Saldo)

Gera uma cobrança PIX imediata (R$ 5,00 a R$ 5.000,00). O saldo entra na conta assim que o pagamento for liquidado.

```json
// Requisição
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "valor_credito": "50.00"
}

// Resposta
{
  "nome_cliente": "MINHA EMPRESA LTDA",
  "data_requisicao": "27/08/2026 12:00:00",
  "valor": 50,
  "copia_cola": "00020126580014BR.GOV.BCB.PIX...",
  "qrcode_url": "https://cepcerto.com/qrcode/EXEMPLO",
  "qrcode_img": "https://cepcerto.com/qrcode/EXEMPLO.png"
}
```

---

### 4.5. `POST /api-postagem-frete/` (Emissão de Etiquetas)

Emite a etiqueta, debita o valor do saldo da carteira e gera os documentos de postagem.

#### Modalidade 1: Com Declaração de Conteúdo
```json
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "request_id": "pedido-102938",
  "tipo_entrega": "pac",
  "logistica_reversa": "N",
  "cep_remetente": "01001000",
  "cep_destinatario": "20040002",
  "peso": "1.0",
  "altura": "10",
  "largura": "15",
  "comprimento": "20",
  "valor_encomenda": "100.00",
  "nome_remetente": "Loja Exemplo",
  "cpf_cnpj_remetente": "12345678000190",
  "whatsapp_remetente": "11999999999",
  "email_remetente": "contato@loja.com",
  "numero_endereco_remetente": "100",
  "nome_destinatario": "João Silva",
  "cpf_cnpj_destinatario": "12345678900",
  "whatsapp_destinatario": "21988888888",
  "email_destinatario": "joao@email.com",
  "numero_endereco_destinatario": "250",
  "tipo_doc_fiscal": "declaracao",
  "produtos": [
    {
      "descricao": "Camiseta Algodão",
      "valor": "100.00",
      "quantidade": 1
    }
  ]
}
```

#### Modalidade 2: Com Nota Fiscal Eletrônica (NF-e DANFE)
Emita enviando o XML autorizado em **Base64** ou via **URL HTTPS pública**:

```json
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "request_id": "pedido-102939",
  "tipo_entrega": "jadlog-dotcom",
  "logistica_reversa": "N",
  "cep_remetente": "01001000",
  "cep_destinatario": "20040002",
  "peso": "1.0",
  "altura": "10",
  "largura": "15",
  "comprimento": "20",
  "valor_encomenda": "250.00",
  "nome_remetente": "Loja Exemplo",
  "cpf_cnpj_remetente": "12345678000190",
  "whatsapp_remetente": "11999999999",
  "email_remetente": "contato@loja.com",
  "numero_endereco_remetente": "100",
  "nome_destinatario": "Maria Souza",
  "cpf_cnpj_destinatario": "98765432100",
  "whatsapp_destinatario": "21977777777",
  "email_destinatario": "maria@email.com",
  "numero_endereco_destinatario": "500",
  "tipo_doc_fiscal": "danfe",
  "chave_danfe": "35260502745658000158550010000118891074417476",
  "documento_fiscal_nome": "NFe_35260502745658000158550010000118891074417476.xml",
  "documento_fiscal_base64": "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4..."
}
```

*Para Jadlog, o documento fiscal deve ser obrigatoriamente o XML autorizado.*

#### Resposta de Emissão:
```json
{
  "status": "sucesso",
  "sucesso": true,
  "mensagem": "Frete confirmado com sucesso.",
  "frete": {
    "freteTipo": "correios_pac",
    "servico": "pac",
    "valor": 18.90,
    "prazo": "até 6 dias",
    "codigoObjeto": "AP000000000BR",
    "pdfUrlEtiqueta": "https://cepcerto.com/postagem/etiqueta/download/TOKEN_ETIQUETA",
    "pdfUrlDCE": "https://cepcerto.com/postagem/etiqueta/documento?id=TOKEN_DOC"
  }
}
```

---

### 4.6. `POST /api-cancela-postagem/` (Cancelamento com Estorno)

Cancela a etiqueta e estorna o saldo na carteira (caso o objeto ainda não tenha sido postado na agência).

```json
// Requisição
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "codigo_objeto": "AP000000000BR"
}

// Resposta
{
  "sucesso": true,
  "nome_cliente": "MINHA EMPRESA LTDA",
  "saldo_anterior": "R$ 81,10",
  "valor_creditado": "R$ 18,90",
  "saldo_atual": "R$ 100,00",
  "mensagem": "Objeto AP000000000BR cancelado com sucesso!"
}
```

---

### 4.7. `POST /api-rastreio/` (Rastreamento de Objetos)

```json
// Requisição
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "codigo_objeto": "AP000000000BR",
  "transportadora": "Correios"
}

// Resposta
{
  "sucesso": true,
  "mensagem": "OK",
  "objeto": "AP000000000BR",
  "transportadora": "Correios",
  "dt_prevista": {
    "texto": "05/08/2026",
    "iso_inicio": "2026-08-05T23:59:59-03:00",
    "iso_fim": "2026-08-05T23:59:59-03:00"
  },
  "eventos": [
    {
      "data_br": "31/07/26 10:00",
      "descricao": "Objeto postado",
      "detalhe": "",
      "unidade": {
        "nome": "Agência Central",
        "cidade": "São Paulo",
        "uf": "SP",
        "tipo": "AGÊNCIA"
      },
      "entregue": false
    }
  ]
}
```

---

### 4.8. `POST /api-comprovante-correios/` (Comprovante / AR Digital)

Obtém a foto/assinatura do comprovante de entrega dos Correios.

```json
// Requisição (formato JSON/Base64)
{
  "token_cliente_postagem": "SEU_POSTAGE_TOKEN",
  "codigo_rastreio": "AP000000000BR",
  "formato": "json" // ou "arquivo" para download binário direto do JPG
}

// Resposta
{
  "sucesso": true,
  "mensagem": "OK",
  "objeto": "AP000000000BR",
  "nome_arquivo": "comprovante-entrega-AP000000000BR.jpg",
  "content_type": "image/jpeg",
  "comprovante_base64": "/9j/4AAQSkZJRgABAQ..."
}
```

*Limite: 30 requisições por minuto.*

---

## 5. Widget de Frete para Sites (`/widget-de-frete`)

Permite embutir um cotador visual direto no frontend da loja.

### Instalação via Tag HTML:
```html
<script src="https://cepcerto.com/widget_frete/" data-public-key="SUA_CHAVE_PUBLICA"></script>
```

### Endpoints Internos do SDK:
* `POST /widget_frete/api/acesso`: Valida a chave pública, o domínio de origem (`Origin`) e retorna o consumo restante.
* `POST /widget_frete/api/cotacao`: Executa a cotação calculando apenas as transportadoras configuradas no painel.

---

## 6. Códigos de Retorno e Tratamento de Erros

| Código HTTP | Significado | Como Tratar na Aplicação |
| :--- | :--- | :--- |
| **`200 OK`** | Operação realizada | Processar `status` e corpo JSON retornado. |
| **`400 Bad Request`** | JSON ou parâmetros inválidos | Validar formato dos CEPs (8 dígitos), números e tipos. |
| **`401 Unauthorized`** | Token/Chave inválido ou domínio não liberado | Verificar se a credencial está correta ou se o domínio foi cadastrado no painel. |
| **`404 Not Found`** | Rota ou objeto não localizado | Verificar o endpoint e se o código pertence à conta. |
| **`405 Method Not Allowed`** | Método HTTP incorreto | Usar `POST` para APIs operacionais e `GET` para `/ws/`. |
| **`422 Unprocessable Entity`**| Regra de negócio violada | Dimensões fora do limite (máx 30kg, 100cm, soma 200cm) ou valor declarado incompatível. |
| **`429 Too Many Requests`** | Franquia/Rate limit excedido | Aguardar renovação da franquia ou recarregar créditos. |
| **`500 / 503`** | Instabilidade ou Correios fora do ar | Implementar retry exponencial e fallback para tabela própria. |
