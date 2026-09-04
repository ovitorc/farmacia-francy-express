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
        draggable={false}
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

  const adicionarAoCarrinho = (e: React.MouseEvent<HTMLButtonElement>) => {
    /*
     * Impede que o clique no botão seja interpretado
     * como uma interação com o carrossel.
     */
    e.stopPropagation();

    adicionar(produto);

    toast.success("Adicionado ao carrinho", {
      description: produto.nome,
    });
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <Link
        to="/produto/$id"
        params={{ id: produto.id }}
        draggable={false}
        className="relative block aspect-square overflow-hidden bg-white p-4"
        onDragStart={(e) => e.preventDefault()}
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
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-foreground hover:text-primary"
        >
          {produto.nome}
        </Link>

        <div className="mt-auto">
          {emOferta && <p className="text-xs text-muted-foreground line-through">{formatarPreco(produto.preco)}</p>}

          <p className={`text-xl font-bold ${emOferta ? "text-brand-red" : "text-primary"}`}>
            {formatarPreco(precoFinal(produto))}
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Button
            type="button"
            size="sm"
            className="h-10 w-full min-w-0 gap-1.5 px-2 text-xs sm:text-sm"
            onPointerDown={(e) => {
              /*
               * Impede o pointerdown de iniciar um arraste do carrossel.
               */
              e.stopPropagation();
            }}
            onClick={adicionarAoCarrinho}
          >
            <ShoppingCart className="size-4 shrink-0" />
            <span className="truncate sm:hidden">Adicionar</span>
            <span className="hidden truncate sm:inline">Adicionar ao carrinho</span>
          </Button>


          <Button
            asChild
            size="sm"
            variant="outline"
            className="w-full"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
          >
            <Link to="/produto/$id" params={{ id: produto.id }} draggable={false}>
              Ver produto
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
