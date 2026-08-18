import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ProductCard } from "@/components/ProductCard";
import { getCategoria, precoFinal, produtos } from "@/lib/catalog";

type Busca = { sub?: string; ordem?: string };

export const Route = createFileRoute("/categoria/$slug")({
  validateSearch: (raw: Record<string, unknown>): Busca => ({
    sub: typeof raw["sub"] === "string" ? raw["sub"] : "",
    ordem: typeof raw["ordem"] === "string" ? raw["ordem"] : "relevancia",
  }),
  loader: ({ params }) => {
    const categoria = getCategoria(params.slug);
    if (!categoria) throw notFound();
    return { categoria };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Categoria não encontrada | Farmácias Francy" }, { name: "robots", content: "noindex" }],
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
  component: CategoriaPage,
});

const ordens = [
  { valor: "relevancia", rotulo: "Mais relevantes" },
  { valor: "menor-preco", rotulo: "Menor preço" },
  { valor: "maior-preco", rotulo: "Maior preço" },
  { valor: "ofertas", rotulo: "Ofertas" },
];

function CategoriaPage() {
  const { categoria } = Route.useLoaderData();
  const busca = Route.useSearch();
  const sub = busca.sub ?? "";
  const ordem = busca.ordem ?? "relevancia";

  let lista = produtos.filter((p) => p.categoria === categoria.slug);
  if (sub) lista = lista.filter((p) => p.subcategoria === sub);
  if (ordem === "menor-preco") lista = [...lista].sort((a, b) => precoFinal(a) - precoFinal(b));
  if (ordem === "maior-preco") lista = [...lista].sort((a, b) => precoFinal(b) - precoFinal(a));
  if (ordem === "ofertas") lista = lista.filter((p) => p.oferta);

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
          search={{ sub: "", ordem }}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            sub === "" ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"
          }`}
        >
          Todos
        </Link>
        {categoria.subcategorias.map((s) => (
          <Link
            key={s.slug}
            to="/categoria/$slug"
            params={{ slug: categoria.slug }}
            search={{ sub: s.slug, ordem }}
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
        <p className="text-xs text-muted-foreground">{lista.length} produto(s)</p>
        <div className="flex flex-wrap gap-2">
          {ordens.map((o) => (
            <Link
              key={o.valor}
              to="/categoria/$slug"
              params={{ slug: categoria.slug }}
              search={{ sub, ordem: o.valor }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                ordem === o.valor ? "bg-primary-soft font-semibold text-primary" : "text-muted-foreground"
              }`}
            >
              {o.rotulo}
            </Link>
          ))}
        </div>
      </div>

      {lista.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {lista.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ainda não temos produtos cadastrados nesse filtro. Fale com a gente pelo WhatsApp que
          verificamos a disponibilidade.
        </p>
      )}
    </div>
  );
}
