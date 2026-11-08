# Jornada visual PK

Fluxogramas aprovados pelo proprietário. A interface correspondente usa HTML semântico, links e seleção por rádio para manter texto legível, teclado e navegação no celular, sem dependência de renderização de terceiros. A rota pública é `/como-escolher`; o resumo fica na home. Nenhuma etapa cria um pedido automaticamente.

```mermaid
flowchart TB
  Inicio([A máquina precisa voltar a trabalhar]) --> Entrada{O que você tem em mãos?}
  Entrada -->|Código| Codigo[Buscar referência no catálogo]
  Entrada -->|Peça usada| Amostra[Conferir DI, DE, altura e seção]
  Entrada -->|Equipamento| Aplicacao[Explorar aplicações por segmento]
  Aplicacao --> Funcao[Entender a função: vedar, raspar ou guiar]
  Codigo & Amostra & Funcao --> Ficha[Conferir medidas, material, perfil e aplicação]
  Ficha --> Comparar[Comparar até três peças]
  Comparar --> Dados{Dados bem identificados?}
  Dados -->|Sim| Lista[Colar códigos e quantidades ou importar CSV]
  Dados -->|Ainda há dúvida| Apoio[Reunir fotos, desenho e condições de operação]
  Lista --> Revisao[Revisar encontrados, ambiguidades e pendências]
  Revisao --> Exportar[Baixar conferência em CSV]
  Revisao & Apoio --> Atendimento[Levar lista e dúvidas ao atendimento]
  Atendimento --> Confirmacao[Equipe confirma aplicação, material, valores e disponibilidade]
  Confirmacao --> Fim([Reposição confirmada para seguir com a compra])
  classDef entrada fill:#123047,color:#fff,stroke:#123047
  classDef beneficio fill:#e9f5ee,color:#174b32,stroke:#79b695
  class Inicio,Ficha entrada
  class Confirmacao,Fim beneficio
```

```mermaid
mindmap
  root((PK Vedações))
    Produzir
      Indústria e manutenção hidráulica
      Embalagens e máquinas de processo
    Cultivar
      Agricultura e implementos
      Operações florestais
    Construir
      Construção e terraplenagem
      Mineração e beneficiamento
    Movimentar
      Transporte e implementos
      Logística e movimentação
    Sustentar a infraestrutura
      Energia e equipamentos auxiliares
      Saneamento e infraestrutura
```

## Verificação

Cobertura única dos dez segmentos e destinos da jornada em testes de domínio. Navegador CI verifica as três entradas, navegação por teclado, caminhos para guias/catálogo/aplicações, mapa de segmentos, canonical, isolamento de tenant e ausência de overflow em 390 e 1440 px. O controle e as fontes da entrega anterior permanecem preservados.
