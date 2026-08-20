# Painel de administração da Farmácias Francy

Objetivo: você mesmo cadastrar, editar e remover produtos (com foto, descrição, preço, promoção e disponibilidade) por uma área com login, sem mexer no código e sem desconfigurar o layout do site.

## Como vai funcionar para você

1. Acessa `/admin` e faz login com seu e-mail e senha.
2. Vê a lista de todos os produtos com busca e filtro por categoria.
3. Botão "Novo produto" abre um formulário: nome, código interno, categoria, subcategoria, descrição, preço, preço promocional, disponível (sim/não), oferta, "Rasga Preço" e envio da foto (arrasta ou seleciona o arquivo).
4. Salvou, o produto aparece imediatamente no site, já dentro do mesmo card padrão — a estrutura visual não muda, só entra mais um item na vitrine.
5. Também dá para editar, despublicar e excluir produtos existentes.
6. Você continua podendo me pedir no chat para cadastrar algo, se preferir.

Somente contas marcadas como administrador conseguem entrar. Visitantes comuns nem enxergam essa área.

## Etapas da implementação

**1. Ativar o Lovable Cloud** (banco de dados, login e armazenamento de imagens, tudo integrado).

**2. Banco de dados**
- `categorias` e `subcategorias` (migradas das 14 categorias já existentes no site).
- `produtos`: código interno, nome, descrição, categoria, subcategoria, preço, preço promocional, disponível, oferta, rasga_preço, imagem, ordem, datas.
- `user_roles` (tabela separada) + função `has_role` para o papel de administrador.
- Bucket público `produtos` para as fotos.
- Leitura pública dos produtos (anon, somente SELECT); escrita apenas para administrador.
- Migração já leva os ~45 produtos atuais e as imagens existentes, para nada sumir do ar.

**3. Site lendo do banco**
- Home, categorias, busca, página do produto e Rasga Preço passam a buscar do banco via funções de servidor públicas (SSR mantido, sem perda de SEO).
- Carrinho e checkout pelo WhatsApp continuam iguais, incluindo o código interno na mensagem.
- `src/lib/catalog.ts` fica apenas com os tipos e utilitários.

**4. Área administrativa**
- `/auth`: login por e-mail e senha.
- `/admin` protegido: lista de produtos com busca, filtro e ações.
- `/admin/produtos/novo` e `/admin/produtos/:id`: formulário com validação (zod) e upload de imagem com pré-visualização.
- Gerenciamento simples de categorias/subcategorias.
- Mesmo visual do site: azul #1b2268, vermelho #ef1925, branco.

**5. Verificação**
- Criar sua conta de administrador.
- Testar no navegador: cadastrar produto novo com foto, conferir na home/categoria/busca, adicionar ao carrinho e gerar o pedido no WhatsApp.
- Conferir responsividade no celular.

## Detalhes técnicos

- Papéis em tabela separada com função `security definer` (`has_role`), nunca no perfil do usuário, para evitar escalonamento de privilégio.
- RLS ativa em todas as tabelas, com GRANTs explícitos: SELECT para `anon` nas tabelas públicas de catálogo; INSERT/UPDATE/DELETE só via política que exige `has_role(auth.uid(), 'admin')`.
- Leituras públicas via cliente publishable dentro de `createServerFn`; escritas via `createServerFn` com `requireSupabaseAuth` e checagem de papel.
- Rotas de admin sob `src/routes/_authenticated/` e verificação de papel de administrador dentro das funções de servidor.
- Upload das imagens direto para o Storage, guardando a URL pública no produto.

## Observação

O cadastro de novos administradores será feito por mim (ou por você, pelo painel, se quiser que eu inclua essa tela) — não haverá cadastro aberto ao público.
