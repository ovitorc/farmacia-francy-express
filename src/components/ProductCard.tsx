import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal, type Produto } from "@/lib/catalog";

export function ProductImage({ produto, className = "" }: { produto: Produto; className?: string }) {
  if (produto.imagem) {
    return (
      <img
        src={produto.imagem}
        alt={produto.nome}
        loading="lazy"
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-md bg-primary-soft">
      <span className="px-4 text-center text-sm font-semibold text-primary/70">
        {produto.nome.split(" ").slice(0, 3).join(" ")}
      </span>
    </div>
  );
}

export function ProductCard({ produto }: { produto: Produto }) {
  const { adicionar } = useCart();
  const emOferta = Boolean(produto.precoPromocional);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <Link
        to="/produto/$id"
        params={{ id: produto.id }}
        className="relative block aspect-square overflow-hidden bg-white p-4"
      >
        {emOferta && (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-red-foreground">
            Oferta
          </span>
        )}
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-105">
          <ProductImage produto={produto} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
        <Link
          to="/produto/$id"
          params={{ id: produto.id }}
          className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground hover:text-primary"
        >
          {produto.nome}
        </Link>

        <div className="mt-auto">
          {emOferta && (
            <p className="text-xs text-muted-foreground line-through">{formatarPreco(produto.preco)}</p>
          )}
          <p
            className={`text-xl font-bold ${emOferta ? "text-brand-red" : "text-primary"}`}
          >
            {formatarPreco(precoFinal(produto))}
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={() => {
              adicionar(produto.id);
              toast.success("Adicionado ao carrinho", { description: produto.nome });
            }}
          >
            <ShoppingCart className="size-4" />
            Adicionar ao carrinho
          </Button>
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/produto/$id" params={{ id: produto.id }}>
              Ver produto
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
