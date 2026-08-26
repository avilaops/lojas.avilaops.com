# Conformidade — o que toda loja já cumpre sozinha

Loja de pequeno negócio quase nunca tem quem cuide disso. Aqui a conformidade é
parte da plataforma: o lojista não escreve política, não instala banner de
cookie e não escolhe o que exibir. Ele preenche dois campos e o resto vem
pronto, igual em todas as lojas — que é o mesmo motivo pelo qual o custo por
loja fica abaixo de R$ 10/mês.

## Identificação do fornecedor (Decreto 7.962/2013, art. 2º)

Quem vende pela internet é obrigado a exibir, **em local de destaque**, razão
social, CNPJ, endereço físico e endereço eletrônico.

- Campos `Tenant.razaoSocial` e `Tenant.cnpj` (14 dígitos, sem máscara; o
  dígito verificador é conferido em `admin-schemas.ts` com `validarCnpj` do
  `@avilaops/checkout` — o rodapé nunca mostra CNPJ inventado).
- Preenchidos no painel em **Conta → Dados da empresa**. Enquanto faltarem, o
  painel avisa.
- Aparecem sozinhos na última linha do rodapé de **todas** as páginas e no
  bloco "Quem vende" de cada política.
- O endereço aparece na linha legal mesmo com `enderecoPublico = false`. Aquela
  opção controla só o bloco "onde ficamos" do rodapé; a exigência legal não é
  opcional.

## Direito de arrependimento e garantia (CDC)

`/politicas/devolucao`, `/politicas/envio` e `/politicas/privacidade` são texto
único da plataforma preenchido com os dados da loja (prazo de despacho,
retirada, canal de atendimento). Nenhum lojista edita — é o que garante que os
7 dias do art. 49 e os prazos de vício do art. 26 estejam escritos certo em
toda loja, sem ninguém revisar uma por uma.

## Cookies e pixels (LGPD, art. 7º e 8º)

Carrinho e sessão são cookies necessários ao serviço que o comprador pediu:
não dependem de consentimento e não entram no aviso.

Pixel de anúncio depende. O comportamento é:

| Situação | Google (GTM/gtag) | Meta | TikTok |
| --- | --- | --- | --- |
| Loja sem nenhum pixel | não carrega | não carrega | não carrega |
| Visitante ainda não respondeu | carrega em Consent Mode v2 com tudo `denied` | **não é inserido** | **não é inserido** |
| "Só o necessário" | segue `denied` | nunca | nunca |
| "Aceitar" | `consent update` → `granted` | carrega e dispara PageView | carrega e dispara |

- O aviso (`src/components/Consentimento.tsx`) **só aparece se a loja tiver
  algum pixel**. Loja que não anuncia não usa cookie de terceiro e não tem o
  que perguntar — nem atrito para o comprador.
- A escolha fica no `localStorage` do visitante (`loja_consentimento`), com
  versão. Subir `VERSAO` em `src/lib/consentimento.ts` faz todo mundo ser
  perguntado de novo — é o que fazer quando o alcance do tratamento mudar.
- A loja não guarda perfil de visitante. Nada de consentimento vai para o banco.
- "Cookies", no rodapé, reabre a decisão (art. 8º, §5º: consentimento tem que
  ser revogável com a mesma facilidade).
- Google fica em Consent Mode em vez de bloqueado porque é o formato que o
  próprio Google pede: sem cookie e sem identificação enquanto negado, e a
  medição volta inteira no `update` se a pessoa aceitar.

## Dados do comprador

O comprador tem conta na loja (`/conta`), com histórico e endereços. Exportar
os dados dos clientes finais em CSV mediante pedido por escrito é a **única**
exceção ao padrão fechado da plataforma — é obrigação de LGPD do lojista, que é
o controlador dos dados de quem compra dele.
