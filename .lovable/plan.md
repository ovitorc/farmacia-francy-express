# Integração do estoque em tempo real — Farmácias Francy

## Objetivo
Substituir o catálogo estático atual (`src/lib/catalog.ts`) por uma fonte de dados conectada ao estoque real da farmácia, mantendo o checkout via WhatsApp e a experiência atual do site.

## Restrições confirmadas pelo usuário
- **Frequência desejada:** tempo real.
- **Infraestrutura preferida:** gratuita/simples.
- **Imagens:** o usuário já possui fotos organizadas dos produtos.
- **Origem dos dados:** ainda indefinida — precisa ser mapeada.

## Observação importante sobre "tempo real"
Tempo real só é viável se o sistema de estoque da farmácia conseguir **avisar** o site quando houver mudança (API ou webhook). Se a origem for apenas uma planilha/CSV estático, a melhor alternativa gratuita é sincronização automática a cada poucos minutos.

## Fase 1 — Mapear a origem e prova de conceito (1-2 dias)

### 1.1 Descobrir a origem dos dados
Levantar junto ao usuário:
- O estoque fica em planilha (Excel/Google Sheets), sistema ERP/PDV, ou banco SQL?
- O sistema atual tem API, webhook, exportação automática ou apenas arquivo manual?
- Quais colunas existem? (código interno, descrição, estoque, preço, disponibilidade por loja, etc.)

### 1.2 Prova de conceito com Google Sheets (gratuito)
Caso a origem seja uma planilha ou possa ser convertida para Google Sheets:
- Publicar a planilha como CSV/JSON.
- Criar uma função servidor (`createServerFn`) que baixa e processa os dados.
- Criar rotina de sincronização automática a cada 5 minutos (via cron externo ou revalidação no acesso).
- Importar os produtos para uma tabela local/cache no Lovable Cloud (gratuito, com limites).

### 1.3 Estrutura de dados no site
Criar/especializar tabelas para:
- `categories` — nome, slug, ícone.
- `products` — código interno, nome, descrição, categoria, preço, preço promocional, imagem, disponibilidade.
- `stores` — nome, slug, endereço/telefone.
- `stock_by_store` — produto + loja + quantidade em estoque.

### 1.4 Ajustes no front-end
- Substituir a leitura de `produtos` estático por consulta ao banco/cache.
- Adicionar seletor de loja no cabeçalho e nas páginas de produto.
- Exibir "Disponível em X lojas" ou "Esgotado na loja selecionada".
- Manter o carrinho e checkout via WhatsApp intactos.

## Fase 2 — Tempo real, se o sistema permitir

### 2.1 Opção A: Webhook do ERP
Se o ERP/PDV tiver webhook:
- Criar rota pública `/api/public/webhooks/estoque`.
- Receber eventos de alteração de estoque/preço.
- Atualizar a tabela no Lovable Cloud imediatamente.

### 2.2 Opção B: API do ERP
Se o ERP tiver API aberta:
- Criar função servidor que consulta a API diretamente.
- Cache curto (segundos/minutos) para manter o site rápido.

### 2.3 Opção C: Google Sheets + polling
Se não houver API/webhook:
- Manter a sincronização periódica (a cada 1-5 minutos).
- Adicionar botão/manual "Atualizar estoque" no painel administrativo simples.

## Fase 3 — Imagens e refinamento
- Subir as fotos dos produtos para o storage do Lovable Cloud ou CDN.
- Associar cada produto à sua imagem pelo código interno.
- Revisar responsividade e performance com catálogo maior.

## Entregáveis
1. Banco de dados no Lovable Cloud com produtos, lojas e estoque por loja.
2. Script de importação a partir de Google Sheets/CSV.
3. Front-end lendo do banco com seletor de loja.
4. Documentação simples de como o usuário atualiza o estoque.

## Próximo passo imediato
O usuário precisa informar:
- Onde está o banco de dados de estoque hoje (planilha, ERP, SQL, etc.).
- Se o sistema atual permite exportação automática, API ou webhook.
- Uma amostra pequena dos dados (5-10 produtos) para testarmos a importação.
