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

  /** slug da categoria */
  categoria: string;

  /** slug da subcategoria */
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
   CATEGORIAS REMOVIDAS DO SITE
   ============================================================ */

/**
 * Qualquer categoria que represente produtos para animais
 * não será exibida no catálogo.
 */
export const CATEGORIAS_REMOVIDAS = ["pet", "pets", "produto-para-animais", "produtos-para-animais", "animais"];

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
   DETECTAR IMAGEM VÁLIDA
   ============================================================ */

/**
 * Um produto é considerado como tendo imagem apenas quando
 * existe uma URL ou caminho válido.
 */
export function produtoTemImagem(produto: Produto): boolean {
  const imagem = produto.imagem?.trim();

  if (!imagem) {
    return false;
  }

  /**
   * Evita considerar textos vazios ou valores inválidos
   * como imagem.
   */
  const imagemNormalizada = imagem.toLowerCase();

  if (imagemNormalizada === "null" || imagemNormalizada === "undefined" || imagemNormalizada === "sem-imagem") {
    return false;
  }

  return true;
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
 * 4. Nome
 *
 * O objetivo principal é garantir que produtos com imagens
 * apareçam antes dos produtos sem imagens.
 */
export function ordenarProdutosPorRelevancia(produtos: Produto[]): Produto[] {
  return [...produtos].sort((a, b) => {
    /* ========================================================
       DISPONIBILIDADE
       ======================================================== */

    if (a.disponivel !== b.disponivel) {
      return Number(b.disponivel) - Number(a.disponivel);
    }

    /* ========================================================
       IMAGEM
       ======================================================== */

    const aTemImagem = produtoTemImagem(a);
    const bTemImagem = produtoTemImagem(b);

    if (aTemImagem !== bTemImagem) {
      return Number(bTemImagem) - Number(aTemImagem);
    }

    /* ========================================================
       OFERTA
       ======================================================== */

    if (a.oferta !== b.oferta) {
      return Number(b.oferta) - Number(a.oferta);
    }

    /* ========================================================
       NOME
       ======================================================== */

    return a.nome.localeCompare(b.nome, "pt-BR", {
      sensitivity: "base",
    });
  });
}

/* ============================================================
   ORDENAR CATEGORIAS POR RELEVÂNCIA
   ============================================================ */

/**
 * A categoria mais relevante será aquela que possui:
 *
 * 1. Maior quantidade de produtos COM IMAGEM
 * 2. Maior porcentagem de produtos COM IMAGEM
 * 3. Maior quantidade total de produtos
 *
 * NÃO utiliza ordem alfabética.
 */
export function ordenarCategoriasPorRelevancia(categorias: Categoria[], produtos: Produto[]): Categoria[] {
  return [...categorias].sort((a, b) => {
    const produtosA = produtos.filter((produto) => produto.categoria === a.slug);

    const produtosB = produtos.filter((produto) => produto.categoria === b.slug);

    /* ========================================================
       QUANTIDADE DE PRODUTOS COM IMAGEM
       ======================================================== */

    const imagensA = produtosA.filter(produtoTemImagem).length;

    const imagensB = produtosB.filter(produtoTemImagem).length;

    if (imagensA !== imagensB) {
      return imagensB - imagensA;
    }

    /* ========================================================
       PORCENTAGEM DE PRODUTOS COM IMAGEM
       ======================================================== */

    const percentualA = produtosA.length > 0 ? imagensA / produtosA.length : 0;

    const percentualB = produtosB.length > 0 ? imagensB / produtosB.length : 0;

    if (percentualA !== percentualB) {
      return percentualB - percentualA;
    }

    /* ========================================================
       QUANTIDADE TOTAL DE PRODUTOS
       ======================================================== */

    if (produtosA.length !== produtosB.length) {
      return produtosB.length - produtosA.length;
    }

    /**
     * Mantém a ordem original cadastrada no banco em caso
     * de empate completo.
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

    if (imagensA !== imagensB) {
      return imagensB - imagensA;
    }

    const percentualA = produtosA.length > 0 ? imagensA / produtosA.length : 0;

    const percentualB = produtosB.length > 0 ? imagensB / produtosB.length : 0;

    if (percentualA !== percentualB) {
      return percentualB - percentualA;
    }

    if (produtosA.length !== produtosB.length) {
      return produtosB.length - produtosA.length;
    }

    return 0;
  });
}

/* ============================================================
   LOCALIZAR CATEGORIA
   ============================================================ */

export const acharCategoria = (categorias: Categoria[], slug: string) => categorias.find((c) => c.slug === slug);

export const acharProduto = (produtos: Produto[], id: string) => produtos.find((p) => p.id === id);

/* ============================================================
   BUSCA LOCAL
   ============================================================ */

export function filtrarBusca(catalogo: Catalogo, termo: string): Produto[] {
  const q = slugify(termo.trim());

  if (!q) {
    return [];
  }

  const resultados = catalogo.produtos.filter((p) => {
    const c = acharCategoria(catalogo.categorias, p.categoria);

    const sub = c?.subcategorias.find((x) => x.slug === p.subcategoria);

    const alvo = slugify(`${p.nome} ${p.codigo} ${c?.nome ?? ""} ${sub?.nome ?? ""}`);

    return q.split("-").every((parte) => alvo.includes(parte));
  });

  return ordenarProdutosPorRelevancia(resultados);
}

/* ============================================================
   LINKS
   ============================================================ */

export const WHATSAPP_URL = "https://wa.me/558321781349";

export const INSTAGRAM_URL = "https://www.instagram.com/farmaciasfrancy/";
