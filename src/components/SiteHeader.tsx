import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, X, ChevronDown } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useCart } from "@/lib/cart";
import { buscarProdutos, categorias, formatarPreco, precoFinal } from "@/lib/catalog";
import { ProductImage } from "@/components/ProductCard";

function Logo({ className = "h-11" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Farmácias Francy"
      className={`${className} w-auto rounded-md object-contain`}
    />
  );
}

function SideMenu({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [expandida, setExpandida] = useState<string | null>(null);

  return (
    <>
      <div
        aria-hidden={!aberto}
        onClick={fechar}
        className={`fixed inset-0 z-50 bg-foreground/40 transition-opacity duration-300 ${
          aberto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[86vw] max-w-sm flex-col bg-sidebar shadow-card transition-transform duration-300 ease-out ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between bg-primary px-4 py-4">
          <Logo className="h-9" />
          <button
            onClick={fechar}
            aria-label="Fechar menu"
            className="rounded-md p-1.5 text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          <Link
            to="/farmacia-popular"
            onClick={fechar}
            className="mb-3 flex items-center gap-3 rounded-lg border border-brand-red/30 bg-brand-red/5 px-3 py-3 text-sm font-semibold text-brand-red"
          >
            🏥 FARMÁCIA POPULAR
          </Link>

          {categorias.map((c) => {
            const aberta = expandida === c.slug;
            return (
              <div key={c.slug} className="border-b border-sidebar-border/60 last:border-0">
                <div className="flex items-center">
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    onClick={fechar}
                    className="flex-1 px-3 py-3 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:text-primary"
                  >
                    <span className="mr-2">{c.icone}</span>
                    {c.nome}
                  </Link>
                  <button
                    aria-label={`Expandir ${c.nome}`}
                    onClick={() => setExpandida(aberta ? null : c.slug)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform duration-300 ${aberta ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{ gridTemplateRows: aberta ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <ul className="pb-2">
                      {c.subcategorias.map((sub) => (
                        <li key={sub.slug}>
                          <Link
                            to="/categoria/$slug"
                            params={{ slug: c.slug }}
                            search={{ sub: sub.slug, ordem: "relevancia" }}
                            onClick={fechar}
                            className="block rounded-md px-6 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-primary"
                          >
                            {sub.nome}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function SiteHeader() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [focado, setFocado] = useState(false);
  const { totalItens } = useCart();
  const [pop, setPop] = useState(false);
  const primeiro = useRef(true);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMenuAberto(false);
    setFocado(false);
  }, [pathname]);

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    setPop(true);
    const t = setTimeout(() => setPop(false), 400);
    return () => clearTimeout(t);
  }, [totalItens]);

  const sugestoes = termo.trim().length > 1 ? buscarProdutos(termo).slice(0, 6) : [];

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termo.trim()) return;
    navigate({ to: "/busca", search: { q: termo.trim() } });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-6">
          <button
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="shrink-0 rounded-md p-2 transition-colors hover:bg-primary-foreground/10"
          >
            <Menu className="size-5" strokeWidth={1.75} />
          </button>

          <div className="relative flex-1">
            <form onSubmit={enviar}>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                onFocus={() => setFocado(true)}
                onBlur={() => setTimeout(() => setFocado(false), 150)}
                placeholder="O que você está procurando?"
                aria-label="Pesquisar produtos"
                className="h-10 w-full rounded-full border-0 bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-brand-red/60 placeholder:text-muted-foreground focus:ring-2"
              />
            </form>

            {focado && sugestoes.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-card animate-fade-in">
                <ul className="max-h-80 overflow-y-auto">
                  {sugestoes.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/produto/$id"
                        params={{ id: p.id }}
                        onClick={() => setTermo("")}
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                      >
                        <div className="size-10 shrink-0">
                          <ProductImage produto={p} />
                        </div>
                        <span className="line-clamp-1 flex-1 text-sm">{p.nome}</span>
                        <span className="text-sm font-semibold text-primary">
                          {formatarPreco(precoFinal(p))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    navigate({ to: "/busca", search: { q: termo.trim() } });
                  }}
                  className="block w-full border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:bg-accent"
                >
                  Ver todos os resultados
                </button>
              </div>
            )}
          </div>

          <Link
            to="/carrinho"
            aria-label="Abrir carrinho"
            className="relative shrink-0 rounded-md p-2 transition-colors hover:bg-primary-foreground/10"
          >
            <ShoppingCart className="size-5" strokeWidth={1.75} />
            {totalItens > 0 && (
              <span
                className={`absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold text-brand-red-foreground ${
                  pop ? "cart-pop" : ""
                }`}
              >
                {totalItens}
              </span>
            )}
          </Link>

          <Link to="/" className="shrink-0" aria-label="Página inicial Farmácias Francy">
            <Logo className="h-9 sm:h-11" />
          </Link>
        </div>

        <div className="hidden border-t border-primary-foreground/10 md:block">
          <div className="mx-auto flex max-w-7xl items-center gap-5 overflow-x-auto px-6 py-2 text-xs font-medium">
            <button
              onClick={() => setMenuAberto(true)}
              className="whitespace-nowrap opacity-90 transition-opacity hover:opacity-100"
            >
              Todas as categorias
            </button>
            {categorias.slice(0, 6).map((c) => (
              <Link
                key={c.slug}
                to="/categoria/$slug"
                params={{ slug: c.slug }}
                className="whitespace-nowrap opacity-90 transition-opacity hover:opacity-100"
              >
                {c.nome}
              </Link>
            ))}
            <Link
              to="/farmacia-popular"
              className="ml-auto whitespace-nowrap rounded-full bg-brand-red px-3 py-1 font-semibold text-brand-red-foreground"
            >
              Farmácia Popular
            </Link>
          </div>
        </div>
      </header>

      <SideMenu aberto={menuAberto} fechar={() => setMenuAberto(false)} />
    </>
  );
}
