import { queryOptions } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getCatalogo, buscarProdutos, listarProdutos } from "@/lib/catalog.functions";
import { acharCategoria, type Catalogo } from "@/lib/catalog";

export const catalogoQueryOptions = queryOptions({
  queryKey: ["catalogo"],
  queryFn: () => getCatalogo(),
  staleTime: 30_000,
});

export const buscaQueryOptions = (q: string, limite = 60) =>
  queryOptions({
    queryKey: ["busca", q, limite],
    queryFn: () => buscarProdutos({ data: { q, limite } }),
    staleTime: 30_000,
    enabled: q.trim().length > 1,
  });

export const listaQueryOptions = (params: {
  categoria: string;
  sub?: string;
  ordem?: string;
  pagina?: number;
}) =>
  queryOptions({
    queryKey: ["produtos", params],
    queryFn: () => listarProdutos({ data: params }),
    staleTime: 30_000,
  });

const CatalogContext = createContext<Catalogo>({ categorias: [], produtos: [] });

export function CatalogProvider({ value, children }: { value: Catalogo; children: ReactNode }) {
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalogo() {
  const catalogo = useContext(CatalogContext);
  return useMemo(
    () => ({
      ...catalogo,
      getCategoria: (slug: string) => acharCategoria(catalogo.categorias, slug),
      rasgaPreco: catalogo.produtos.filter((p) => p.rasgaPreco),
      ofertas: catalogo.produtos.filter((p) => p.oferta),
      destaques: catalogo.produtos,
    }),
    [catalogo],
  );
}
