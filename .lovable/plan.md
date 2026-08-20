# Integrar banco de dados real de produtos ao site Farmácias Francy

## Objetivo
Substituir o catálogo demonstrativo estático por dados reais vindos de uma planilha/banco, mantendo o checkout via WhatsApp e adicionando controle de disponibilidade por loja/filial.

## Decisões assumidas
- Formato de entrada: **planilha CSV/Excel** com colunas padronizadas (código, nome, descrição, preço, preço promocional, estoque, categoria, subcategoria, filiais).
- Disponibilidade: **por loja/filial** — o produto pode estar disponível em uma unidade e indisponível em outra.
- Imagens: **mistas** — produtos com foto usarão a imagem enviada; os demais usarão placeholder com nome resumido.
- Backend: **Lovable Cloud** para persistência e atualização dos dados sem rebuild manual.

## Etapas

### 1. Preparação do backend
- Habilitar Lovable Cloud no projeto.
- Criar migration SQL com as tabelas:
  - `categorias` (nome, slug, ícone, ordem)
  - `subcategorias` (nome, slug, categoria_id)
  - `produtos` (código interno, nome, descrição, preço, preço_promocional, imagem, categoria_id, subcategoria_id, ativo)
  - `lojas` (nome, slug, endereço, telefone, ativo)
  - `estoque_por_loja` (produto_id, loja_id, quantidade, disponivel)
- Aplicar GRANTs, RLS e políticas de acesso (leitura pública para produtos ativos, escrita restrita a service_role/admin).

### 2. Importação inicial dos dados
- Receber e validar a planilha enviada pelo usuário.
- Criar script one-off (seguro, server-only) que:
  - Normaliza nomes para slugs.
  - Cria categorias/subcategorias ausentes.
  - Insere/atualiza produtos.
  - Popula estoque_por_loja com as filiais informadas.
- Executar a importação e reportar quantidade de produtos, categorias e lojas carregadas.

### 3. Refatorar o catálogo para usar o banco
- Criar server functions para:
  - Listar categorias e subcategorias.
  - Listar produtos (com filtros por categoria, subcategoria, oferta, busca textual, paginação).
  - Buscar produto por ID.
  - Consultar disponibilidade por loja para um produto.
- Atualizar `src/lib/catalog.ts` para exportar tipos e helpers, mas remover o array estático de produtos.
- Adaptar `useCart` para buscar produtos via API em vez do array estático.

### 4. Ajustes de UI/UX
- Adicionar seletor de loja/filial no cabeçalho ou na página de produto.
- Exibir "Disponível em: [lojas]" no card e na página de detalhe.
- Esconder ou desabilitar o botão "Adicionar ao carrinho" quando o produto estiver indisponível na loja selecionada.
- Manter o carrossel "Rasga Preço" alimentado por produtos com preço promocional ativo.

### 5. SEO e metadados
- Garantir que as rotas de produto e categoria continuem gerando `head()` dinâmico com título, descrição e OG tags baseados nos dados do banco.

### 6. Validação
- Rodar build e verificar se não há erros.
- Testar navegação: home, categoria, busca, produto, carrinho.
- Verificar se a mensagem do WhatsApp ainda inclui código interno, quantidade e total.

## Entregáveis
- Banco de dados no Lovable Cloud com produtos, categorias, lojas e estoque.
- Site lendo os dados em tempo real.
- Painel/admin simplificado via SQL ou futura tela de gestão (fora do escopo inicial).
- Documento curto explicando como enviar novas planilhas para atualização.

## Fora do escopo inicial
- Tela administrativa própria para editar produtos (pode ser feito depois).
- Sincronização automática contínua com outro sistema (será importação manual via planilha).
- Controle de pedidos/pagamentos online (mantém checkout via WhatsApp).
