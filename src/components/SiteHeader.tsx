import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, X, ChevronDown, ChevronRight } from "lucide-react";

import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal, type Categoria } from "@/lib/catalog";
import { buscaQueryOptions, useCatalogo } from "@/lib/catalog-context";
import { ProductImage } from "@/components/ProductCard";

const logoUrl = "https://raw.githubusercontent.com/ovitorc/farmacia-francy-express/main/src/assets/logo%20png.png";

function Logo({ className = "h-11" }: { className?: string }) {
  return <img src={logoUrl} alt="Farmácias Francy" className={`${className} w-auto object-contain`} />;
}

function CategoryLinks({ categoria, fechar }: { categoria: Categoria; fechar?: () => void }) {
  const [aberta, setAberta] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {categoria.subcategorias.map((subcategoria) => {
        const temTerceiroNivel = Boolean(subcategoria.subcategorias?.length);
        const estaAberta = aberta === subcategoria.slug;

        return (
          <div key={subcategoria.slug} className="relative">
            <div className="flex items-center rounded-lg hover:bg-accent">
              <Link
                to="/categoria/$slug"
                params={{ slug: categoria.slug }}
                search={{
                  sub: subcategoria.slug,
                  sub2: "",
                  ordem: "relevancia",
                  pagina: 1,
                }}
                onClick={fechar}
                className="min-w-0 flex-1 px-3 py-2 text-sm"
              >
                {subcategoria.nome}
              </Link>

              {temTerceiroNivel && (
                <button
                  type="button"
                  aria-label={`Abrir ${subcategoria.nome}`}
                  onClick={() => setAberta(estaAberta ? null : subcategoria.slug)}
                  className="p-2"
                >
                  <ChevronRight className={`size-4 transition-transform ${estaAberta ? "rotate-90" : ""}`} />
                </button>
              )}
            </div>

            {temTerceiroNivel && estaAberta && (
              <div className="ml-3 border-l border-border pl-2">
                {subcategoria.subcategorias?.map((terceiro) => (
                  <Link
                    key={terceiro.slug}
                    to="/categoria/$slug"
                    params={{ slug: categoria.slug }}
                    search={{
                      sub: subcategoria.slug,
                      sub2: terceiro.slug,
                      ordem: "relevancia",
                      pagina: 1,
                    }}
                    onClick={fechar}
                    className="block rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {terceiro.nome}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DesktopCategoryMenu({ categoria }: { categoria: Categoria }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [menuPosicao, setMenuPosicao] = useState({
    left: 12,
    top: 0,
  });

  const gatilhoRef = useRef<HTMLDivElement>(null);

  const atualizarPosicao = () => {
    const gatilho = gatilhoRef.current;

    if (!gatilho) return;

    const largura = Math.min(980, window.innerWidth - 24);
    const rect = gatilho.getBoundingClientRect();

    const left = Math.max(12, Math.min(rect.left, window.innerWidth - largura - 12));

    setMenuPosicao({
      left,
      top: rect.bottom + 4,
    });
  };

  const abrirMenu = () => {
    atualizarPosicao();
    setMenuAberto(true);
  };

  useEffect(() => {
    if (!menuAberto) return;

    const atualizar = () => atualizarPosicao();

    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, { passive: true });

    return () => {
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar);
    };
  }, [menuAberto]);

  return (
    <div
      ref={gatilhoRef}
      className="relative shrink-0"
      onMouseEnter={abrirMenu}
      onMouseLeave={() => setMenuAberto(false)}
    >
      <Link
        to="/categoria/$slug"
        params={{ slug: categoria.slug }}
        className="group flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary-foreground/10 bg-primary-foreground/[0.06] px-3 py-2 text-xs font-semibold shadow-sm transition-all hover:border-primary-foreground/25 hover:bg-primary-foreground/12"
        onFocus={abrirMenu}
      >
        <span>{categoria.nome}</span>

        <ChevronDown className="size-3 shrink-0 opacity-70 transition-transform group-hover:translate-y-0.5" />
      </Link>

      {menuAberto && (
        <div
          className="fixed z-[9999] w-[min(1040px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-2xl border border-border/80 bg-popover/98 p-4 text-popover-foreground shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl"
          style={{
            left: menuPosicao.left,
            top: menuPosicao.top,
          }}
          onMouseEnter={() => setMenuAberto(true)}
          onMouseLeave={() => setMenuAberto(false)}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categoria.subcategorias.map((subcategoria) => {
              const temTerceiroNivel = Boolean(subcategoria.subcategorias?.length);

              const estaAberta = aberta === subcategoria.slug;

              return (
                <div
                  key={subcategoria.slug}
                  className="min-w-0 rounded-xl border border-transparent p-1 transition-colors hover:border-border hover:bg-accent/40"
                >
                  <div className="flex items-center">
                    <Link
                      to="/categoria/$slug"
                      params={{ slug: categoria.slug }}
                      search={{
                        sub: subcategoria.slug,
                        sub2: "",
                        ordem: "relevancia",
                        pagina: 1,
                      }}
                      className="min-w-0 flex-1 px-2 py-1.5 text-sm font-semibold hover:text-primary"
                    >
                      {subcategoria.nome}
                    </Link>

                    {temTerceiroNivel && (
                      <button
                        type="button"
                        onClick={() => setAberta(estaAberta ? null : subcategoria.slug)}
                        className="shrink-0 p-1.5"
                        aria-label={`Mostrar ${subcategoria.nome}`}
                      >
                        <ChevronRight className={`size-3.5 transition-transform ${estaAberta ? "rotate-90" : ""}`} />
                      </button>
                    )}
                  </div>

                  {temTerceiroNivel && estaAberta && (
                    <div className="mt-1 border-l border-border pl-2">
                      {subcategoria.subcategorias?.map((terceiro) => (
                        <Link
                          key={terceiro.slug}
                          to="/categoria/$slug"
                          params={{ slug: categoria.slug }}
                          search={{
                            sub: subcategoria.slug,
                            sub2: terceiro.slug,
                            ordem: "relevancia",
                            pagina: 1,
                          }}
                          className="block break-words rounded-md px-2 py-1 text-xs leading-tight text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {terceiro.nome}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SideMenu({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const { categorias } = useCatalogo();

  return (
    <>
      <div
        aria-hidden={!aberto}
        onClick={fechar}
        className={`fixed inset-0 z-[100] bg-foreground/40 transition-opacity ${
          aberto ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed left-0 top-0 z-[110] flex h-dvh w-[86vw] max-w-sm flex-col bg-sidebar shadow-card transition-transform ${
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

          {categorias.map((categoria) => (
            <div key={categoria.slug} className="border-b border-sidebar-border/60 py-1">
              <Link
                to="/categoria/$slug"
                params={{ slug: categoria.slug }}
                onClick={fechar}
                className="flex items-center gap-2 px-3 py-3 text-sm font-semibold"
              >
                <span>{categoria.icone}</span>
                {categoria.nome}
              </Link>

              <CategoryLinks categoria={categoria} fechar={fechar} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export function SiteHeader() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [focado, setFocado] = useState(false);
  const [pop, setPop] = useState(false);

  // Controle único do header inteiro
  const [headerVisivel, setHeaderVisivel] = useState(true);

  const { totalItens } = useCart();
  const { categorias } = useCatalogo();

  const primeiro = useRef(true);
  const ultimaPosicaoRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  useEffect(() => {
    setMenuAberto(false);
    setFocado(false);
  }, [pathname]);

  /*
   * CONTROLE DO HEADER
   *
   * Rolando para baixo -> desaparece
   * Rolando para cima -> reaparece
   * No topo -> permanece visível
   *
   * requestAnimationFrame evita atualizar o React dezenas
   * de vezes por segundo durante a rolagem.
   */
  useEffect(() => {
    ultimaPosicaoRef.current = window.scrollY;

    const controlarHeader = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = requestAnimationFrame(() => {
        const posicaoAtual = window.scrollY;
        const ultimaPosicao = ultimaPosicaoRef.current;
        const diferenca = posicaoAtual - ultimaPosicao;

        if (posicaoAtual <= 10) {
          setHeaderVisivel(true);
        } else if (diferenca > 3) {
          // Rolando para baixo
          setHeaderVisivel(false);
        } else if (diferenca < -3) {
          // Rolando para cima
          setHeaderVisivel(true);
        }

        ultimaPosicaoRef.current = posicaoAtual;
        frameRef.current = null;
      });
    };

    window.addEventListener("scroll", controlarHeader, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", controlarHeader);

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoBusca(termo.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [termo]);

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }

    setPop(true);

    const t = setTimeout(() => setPop(false), 400);

    return () => clearTimeout(t);
  }, [totalItens]);

  const { data: sugestoes = [] } = useQuery(buscaQueryOptions(termoBusca, 6));

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
      <header
        className={`sticky top-0 z-[1000] w-full min-w-0 overflow-visible bg-primary text-primary-foreground shadow-[0_2px_18px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
          headerVisivel ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-2 px-3 py-3 sm:px-6 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 shrink-0 items-center justify-between gap-3 md:contents">
            <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu" className="shrink-0 p-2 md:order-1">
              <Menu className="size-5" />
            </button>

            <Link to="/" className="shrink-0 md:order-2">
              <Logo className="h-9 sm:h-11" />
            </Link>

            <Link to="/carrinho" className="relative shrink-0 p-2 md:order-4" aria-label="Carrinho">
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

          <div className="flex min-w-0 w-full items-center gap-2 md:order-3 md:flex-1">
            <div className="relative min-w-0 flex-1">
              <form onSubmit={enviar}>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onFocus={() => setFocado(true)}
                  onBlur={() => setTimeout(() => setFocado(false), 150)}
                  placeholder="O que você está procurando?"
                  className="h-11 w-full min-w-0 rounded-full border border-white/10 bg-background pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-white/25"
                />
              </form>

              {focado && sugestoes.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-[9999] max-w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card">
                  <ul className="max-h-[min(60vh,420px)] overflow-y-auto scrollbar-hidden">
                    {sugestoes.map((produto) => (
                      <li key={produto.id}>
                        <Link
                          to="/produto/$id"
                          params={{ id: produto.id }}
                          className="flex min-w-0 items-center gap-3 px-3 py-2"
                        >
                          <div className="size-10 shrink-0">
                            <ProductImage produto={produto} />
                          </div>

                          <span className="line-clamp-1 min-w-0 flex-1 text-sm">{produto.nome}</span>

                          <span className="shrink-0 text-sm font-semibold text-primary">
                            {formatarPreco(precoFinal(produto))}
                          </span>
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
                className="whitespace-nowrap rounded-full border border-primary-foreground/20 bg-primary-foreground/[0.06] px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-primary-foreground/10"
              >
                Trabalhe Conosco
              </Link>

              <Link
                to="/farmacia-popular"
                className="whitespace-nowrap rounded-full bg-brand-red px-3.5 py-2 text-xs font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
              >
                Farmácia Popular
              </Link>
            </div>
          </div>
        </div>

        {/*
         * A barra de categorias não possui mais uma lógica
         * própria de esconder/mostrar.
         *
         * Ela faz parte do header e acompanha o movimento
         * do header inteiro.
         */}
        <div className="hidden w-full overflow-visible border-t border-primary-foreground/10 bg-primary/95 backdrop-blur-md md:block">
          <nav className="mx-auto flex w-full max-w-7xl min-w-0 flex-wrap items-center justify-center gap-1 overflow-visible px-4 py-2 text-xs font-medium">
            {categorias.map((categoria) => (
              <DesktopCategoryMenu key={categoria.slug} categoria={categoria} />
            ))}
          </nav>
        </div>
      </header>

      <SideMenu aberto={menuAberto} fechar={() => setMenuAberto(false)} />
    </>
  );
}
