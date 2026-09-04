import { queryOptions } from "@tanstack/react-query";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getCatalogo, buscarProdutos, listarProdutos, obterProduto } from "@/lib/catalog.functions";

import {
  acharCategoria,
  ordenarCategoriasPorRelevancia,
  ordenarProdutosPorRelevancia,
  type Catalogo,
} from "@/lib/catalog";

/* ============================================================
   CATÁLOGO
   ============================================================ */

export const catalogoQueryOptions = queryOptions({
  queryKey: ["catalogo"],

  queryFn: () => getCatalogo(),

  staleTime: 30_000,
});

/* ============================================================
   BUSCA
   ============================================================ */

export const buscaQueryOptions = (q: string, limite = 60) =>
  queryOptions({
    queryKey: ["busca", q, limite],

    queryFn: () =>
      buscarProdutos({
        data: {
          q,
          limite,
        },
      }),

    staleTime: 30_000,

    enabled: q.trim().length > 1,
  });

/* ============================================================
   PRODUTO INDIVIDUAL
   ============================================================ */

export const produtoQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["produto", id],

    queryFn: () =>
      obterProduto({
        data: {
          id,
        },
      }),

    staleTime: 30_000,
  });

/* ============================================================
   LISTAGEM DE PRODUTOS
   ============================================================ */

export const listaQueryOptions = (params: {
  categoria: string;

  sub?: string;

  ordem?: string;

  pagina?: number;
}) =>
  queryOptions({
    queryKey: ["produtos", params],

    queryFn: () =>
      listarProdutos({
        data: params,
      }),

    staleTime: 30_000,
  });

/* ============================================================
   CONTEXTO
   ============================================================ */

const CatalogContext = createContext<Catalogo>({
  categorias: [],
  produtos: [],
});

/* ============================================================
   PROVIDER
   ============================================================ */

export function CatalogProvider({ value, children }: { value: Catalogo; children: ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

/* ============================================================
   HOOK PRINCIPAL
   ============================================================ */

export function useCatalogo() {
  const catalogo = useContext(CatalogContext);

  return useMemo(() => {
    /**
     * ========================================================
     * PRODUTOS
     * ========================================================
     *
     * Todo produto disponível no catálogo passa pela
     * ordenação de relevância.
     */

    const produtosOrdenados = ordenarProdutosPorRelevancia(catalogo.produtos);

    /**
     * ========================================================
     * CATEGORIAS
     * ========================================================
     *
     * Categorias são organizadas de acordo com:
     *
     * quantidade de produtos que possuem imagem.
     */

    const categoriasOrdenadas = ordenarCategoriasPorRelevancia(catalogo.categorias, produtosOrdenados);

    /**
     * ========================================================
     * RASGA PREÇO
     * ========================================================
     */

    const rasgaPreco = ordenarProdutosPorRelevancia(
      catalogo.vitrines?.rasgaPreco ?? produtosOrdenados.filter((p) => p.rasgaPreco),
    );

    /**
     * ========================================================
     * OFERTAS
     * ========================================================
     */

    const ofertas = ordenarProdutosPorRelevancia(
      catalogo.vitrines?.ofertas ?? produtosOrdenados.filter((p) => p.oferta),
    );

    /**
     * ========================================================
     * DESTAQUES
     * ========================================================
     */

    const destaques = ordenarProdutosPorRelevancia(produtosOrdenados);

    return {
      ...catalogo,

      /**
       * Categorias agora NÃO seguem ordem alfabética.
       */
      categorias: categoriasOrdenadas,

      /**
       * Produtos globais já organizados.
       */
      produtos: produtosOrdenados,

      getCategoria: (slug: string) => acharCategoria(categoriasOrdenadas, slug),

      rasgaPreco,

      ofertas,

      destaques,
    };
  }, [catalogo]);
}
