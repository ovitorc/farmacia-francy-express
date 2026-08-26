import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { acharCategoria } from "@/lib/catalog";
import { catalogoQueryOptions, listaQueryOptions, useCatalogo } from "@/lib/catalog-context";

type Busca = { sub?: string; ordem?: string; pagina?: number };

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: (raw: Record<string, unknown>): Busca => ({
    sub: typeof raw["sub"] === "string" ? raw["sub"] : "",
    ordem: typeof raw["ordem"] === "string" ? raw["ordem"] : "relevancia",
    pagina: Number(raw["pagina"]) > 1 ? Number(raw["pagina"]) : 1,
  }),
  loader: async ({ params, context }) => {
    const catalogo = await context.queryClient.ensureQueryData(catalogoQueryOptions);
    const categoria = acharCategoria(catalogo.categorias, params.slug);
    if (!categoria) throw notFound();
    return { categoria };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [
          { title: "Categoria não encontrada | Farmácias Francy" },
          { name: "robots", content: "noindex" },
        ],
      };
    const nome = loaderData.categoria.nome;
    const desc = `Confira produtos de ${nome} na Farmácias Francy e peça pelo WhatsApp.`;
    return {
      meta: [
        { title: `${nome} | Farmácias Francy` },
        { name: "description", content: desc },
        { property: "og:title", content: `${nome} | Farmácias Francy` },
        { property: "og:description", content: desc },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <p role="alert" className="p-10 text-center text-sm text-muted-foreground">
      {error.message}
    </p>
  ),
  notFoundComponent: () => (
    <p className="p-10 text-center text-sm text-muted-foreground">Categoria não encontrada.</p>
  ),
  component: CategoriaPage,
});

const ordens = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "menor-preco", rotulo: "Menor preço" },
  { valor: "maior-preco", rotulo: "Maior preço" },
  { valor: "ofertas", rotulo: "Ofertas" },
];

const POR_PAGINA = 40;

function CategoriaPage() {
  const { categoria } = Route.useLoaderData();
  useCatalogo();
  const busca = Route.useSearch();
  const sub = busca.sub ?? "";
  const ordem = busca.ordem ?? "relevancia";
  const pagina = busca.pagina ?? 1;

  const { data, isPending } = useQuery(
    listaQueryOptions({ categoria: categoria.slug, sub, ordem, pagina }),
  );
  const lista = data?.itens ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{" "}
        / {categoria.nome}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">
        <span className="mr-2">{categoria.icone}</span>
        {categoria.nome}
      </h1>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to="/categoria/$slug"
          params={{ slug: categoria.slug }}
          search={{ sub: "", ordem, pagina: 1 }}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            sub === ""
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:border-primary"
          }`}
        >
          Todos
        </Link>
        {categoria.subcategorias.map((s) => (
          <Link
            key={s.slug}
            to="/categoria/$slug"
            params={{ slug: categoria.slug }}
            search={{ sub: s.slug, ordem, pagina: 1 }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              sub === s.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary"
            }`}
          >
            {s.nome}
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <p className="text-xs text-muted-foreground">
          {isPending ? "Carregando..." : `${total} produto(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          {ordens.map((o) => (
            <Link
              key={o.valor}
              to="/categoria/$slug"
              params={{ slug: categoria.slug }}
              search={{ sub, ordem: o.valor, pagina: 1 }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                ordem === o.valor
                  ? "bg-primary-soft font-semibold text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {o.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {lista.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {lista.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              {pagina > 1 && (
                <Link
                  to="/categoria/$slug"
                  params={{ slug: categoria.slug }}
                  search={{ sub, ordem, pagina: pagina - 1 }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary"
                >
                  Anterior
                </Link>
              )}
              <span className="text-xs text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas && (
                <Link
                  to="/categoria/$slug"
                  params={{ slug: categoria.slug }}
                  search={{ sub, ordem, pagina: pagina + 1 }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary"
                >
                  Próxima
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        !isPending && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Ainda não temos produtos cadastrados nesse filtro. Fale com a gente pelo WhatsApp que
            verificamos a disponibilidade.
          </p>
        )
      )}
    </div>
  );
}
