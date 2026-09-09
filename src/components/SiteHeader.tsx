import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, X, ChevronDown } from "lucide-react";

import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal } from "@/lib/catalog";
import { buscaQueryOptions, useCatalogo } from "@/lib/catalog-context";
import { ProductImage } from "@/components/ProductCard";

const logoUrl = "https://raw.githubusercontent.com/ovitorc/farmacia-francy-express/main/src/assets/logo%20png.png";

function Logo({ className = "h-11" }: { className?: string }) {
  return <img src={logoUrl} alt="Farmácias Francy" className={`${className} w-auto object-contain`} />;
}

function SideMenu({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [expandida, setExpandida] = useState<string | null>(null);
  const { categorias } = useCatalogo();

  return (
    <>
      <div
        aria-hidden={!aberto}
        onClick={fechar}
        className={`fixed inset-0 z-50 bg-foreground/40 transition-opacity ${
          aberto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[86vw] max-w-sm flex-col bg-sidebar shadow-card transition-transform ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between bg-primary px-4 py-4">
          <Logo className="h-9" />

          <button onClick={fechar} aria-label="Fechar menu" className="p-2 text-primary-foreground">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Link
            to="/farmacia-popular"
            onClick={fechar}
            className="mb-2 flex rounded-lg border border-brand-red/30 bg-brand-red/5 px-3 py-3 text-sm font-semibold text-brand-red"
          >
            FARMÁCIA POPULAR
          </Link>

          <Link
            to="/trabalhe-conosco"
            onClick={fechar}
            className="mb-3 flex rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-sm font-semibold text-primary"
          >
            TRABALHE CONOSCO
          </Link>

          {categorias.map((c) => {
            const aberta = expandida === c.slug;

            return (
              <div key={c.slug} className="border-b border-sidebar-border/60">
                <div className="flex items-center">
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    onClick={fechar}
                    className="flex-1 px-3 py-3 text-sm font-medium"
                  >
                    <span className="mr-2">{c.icone}</span>
                    {c.nome}
                  </Link>

                  <button onClick={() => setExpandida(aberta ? null : c.slug)} className="p-2">
                    <ChevronDown className={`size-4 transition-transform ${aberta ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {aberta && (
                  <ul className="pb-2">
                    {c.subcategorias.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          to="/categoria/$slug"
                          params={{ slug: c.slug }}
                          search={{
                            sub: sub.slug,
                            ordem: "relevancia",
                          }}
                          onClick={fechar}
                          className="block px-7 py-2 text-sm text-muted-foreground"
                        >
                          {sub.nome}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
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
  const [pop, setPop] = useState(false);

  const { totalItens } = useCart();
  const { categorias } = useCatalogo();

  const primeiro = useRef(true);
  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

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

  const { data: sugestoes = [] } = useQuery(buscaQueryOptions(termo.trim(), 6));

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();

    if (termo.trim()) {
      navigate({
        to: "/busca",
        search: {
          q: termo.trim(),
        },
      });
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-6 md:flex-row md:items-center md:gap-4">
          <div className="flex items-center justify-between gap-3 md:contents">
            <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu" className="shrink-0 p-2 md:order-1">
              <Menu className="size-5" />
            </button>

            <Link to="/" className="shrink-0 md:order-2">
              <Logo className="h-9 sm:h-11" />
            </Link>

            <Link to="/carrinho" className="relative shrink-0 p-2 md:order-4">
              <ShoppingCart className="size-5" />

              {totalItens > 0 && (
                <span
                  className={`absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand-red text-[11px] font-bold ${
                    pop ? "cart-pop" : ""
                  }`}
                >
                  {totalItens}
                </span>
              )}
            </Link>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 md:order-3 md:flex-1">
            <div className="relative min-w-0 flex-1">
              <form onSubmit={enviar}>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onFocus={() => setFocado(true)}
                  onBlur={() => setTimeout(() => setFocado(false), 150)}
                  placeholder="O que você está procurando?"
                  className="h-10 w-full rounded-full bg-background pl-9 pr-3 text-sm text-foreground outline-none"
                />
              </form>

              {focado && sugestoes.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card">
                  <ul>
                    {sugestoes.map((p) => (
                      <li key={p.id}>
                        <Link to="/produto/$id" params={{ id: p.id }} className="flex items-center gap-3 px-3 py-2">
                          <div className="size-10">
                            <ProductImage produto={p} />
                          </div>

                          <span className="line-clamp-1 flex-1 text-sm">{p.nome}</span>

                          <span className="text-sm font-semibold text-primary">{formatarPreco(precoFinal(p))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <Link
                to="/trabalhe-conosco"
                className="whitespace-nowrap rounded-full border border-primary-foreground/30 px-3 py-2 text-xs font-semibold"
              >
                Trabalhe Conosco
              </Link>

              <Link
                to="/farmacia-popular"
                className="whitespace-nowrap rounded-full bg-brand-red px-3 py-2 text-xs font-semibold"
              >
                Farmácia Popular
              </Link>
            </div>
          </div>
        </div>

        <div className="hidden border-t border-primary-foreground/10 md:block">
          <nav className="mx-auto flex max-w-7xl items-center justify-center gap-1 px-4 py-1.5 text-xs font-medium">
            <button onClick={() => setMenuAberto(true)} className="whitespace-nowrap px-3 py-2">
              ☰ Todas as categorias
            </button>

            {categorias.map((c) => (
              <div key={c.slug} className="group relative">
                <Link
                  to="/categoria/$slug"
                  params={{ slug: c.slug }}
                  className="flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 hover:bg-primary-foreground/10"
                >
                  {c.nome}

                  <ChevronDown className="size-3" />
                </Link>

                <div className="pointer-events-none absolute left-0 top-full z-50 w-64 translate-y-1 rounded-b-xl border border-border bg-popover p-2 text-popover-foreground opacity-0 shadow-xl transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                  <Link
                    to="/categoria/$slug"
                    params={{ slug: c.slug }}
                    className="block border-b px-3 py-2 text-sm font-semibold text-primary"
                  >
                    Ver todos em {c.nome}
                  </Link>

                  <div className="grid max-h-[420px] overflow-y-auto">
                    {c.subcategorias.map((sub) => (
                      <Link
                        key={sub.slug}
                        to="/categoria/$slug"
                        params={{ slug: c.slug }}
                        search={{
                          sub: sub.slug,
                          ordem: "relevancia",
                        }}
                        className="rounded-lg px-3 py-2 text-sm hover:bg-accent"
                      >
                        {sub.nome}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </header>

      <SideMenu aberto={menuAberto} fechar={() => setMenuAberto(false)} />
    </>
  );
}
