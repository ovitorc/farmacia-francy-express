# Concluir catálogo, painel e desempenho

## Objetivo
Entregar a revisão pendente sem remover produtos reais nem alterar o fluxo de compra: corrigir a compilação, ampliar a organização do catálogo e a pesquisa, melhorar a Central de Imagens e acelerar banners e fotos.

## Implementação
1. **Estabilizar o projeto**
   - Restaurar a função administrativa ausente e corrigir os erros de tipos atuais no catálogo.
   - Revisar os fluxos afetados para eliminar falhas de carregamento e ações incoerentes.

2. **Categorias e pesquisa inteligente**
   - Expandir a árvore de categorias e subcategorias com grupos específicos para medicamentos, higiene, bebê, beleza, saúde e conveniência, sem criar uma categoria genérica “Outros”.
   - Centralizar sinônimos, abreviações, singular/plural, finalidades e termos relacionados para evitar divergência entre classificação e pesquisa.
   - Melhorar a relevância para nomes exatos, princípio ativo, fabricante, categoria, subcategoria, finalidade e equivalências.
   - Cobrir os testes pedidos: absorvente/ABS, fraldas, criança, comida, fígado, vômito, gripe, dor de cabeça, azia, gases, vitamina e cabelo.
   - Reduzir leituras desnecessárias do catálogo completo e manter a paginação pública funcional.

3. **Central de Imagens**
   - Manter exatamente 20 produtos por página na lista principal.
   - Preservar o salto direto para qualquer página e adicionar o mesmo recurso ao histórico.
   - Corrigir filtros de subcategoria, estados de imagem quebrada e ações de rejeitar/excluir.
   - Acelerar lotes manuais com no máximo cinco buscas simultâneas, conforme a regra existente.

4. **Banners e imagens mais rápidos**
   - Priorizar somente o primeiro banner visível; carregar os demais sob demanda.
   - Aplicar cache longo e respostas condicionais no servidor de imagens.
   - Enviar imagens dimensionadas e em formato moderno quando o serviço de armazenamento suportar a transformação, mantendo fallback seguro para originais.
   - Manter dimensões reservadas para evitar mudanças bruscas de layout.

5. **Validação**
   - Conferir compilação e erros em execução.
   - Testar página inicial, busca, categoria, Central de Imagens e paginação em telas móvel e desktop.
   - Verificar visualmente banners, cards, estados sem foto e navegação direta entre páginas.

## Limites
- Nenhum produto fictício será criado.
- Nenhum dado comercial real será apagado ou inventado.
- Carrinho, checkout por WhatsApp e administração existente serão preservados.
