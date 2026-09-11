import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { ProductCard } from "@/components/ProductCard";

import { acharCategoria, categoriaFoiRemovida } from "@/lib/catalog";

import { catalogoQueryOptions, listaQueryOptions } from "@/lib/catalog-context";

/* ============================================================
   TIPO DA BUSCA DA URL
   ============================================================ */

type Busca = {
  sub?: string;
  sub2?: string;
  ordem?: string;
  pagina?: number;
};

/* ============================================================
   ROTA
   ============================================================ */

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: (raw: Record<string, unknown>): Busca => ({
    sub: typeof raw["sub"] === "string" ? raw["sub"] : "",

    sub2: typeof raw["sub2"] === "string" ? raw["sub2"] : "",

    ordem: typeof raw["ordem"] === "string" ? raw["ordem"] : "relevancia",

    pagina: Number(raw["pagina"]) > 1 ? Number(raw["pagina"]) : 1,
  }),

  /*
   * ========================================================
   * LOADER
   * ========================================================
   */

  loader: async ({ params, context }) => {
    /*
     * Bloqueia completamente
     * a página da categoria Pet.
     */

    if (categoriaFoiRemovida(params.slug)) {
      throw notFound();
    }

    const catalogo = await context.queryClient.ensureQueryData(catalogoQueryOptions);

    const categoria = acharCategoria(catalogo.categorias, params.slug);

    /*
     * Categoria inexistente.
     */

    if (!categoria) {
      throw notFound();
    }

    return {
      categoria,
    };
  },

  /*
   * ========================================================
   * SEO
   * ========================================================
   */

  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          {
            title: "Categoria não encontrada | Farmácias Francy",
          },
          {
            name: "robots",

            content: "noindex",
          },
        ],
      };
    }

    const nome = loaderData.categoria.nome;

    const descricao = `Confira produtos de ${nome} na Farmácias Francy e peça pelo WhatsApp.`;

    return {
      meta: [
        {
          title: `${nome} | Farmácias Francy`,
        },
        {
          name: "description",

          content: descricao,
        },
        {
          property: "og:title",

          content: `${nome} | Farmácias Francy`,
        },
        {
          property: "og:description",

          content: descricao,
        },
      ],
    };
  },

  /*
   * ========================================================
   * ERRO
   * ========================================================
   */

  errorComponent: ({ error }) => (
    <p role="alert" className="p-10 text-center text-sm text-muted-foreground">
      {error.message}
    </p>
  ),

  /*
   * ========================================================
   * NÃO ENCONTRADO
   * ========================================================
   */

  notFoundComponent: () => <p className="p-10 text-center text-sm text-muted-foreground">Categoria não encontrada.</p>,

  component: CategoriaPage,
});

/* ============================================================
   OPÇÕES DE ORDENAÇÃO
   ============================================================ */

const ordens = [
  {
    valor: "relevancia",

    rotulo: "Mais relevantes",
  },
  {
    valor: "menor-preco",

    rotulo: "Menor preço",
  },
  {
    valor: "maior-preco",

    rotulo: "Maior preço",
  },
  {
    valor: "ofertas",

    rotulo: "Ofertas",
  },
];

/* ============================================================
   PAGINAÇÃO
   ============================================================ */

const POR_PAGINA = 40;

/* ============================================================
   COMPONENTE
   ============================================================ */

function CategoriaPage() {
  const { categoria } = Route.useLoaderData();

  const busca = Route.useSearch();

  const sub = busca.sub ?? "";

  const sub2 = busca.sub2 ?? "";

  const ordem = busca.ordem ?? "relevancia";

  const pagina = busca.pagina ?? 1;

  /*
   * ==========================================================
   * CONSULTA
   * ==========================================================
   */

  const { data, isPending } = useQuery(
    listaQueryOptions({
      categoria: categoria.slug,

      sub,

      sub2,

      ordem,

      pagina,
    }),
  );

  const lista = data?.itens ?? [];

  const total = data?.total ?? 0;

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /*
   * ==========================================================
   * TELA
   * ==========================================================
   */

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* ======================================================
          NAVEGAÇÃO
          ====================================================== */}

      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>

        {" / "}

        {categoria.nome}
      </p>

      {/* ======================================================
          TÍTULO
          ====================================================== */}

      <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">
        <span className="mr-2">{categoria.icone}</span>

        {categoria.nome}
      </h1>

      {/* ======================================================
          INFORMAÇÃO DE RELEVÂNCIA
          ====================================================== */}

      <p className="mt-2 text-xs text-muted-foreground">
        Produtos com imagem aparecem primeiro para facilitar sua visualização.
      </p>

      {/* ======================================================
          SUBCATEGORIAS
          ====================================================== */}

      <div className="mt-5 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/categoria/$slug"
            params={{ slug: categoria.slug }}
            search={{ sub: "", sub2: "", ordem, pagina: 1 }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              sub === "" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
            }`}
          >
            Todos
          </Link>

          {categoria.subcategorias.map((grupo) => (
            <Link
              key={grupo.slug}
              to="/categoria/$slug"
              params={{ slug: categoria.slug }}
              search={{ sub: grupo.slug, sub2: "", ordem, pagina: 1 }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                sub === grupo.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary"
              }`}
            >
              {grupo.nome}
            </Link>
          ))}
        </div>

        {sub && categoria.subcategorias.find((grupo) => grupo.slug === sub)?.subcategorias?.length ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Refine por:</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/categoria/$slug"
                params={{ slug: categoria.slug }}
                search={{ sub, sub2: "", ordem, pagina: 1 }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  sub2 === "" ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-primary"
                }`}
              >
                Todos
              </Link>
              {categoria.subcategorias
                .find((grupo) => grupo.slug === sub)
                ?.subcategorias?.map((item) => (
                  <Link
                    key={item.slug}
                    to="/categoria/$slug"
                    params={{ slug: categoria.slug }}
                    search={{ sub, sub2: item.slug, ordem, pagina: 1 }}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      sub2 === item.slug
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {item.nome}
                  </Link>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* ======================================================
          BARRA DE RESULTADOS
          ====================================================== */}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <p className="text-xs text-muted-foreground">{isPending ? "Carregando produtos..." : `${total} produto(s)`}</p>

        <div className="flex flex-wrap gap-2">
          {ordens.map((opcao) => (
            <Link
              key={opcao.valor}
              to="/categoria/$slug"
              params={{
                slug: categoria.slug,
              }}
              search={{
                sub,
                sub2,
                ordem: opcao.valor,

                pagina: 1,
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                ordem === opcao.valor
                  ? "bg-primary-soft font-semibold text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              {opcao.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {/* ======================================================
          LISTAGEM
          ====================================================== */}

      {isPending ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Carregando produtos...</div>
      ) : lista.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {lista.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </div>

          {/* ==================================================
              PAGINAÇÃO
              ================================================== */}

          {totalPaginas > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              {pagina > 1 && (
                <Link
                  to="/categoria/$slug"
                  params={{
                    slug: categoria.slug,
                  }}
                  search={{
                    sub,
                    sub2,
                    ordem,
                    pagina: pagina - 1,
                  }}
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
                  params={{
                    slug: categoria.slug,
                  }}
                  search={{
                    sub,
                    sub2,
                    ordem,
                    pagina: pagina + 1,
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-primary"
                >
                  Próxima
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ainda não temos produtos cadastrados nesse filtro. Fale com a Farmácias Francy pelo WhatsApp para verificar a
          disponibilidade.
        </p>
      )}
    </div>
  );
}
