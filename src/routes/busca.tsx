import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { buscaQueryOptions } from "@/lib/catalog-context";

type Busca = { q?: string };

export const Route = createFileRoute("/busca")({
  validateSearch: (raw: Record<string, unknown>): Busca => ({
    q: typeof raw["q"] === "string" ? raw["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Busca de produtos | Farmácias Francy" },
      {
        name: "description",
        content:
          "Pesquise medicamentos, higiene, perfumaria e mais no catálogo da Farmácias Francy e finalize pelo WhatsApp.",
      },
      { property: "og:title", content: "Busca de produtos | Farmácias Francy" },
      {
        property: "og:description",
        content: "Encontre o que precisa no catálogo da Farmácias Francy.",
      },
    ],
  }),
  component: BuscaPage,
});

function BuscaPage() {
  const { q } = Route.useSearch();
  const termo = q ?? "";
  const { data: resultados = [], isPending } = useQuery(buscaQueryOptions(termo, 60));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{" "}
        / Busca
      </p>
      <h1 className="mt-2 text-2xl font-bold text-primary sm:text-3xl">
        Resultados para “{termo}”
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isPending ? "Buscando..." : `${resultados.length} produto(s) encontrado(s)`}
      </p>

      {resultados.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {resultados.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      ) : (
        !isPending && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Não encontramos esse item no catálogo online. Fale com a gente pelo WhatsApp que
            verificamos a disponibilidade na loja.
          </p>
        )
      )}
    </div>
  );
}
