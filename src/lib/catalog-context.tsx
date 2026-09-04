import { queryOptions } from "@tanstack/react-query";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { getCatalogo, buscarProdutos, listarProdutos, obterProduto } from "@/lib/catalog.functions";

import {
  acharCategoria,
  categoriaFoiRemovida,
  ordenarCategoriasPorRelevancia,
  ordenarProdutosPorRelevancia,
  removerProdutosDeCategoriasRemovidas,
  type Catalogo,
} from "@/lib/catalog";

/* ============================================================
   QUERY PRINCIPAL DO CATÁLOGO
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

export const listaQueryOptions = (params: { categoria: string; sub?: string; ordem?: string; pagina?: number }) =>
  queryOptions({
    queryKey: ["produtos", params],

    queryFn: () =>
      listarProdutos({
        data: params,
      }),

    staleTime: 30_000,

    /*
     * Não faz consulta para categorias removidas.
     */

    enabled: !categoriaFoiRemovida(params.categoria),
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
   HOOK PRINCIPAL DO CATÁLOGO
   ============================================================ */

export function useCatalogo() {
  const catalogo = useContext(CatalogContext);

  return useMemo(() => {
    /*
     * ========================================================
     * REMOVER PRODUTOS PET
     * ========================================================
     */

    const produtosPermitidos = removerProdutosDeCategoriasRemovidas(catalogo.produtos);

    /*
     * ========================================================
     * ORDENAR TODOS OS PRODUTOS
     * ========================================================
     *
     * Produtos com imagem aparecem primeiro.
     */

    const produtosOrdenados = ordenarProdutosPorRelevancia(produtosPermitidos);

    /*
     * ========================================================
     * ORDENAR CATEGORIAS
     * ========================================================
     *
     * Categorias com mais produtos com imagem
     * aparecem primeiro.
     */

    const categoriasOrdenadas = ordenarCategoriasPorRelevancia(catalogo.categorias, produtosOrdenados);

    /*
     * ========================================================
     * RASGA PREÇO
     * ========================================================
     */

    const rasgaPrecoOriginal =
      catalogo.vitrines?.rasgaPreco ?? produtosOrdenados.filter((produto) => produto.rasgaPreco);

    const rasgaPreco = ordenarProdutosPorRelevancia(removerProdutosDeCategoriasRemovidas(rasgaPrecoOriginal));

    /*
     * ========================================================
     * OFERTAS
     * ========================================================
     */

    const ofertasOriginal = catalogo.vitrines?.ofertas ?? produtosOrdenados.filter((produto) => produto.oferta);

    const ofertas = ordenarProdutosPorRelevancia(removerProdutosDeCategoriasRemovidas(ofertasOriginal));

    /*
     * ========================================================
     * DESTAQUES
     * ========================================================
     *
     * Também obedecem à prioridade visual.
     */

    const destaques = ordenarProdutosPorRelevancia(produtosOrdenados);

    /*
     * ========================================================
     * RETORNO
     * ========================================================
     */

    return {
      ...catalogo,

      categorias: categoriasOrdenadas,

      produtos: produtosOrdenados,

      getCategoria: (slug: string) => acharCategoria(categoriasOrdenadas, slug),

      rasgaPreco,

      ofertas,

      destaques,
    };
  }, [catalogo]);
}
