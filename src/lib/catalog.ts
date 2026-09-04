export type Subcategory = {
  nome: string;
  slug: string;
};

export type Categoria = {
  nome: string;
  slug: string;
  icone: string;
  subcategorias: Subcategory[];
};

export type Produto = {
  id: string;

  /** Código interno usado no pedido enviado ao WhatsApp */
  codigo: string;

  nome: string;

  /** Slug da categoria */
  categoria: string;

  /** Slug da subcategoria */
  subcategoria: string;

  descricao: string;

  preco: number;

  precoPromocional?: number | undefined;

  imagem?: string | undefined;

  disponivel: boolean;

  oferta: boolean;

  rasgaPreco?: boolean | undefined;

  informacoes?: string[] | undefined;
};

export type Catalogo = {
  categorias: Categoria[];

  produtos: Produto[];

  vitrines?: {
    rasgaPreco: Produto[];
    ofertas: Produto[];
  };
};

/* ============================================================
   CATEGORIAS QUE NÃO DEVEM APARECER NO SITE
   ============================================================ */

export const CATEGORIAS_REMOVIDAS = [
  "pet",
  "pets",
  "produto-para-animais",
  "produtos-para-animais",
  "produtos-para-pet",
  "animais",
];

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

export const slugify = (n: string) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const precoFinal = (p: Produto) => p.precoPromocional ?? p.preco;

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/* ============================================================
   IDENTIFICAÇÃO DE IMAGEM
   ============================================================ */

export function produtoTemImagem(produto: Produto): boolean {
  if (!produto.imagem) {
    return false;
  }

  const imagem = produto.imagem.trim();

  if (!imagem) {
    return false;
  }

  const valor = imagem.toLowerCase();

  if (valor === "null" || valor === "undefined" || valor === "sem imagem" || valor === "sem-imagem") {
    return false;
  }

  return true;
}

/* ============================================================
   VERIFICAR CATEGORIA REMOVIDA
   ============================================================ */

export function categoriaFoiRemovida(slug: string): boolean {
  const categoria = slugify(slug);

  if (CATEGORIAS_REMOVIDAS.includes(categoria)) {
    return true;
  }

  /*
   * Proteção adicional caso o banco utilize um nome diferente
   * para a categoria de produtos para animais.
   */

  return categoria.includes("pet") || categoria.includes("animal");
}

/* ============================================================
   ORDENAR PRODUTOS POR RELEVÂNCIA
   ============================================================ */

/**
 * PRIORIDADE:
 *
 * 1. Produto disponível
 * 2. Produto com imagem
 * 3. Produto em oferta
 * 4. Produto com preço promocional
 * 5. Ordem original
 *
 * IMPORTANTE:
 *
 * Não organizamos alfabeticamente.
 *
 * Produtos que possuem imagem sempre recebem prioridade.
 */

export function ordenarProdutosPorRelevancia(produtos: Produto[]): Produto[] {
  return [...produtos].sort((a, b) => {
    /*
     * DISPONIBILIDADE
     */

    if (a.disponivel !== b.disponivel) {
      return Number(b.disponivel) - Number(a.disponivel);
    }

    /*
     * IMAGEM
     */

    const aTemImagem = produtoTemImagem(a);
    const bTemImagem = produtoTemImagem(b);

    if (aTemImagem !== bTemImagem) {
      return Number(bTemImagem) - Number(aTemImagem);
    }

    /*
     * OFERTA
     */

    if (a.oferta !== b.oferta) {
      return Number(b.oferta) - Number(a.oferta);
    }

    /*
     * PREÇO PROMOCIONAL
     */

    const aTemPromocao = a.precoPromocional !== undefined && a.precoPromocional < a.preco;

    const bTemPromocao = b.precoPromocional !== undefined && b.precoPromocional < b.preco;

    if (aTemPromocao !== bTemPromocao) {
      return Number(bTemPromocao) - Number(aTemPromocao);
    }

    /*
     * Mantém a ordem original do banco quando
     * todos os critérios forem iguais.
     */

    return 0;
  });
}

/* ============================================================
   DADOS DE RELEVÂNCIA DA CATEGORIA
   ============================================================ */

export type RelevanciaCategoria = {
  quantidadeProdutos: number;
  quantidadeComImagem: number;
  percentualComImagem: number;
};

export function calcularRelevanciaCategoria(categoriaSlug: string, produtos: Produto[]): RelevanciaCategoria {
  const produtosDaCategoria = produtos.filter((produto) => produto.categoria === categoriaSlug);

  const quantidadeProdutos = produtosDaCategoria.length;

  const quantidadeComImagem = produtosDaCategoria.filter(produtoTemImagem).length;

  const percentualComImagem = quantidadeProdutos > 0 ? quantidadeComImagem / quantidadeProdutos : 0;

  return {
    quantidadeProdutos,
    quantidadeComImagem,
    percentualComImagem,
  };
}

/* ============================================================
   ORDENAR CATEGORIAS POR RELEVÂNCIA
   ============================================================ */

