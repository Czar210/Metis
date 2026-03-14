---
aliases:
  - Embedding
  - Embeddings
---
É a transformação matemática de um texto (como um guia de campeão) em uma lista de números (vetores). No Metis, usamos isso para que o banco de dados (pgvector) e a IA consigam calcular a distância e a semelhança entre as palavras, permitindo encontrar as dicas exatas sobre um *matchup* sem depender da correspondência exata de letras.