# Módulo administrativo “Classes”

## Objetivo
Dar ao administrador controle manual e seguro sobre a categoria e a subcategoria oficiais de todos os produtos, mantendo a pesquisa inteligente separada da organização do catálogo.

## Situação confirmada
- O banco já possui `categorias`, `subcategorias` e `produtos`; não serão criadas tabelas duplicadas.
- Existem 14 categorias, 65 subcategorias e 6.602 produtos. Dez produtos estão sem subcategoria; não há referências atuais a categorias ou subcategorias inexistentes.
- `produtos.categoria_slug` já possui relação com categorias, mas a subcategoria ainda não possui uma relação direta que impeça combinações incompatíveis.
- O catálogo público usa uma árvore fixa no código e, nas categorias exibidas no site, reclassifica produtos por palavras do nome/descrição. Essa é a origem dos falsos positivos.
- O painel já possui autenticação, verificação de administrador, consultas protegidas e paginação de 20 itens, que serão reutilizadas.
- O banco não possui um campo separado e confiável para “código original”; será criado como opcional, sem inventar valores para produtos existentes.

## Implementação

### 1. Integridade e migração do banco
- Reutilizar as três tabelas existentes e evoluí-las, sem apagar ou recriar produtos.
- Adicionar identificador estável e data de atualização às categorias; relacionar subcategorias à categoria por identificador.
- Adicionar aos produtos as referências oficiais de categoria e subcategoria, além de `codigo_original` opcional.
- Migrar as 6.602 classificações atuais para as novas referências; manter os slugs existentes para URLs e compatibilidade durante a transição.
- Criar uma restrição composta para garantir que a subcategoria escolhida pertença à categoria escolhida.
- Permitir categoria/subcategoria vazias para o fluxo de “sem classificação”, sem alterar código, descrição, preço, estoque ou demais dados do produto.
- Impedir nomes e slugs duplicados, com comparação sem diferença entre maiúsculas/minúsculas.
- Adicionar índices para paginação, filtros e pesquisa administrativa por código, código original, nome/descrição e marca.
- Manter leitura pública do catálogo e escrita somente para administradores, seguindo as permissões existentes.

### 2. Funções administrativas protegidas
Criar operações protegidas por login e papel de administrador para:
- listar produtos com paginação, pesquisa combinada e filtros;
- retornar contadores de sem categoria, sem subcategoria e classificação completa;
- listar categorias/subcategorias com quantidade real de produtos;
- salvar a classificação individual;
- classificar vários IDs selecionados;
- classificar todos os resultados de um filtro, recalculando o filtro no servidor antes de atualizar;
- criar e renomear categorias e subcategorias;
- excluir somente registros sem produtos vinculados, retornando uma mensagem clara quando houver vínculo.

Todas as alterações validarão categoria e subcategoria no servidor. Nenhum identificador de usuário ou permissão será aceito do navegador.

### 3. Nova página “Classes”
- Criar `/classes` dentro da área administrativa protegida e adicionar acesso visível no painel e na área de imagens.
- Usar tabela de 20 produtos por página com: seleção, imagem, código interno, código original quando existir, descrição/nome, marca, categoria, subcategoria, preço, disponibilidade e ações.
- Pesquisa por código interno, código original, código de barras, nome/descrição, marca, categoria e subcategoria.
- Filtros combináveis: categoria, subcategoria, sem categoria, sem subcategoria e classificação completa.
- Paginação completa: primeira, anterior, números próximos, próxima, última e campo para ir diretamente a uma página.
- Interface adaptada para celular, preservando a leitura e as ações essenciais.

### 4. Edição individual e gerenciamento das classes
- Modal “Editar classificação” com categoria e subcategoria dependentes.
- Ao trocar a categoria, limpar uma subcategoria incompatível e exigir uma escolha válida antes de salvar quando necessário.
- Permitir criar categoria ou subcategoria sem sair do fluxo de edição.
- Incluir área própria para adicionar, renomear e excluir categorias/subcategorias, exibindo a quantidade de produtos em cada uma.
- Renomear somente o nome visível; manter o identificador/slug estável para não quebrar produtos nem URLs.

### 5. Classificação em massa
- Checkbox por produto, seleção de todos os itens da página e seleção de todos os resultados filtrados.
- Manter a seleção entre páginas quando o modo for por IDs.
- Exibir quantidade afetada e exigir confirmação antes da atualização.
- Para “todos os resultados”, enviar os filtros ao servidor em vez de milhares de IDs; o servidor valida novamente o conjunto e aplica somente categoria/subcategoria.
- Após concluir, atualizar tabela, contadores, filtros e catálogo público imediatamente.

### 6. Catálogo oficial separado da pesquisa
- Carregar a árvore pública de categorias/subcategorias do banco, eliminando a dependência da estrutura fixa para navegação.
- Listagens por categoria e subcategoria consultarão exclusivamente as referências oficiais armazenadas no produto.
- Remover a reclassificação textual do caminho das páginas de categoria e dos produtos relacionados.
- Manter nome, descrição, marca, princípio ativo, sinônimos e termos equivalentes na pesquisa inteligente do cliente.
- A pesquisa poderá encontrar “perfume” em um desodorante, mas esse produto continuará pertencendo apenas à categoria/subcategoria definida pelo administrador.

### 7. Verificação
- Conferir migração: totais antes/depois, nenhuma perda de produto e nenhuma alteração em dados fora da classificação.
- Testar criação, renomeação, bloqueio de exclusão com vínculos e prevenção de categoria/subcategoria incompatíveis.
- Testar edição individual, seleção da página e todos os resultados filtrados.
- Validar pesquisa + filtros + salto de página em desktop e celular.
- Confirmar no catálogo o caso “Desodorante ... Perfume”: encontrado pela pesquisa textual, mas exibido somente na categoria oficial.
- Verificar permissões com administrador e usuário não autorizado, além da compilação e dos erros do navegador.

## Decisões de segurança e preservação
- Nenhuma classificação será recriada automaticamente a partir da descrição durante a migração; as classificações atuais serão preservadas como ponto de partida.
- Nenhum produto será apagado.
- Exclusões de categorias/subcategorias com produtos vinculados serão bloqueadas, evitando perda silenciosa de classificação.
- O novo campo de código original ficará vazio nos registros em que a origem não puder ser comprovada.
