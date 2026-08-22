import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, MessageCircle, ShoppingCart } from "lucide-react";
import { ProductImage } from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal } from "@/lib/catalog";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Meu carrinho | Farmácias Francy" },
      {
        name: "description",
        content:
          "Revise os itens do seu pedido e finalize a compra pelo WhatsApp com a equipe da Farmácias Francy.",
      },
      { property: "og:title", content: "Meu carrinho | Farmácias Francy" },
      {
        property: "og:description",
        content: "Finalize seu pedido da Farmácias Francy pelo WhatsApp.",
      },
    ],
  }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const { itens, total, definirQuantidade, remover, limpar, linkWhatsApp } = useCart();

  if (itens.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <ShoppingCart className="mx-auto size-12 text-primary/40" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore o catálogo e monte seu pedido. A finalização é feita pelo WhatsApp.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold text-primary sm:text-3xl">Meu carrinho</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <ul className="space-y-3">
          {itens.map((item) => {
            const p = item.produto;
            return (
              <li
                key={p.id}
                className="flex gap-4 rounded-xl border border-border bg-card p-3 sm:p-4"
              >
                <Link
                  to="/produto/$id"
                  params={{ id: p.id }}
                  className="size-20 shrink-0 rounded-lg bg-white p-1.5"
                >
                  <ProductImage produto={p} />
                </Link>
                <div className="flex flex-1 flex-col gap-2">
                  <Link
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="line-clamp-2 text-sm font-medium hover:text-primary"
                  >
                    {p.nome}
                  </Link>
                  <p className="text-xs text-muted-foreground">Código {p.codigo}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-border">
                      <button
                        aria-label="Diminuir quantidade"
                        onClick={() => definirQuantidade(p.id, item.quantidade - 1)}
                        className="p-2 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="min-w-8 text-center text-sm font-semibold">
                        {item.quantidade}
                      </span>
                      <button
                        aria-label="Aumentar quantidade"
                        onClick={() => definirQuantidade(p.id, item.quantidade + 1)}
                        className="p-2 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-primary">
                        {formatarPreco(precoFinal(p) * item.quantidade)}
                      </span>
                      <button
                        aria-label={`Remover ${p.nome}`}
                        onClick={() => remover(p.id)}
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:text-brand-red"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo do pedido
          </h2>
          <div className="mt-4 flex items-center justify-between text-lg font-bold text-primary">
            <span>Total</span>
            <span>{formatarPreco(total)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            O pedido é confirmado por WhatsApp, incluindo disponibilidade em estoque, frete e forma
            de pagamento.
          </p>
          <a
            href={linkWhatsApp()}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-brand-red-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="size-4" /> Finalizar pelo WhatsApp
          </a>
          <button
            onClick={limpar}
            className="mt-3 w-full rounded-full border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-red hover:text-brand-red"
          >
            Esvaziar carrinho
          </button>
        </aside>
      </div>
    </div>
  );
}
