import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { produtosRasgaPreco } from "@/lib/catalog";

export function RasgaPreco() {
  const itens = produtosRasgaPreco();
  const trilha = [...itens, ...itens];

  return (
    <section className="py-8">
      <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-brand-red-foreground">
            <Flame className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-primary sm:text-2xl">RASGA PREÇO</h2>
            <p className="text-xs text-muted-foreground">De quinta-feira a domingo na Farmácias Francy</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div className="marquee-track flex gap-4 px-6">
          {trilha.map((p, i) => (
            <div key={`${p.id}-${i}`} className="w-[200px] shrink-0 sm:w-[230px]">
              <ProductCard produto={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
