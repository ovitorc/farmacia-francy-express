import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();
  const trilha = [...itens, ...itens];

  if (itens.length === 0) return null;

  return (
    <section className="py-8">
      <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-brand-red-foreground">
            <Flame className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-brand-red sm:text-2xl">Rasga Preço</h2>
            <p className="text-xs text-muted-foreground">Ofertas com desconto especial</p>
          </div>
        </div>
      </div>
      <div className="group overflow-hidden">
        <div className="flex w-max gap-4 px-6 marquee-track group-hover:[animation-play-state:paused]">
          {trilha.map((p, i) => (
            <div key={`${p.id}-${i}`} className="w-44 shrink-0 sm:w-52">
              <ProductCard produto={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
