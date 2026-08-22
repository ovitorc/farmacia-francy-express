import { queryOptions } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getCatalogo } from "@/lib/catalog.functions";
import { acharCategoria, acharProduto, filtrarBusca, type Catalogo } from "@/lib/catalog";

export const catalogoQueryOptions = queryOptions({
  queryKey: ["catalogo"],
  queryFn: () => getCatalogo(),
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
      getProduto: (id: string) => acharProduto(catalogo.produtos, id),
      buscar: (termo: string) => filtrarBusca(catalogo, termo),
      rasgaPreco: catalogo.produtos.filter((p) => p.rasgaPreco),
    }),
    [catalogo],
  );
}
