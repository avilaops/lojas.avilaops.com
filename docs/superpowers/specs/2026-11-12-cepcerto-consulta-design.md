# CepCerto com token de consulta

## Contrato

O proprietário determinou que as consultas CepCerto usem sempre
`CEPCERTO_CONSULTA_KEY`, sem chave pública. Produto e carrinho continuam usando
`ConsultarEntrega` → `POST /api/frete`; a credencial fica somente no servidor.
O checkout usa o mesmo adaptador para preservar o preço consultado.

## Abordagem

Substituir o widget por `GET /ws/json-frete/{origem}/{destino}/{gramas}/
{altura}/{largura}/{comprimento}/{token}`. A fonte é a documentação oficial:
<https://cepcerto.com/integracao>, conferida em 12/11/2026. A resposta é um
objeto plano com preços e prazos de PAC e SEDEX. Usar apenas os preços com
desconto CepCerto, pois as etiquetas usam a conta da plataforma. Preço de
balcão e Mini Envios continuam fora da oferta. Esta API básica não recebe
valor declarado; não afirmar cobertura de seguro adicional.

Chamar o provedor no navegador exporia o token. Continuar no widget exigiria
a chave pública rejeitada pelo proprietário. Manter o endpoint interno
preserva a autoridade dos preços, pesos e medidas do catálogo.

## Limites e verificação

- Sem retorno à chave pública ou ao token de postagem nas consultas.
- Preservar o contrato das lojas conectadas ao Melhor Envio.
- Validar CEPs, peso em gramas e limites de caixa antes de consumir consultas.
- Erro HTTP, JSON inválido, preço ou prazo inválido não vira frete grátis.
- Não registrar URL, token nem corpo bruto do provedor nos logs.
- Manter tabela, entrega local e retirada como alternativas já cadastradas.
- Emissão de etiqueta e consultas de endereço não mudam neste escopo.
- Testes e builds exclusivamente no GitHub CI; primeiro observar as regressões
  falhando e depois verificar a implementação. Nenhuma chamada usa credenciais reais.
- O HTTP 422 anterior é evidência histórica; liberação da conta depende do
  suporte e deve ser verificada separadamente após configuração do ambiente.
