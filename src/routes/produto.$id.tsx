import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Minus, Plus, ShoppingCart, MessageCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductImage } from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import {
  formatarPreco,
  getCategoria,
  getProduto,
  precoFinal,
  produtos,
  WHATSAPP_URL,
} from "@/lib/catalog";

export const Route = createFileRoute("/produto/$id")({
  loader: ({ params }) => {
    const produto = getProduto(params.id);
    if (!produto) throw notFound();
    return { produto };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Produto indisponível | Farmácias Francy" }, { name: "robots", content: "noindex" }],
      };
    const { produto } = loaderData;
    const desc = produto.descricao.slice(0, 150);
    return {
      meta: [
        { title: `${produto.nome} | Farmácias Francy` },
        { name: "description", content: desc },
        { property: "og:title", content: `${produto.nome} | Farmácias Francy` },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProdutoPage,
});

function ProdutoPage() {
  const { produto } = Route.useLoaderData();
  const { adicionar } = useCart();
  const [qtd, setQtd] = useState(1);
  const categoria = getCategoria(produto.categoria);
  const sub = categoria?.subcategorias.find((s) => s.slug === produto.subcategoria);
  const emOferta = Boolean(produto.precoPromocional);

  const relacionados = produtos
    .filter((p) => p.categoria === produto.categoria && p.id !== produto.id)
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>
        {categoria && (
          <>
            <ChevronRight className="size-3" />
            <Link to="/categoria/$slug" params={{ slug: categoria.slug }} className="hover:text-primary">
              {categoria.nome}
            </Link>
          </>
        )}
        <ChevronRight className="size-3" />
        <span className="line-clamp-1 text-foreground">{produto.nome}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-8">
          <ProductImage produto={produto} />
        </div>

        <div>
          {emOferta && (
            <span className="mb-3 inline-block rounded-full bg-brand-red px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-red-foreground">
              Oferta Rasga Preço
            </span>
          )}
          <h1 className="text-2xl font-bold leading-snug text-foreground sm:text-3xl">{produto.nome}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {categoria?.nome}
            {sub ? ` • ${sub.nome}` : ""}
          </p>

          <div className="mt-6">
            {emOferta && (
              <p className="text-sm text-muted-foreground line-through">{formatarPreco(produto.preco)}</p>
            )}
            <p className={`text-4xl font-bold ${emOferta ? "text-brand-red" : "text-primary"}`}>
              {formatarPreco(precoFinal(produto))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {produto.disponivel ? "Disponibilidade confirmada no atendimento" : "Indisponível no momento"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full border border-border">
              <button
                aria-label="Diminuir quantidade"
                onClick={() => setQtd((q) => Math.max(1, q - 1))}
                className="p-2.5 text-muted-foreground transition-colors hover:text-primary"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center text-sm font-semibold">{qtd}</span>
              <button
                aria-label="Aumentar quantidade"
                onClick={() => setQtd((q) => Math.min(99, q + 1))}
                className="p-2.5 text-muted-foreground transition-colors hover:text-primary"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={() => {
                adicionar(produto.id, qtd);
                toast.success("Adicionado ao carrinho", { description: produto.nome });
              }}
            >
              <ShoppingCart className="size-4" /> Adicionar ao carrinho
            </Button>
          </div>

          <a
            href={`${WHATSAPP_URL}?text=${encodeURIComponent(
              `Olá, Farmácias Francy! Tenho interesse no produto ${produto.nome} (Código: ${produto.codigo}).`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-red px-4 py-3 text-sm font-semibold text-brand-red-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="size-4" /> Tirar dúvida pelo WhatsApp
          </a>

          <div className="mt-8 space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">Descrição</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{produto.descricao}</p>
            {produto.informacoes && (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {produto.informacoes.map((info) => (
                  <li key={info}>{info}</li>
                ))}
              </ul>
            )}
            <p className="pt-2 text-[11px] text-muted-foreground/80">
              Referência interna: {produto.codigo}. Produtos sujeitos a receita ou controle especial
              seguem as regras definidas pela Farmácias Francy na confirmação do pedido.
            </p>
          </div>
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-lg font-bold text-primary">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {relacionados.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