/**
 * PRIORIDADE DAS CATEGORIAS:
 *
 * 1. Maior quantidade absoluta de produtos COM IMAGEM
 * 2. Maior percentual de produtos COM IMAGEM
 * 3. Maior quantidade total de produtos
 *
 * NÃO EXISTE ORDENAÇÃO ALFABÉTICA.
 */

export function ordenarCategoriasPorRelevancia(categorias: Categoria[], produtos: Produto[]): Categoria[] {
  return [...categorias]
    .filter((categoria) => !categoriaFoiRemovida(categoria.slug))
    .sort((a, b) => {
      const relevanciaA = calcularRelevanciaCategoria(a.slug, produtos);

      const relevanciaB = calcularRelevanciaCategoria(b.slug, produtos);

      /*
       * QUANTIDADE COM IMAGEM
       */

      if (relevanciaA.quantidadeComImagem !== relevanciaB.quantidadeComImagem) {
        return relevanciaB.quantidadeComImagem - relevanciaA.quantidadeComImagem;
      }

      /*
       * PORCENTAGEM COM IMAGEM
       */

      if (relevanciaA.percentualComImagem !== relevanciaB.percentualComImagem) {
        return relevanciaB.percentualComImagem - relevanciaA.percentualComImagem;
      }

      /*
       * QUANTIDADE TOTAL DE PRODUTOS
       */

      if (relevanciaA.quantidadeProdutos !== relevanciaB.quantidadeProdutos) {
        return relevanciaB.quantidadeProdutos - relevanciaA.quantidadeProdutos;
      }

      /*
       * Mantém a ordem original.
       */

      return 0;
    });
}

/* ============================================================
   ORDENAR SUBCATEGORIAS POR RELEVÂNCIA
   ============================================================ */

export function ordenarSubcategoriasPorRelevancia(
  subcategorias: Subcategory[],
  categoriaSlug: string,
  produtos: Produto[],
): Subcategory[] {
  return [...subcategorias].sort((a, b) => {
    const produtosA = produtos.filter(
      (produto) => produto.categoria === categoriaSlug && produto.subcategoria === a.slug,
    );

    const produtosB = produtos.filter(
      (produto) => produto.categoria === categoriaSlug && produto.subcategoria === b.slug,
    );

    const imagensA = produtosA.filter(produtoTemImagem).length;

    const imagensB = produtosB.filter(produtoTemImagem).length;

    /*
     * QUANTIDADE DE PRODUTOS COM IMAGEM
     */

    if (imagensA !== imagensB) {
      return imagensB - imagensA;
    }

    /*
     * PERCENTUAL DE PRODUTOS COM IMAGEM
     */

    const percentualA = produtosA.length > 0 ? imagensA / produtosA.length : 0;

    const percentualB = produtosB.length > 0 ? imagensB / produtosB.length : 0;

    if (percentualA !== percentualB) {
      return percentualB - percentualA;
    }

    /*
     * QUANTIDADE TOTAL
     */

    if (produtosA.length !== produtosB.length) {
      return produtosB.length - produtosA.length;
    }

    /*
     * Mantém a ordem original.
     */

    return 0;
  });
}

/* ============================================================
   FILTRAR PRODUTOS PET
   ============================================================ */

export function removerProdutosDeCategoriasRemovidas(produtos: Produto[]): Produto[] {
  return produtos.filter((produto) => !categoriaFoiRemovida(produto.categoria));
}

/* ============================================================
   LOCALIZAR CATEGORIA
   ============================================================ */

export const acharCategoria = (categorias: Categoria[], slug: string) =>
  categorias.find((categoria) => categoria.slug === slug);

/* ============================================================
   LOCALIZAR PRODUTO
   ============================================================ */

export const acharProduto = (produtos: Produto[], id: string) => produtos.find((produto) => produto.id === id);

/* ============================================================
   BUSCA LOCAL
   ============================================================ */

export function filtrarBusca(catalogo: Catalogo, termo: string): Produto[] {
  const q = slugify(termo.trim());

  if (!q) {
    return [];
  }

  const resultados = catalogo.produtos.filter((produto) => {
    /*
     * Nunca retorna produtos de categorias removidas.
     */

    if (categoriaFoiRemovida(produto.categoria)) {
      return false;
    }

    const categoria = acharCategoria(catalogo.categorias, produto.categoria);

    const subcategoria = categoria?.subcategorias.find((sub) => sub.slug === produto.subcategoria);

    const alvo = slugify(
      `${produto.nome}
           ${produto.codigo}
           ${categoria?.nome ?? ""}
           ${subcategoria?.nome ?? ""}`,
    );

    return q.split("-").every((parte) => alvo.includes(parte));
  });

  return ordenarProdutosPorRelevancia(resultados);
}

/* ============================================================
   LINKS
   ============================================================ */

export const WHATSAPP_URL = "https://wa.me/558321781349";

export const INSTAGRAM_URL = "https://www.instagram.com/farmaciasfrancy/";
