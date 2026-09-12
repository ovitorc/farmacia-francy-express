import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, ShoppingCart, X, ChevronDown, ChevronRight } from "lucide-react";

import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal, type Categoria } from "@/lib/catalog";
import { buscaQueryOptions, useCatalogo } from "@/lib/catalog-context";
import { ProductImage } from "@/components/ProductCard";

const logoUrl =
"https://raw.githubusercontent.com/ovitorc/farmacia-francy-express/main/src/assets/logo%20png.png";

function Logo({ className = "h-11" }: { className?: string }) {
return (
<img
src={logoUrl}
alt="Farmácias Francy"
className={`${className} w-auto object-contain`}
/>
);
}

function CategoryLinks({
categoria,
fechar,
}: {
categoria: Categoria;
fechar?: () => void;
}) {
const [aberta, setAberta] = useState<string | null>(null);

return ( <div className="space-y-1">
{categoria.subcategorias.map((subcategoria) => {
const temTerceiroNivel = Boolean(subcategoria.subcategorias?.length);
const estaAberta = aberta === subcategoria.slug;

```
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
              onClick={() =>
                setAberta(estaAberta ? null : subcategoria.slug)
              }
              className="p-2"
            >
              <ChevronRight
                className={`size-4 transition-transform ${
                  estaAberta ? "rotate-90" : ""
                }`}
              />
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
```

);
}

function DesktopCategoryMenu({ categoria }: { categoria: Categoria }) {
const [aberta, setAberta] = useState<string | null>(null);

return ( <div className="group relative z-[1] shrink-0">
<Link
to="/categoria/$slug"
params={{ slug: categoria.slug }}
className="flex items-center gap-1 rounded-md px-2.5 py-2 text-xs font-semibold hover:bg-primary-foreground/10"
> <span>{categoria.nome}</span> <ChevronDown className="size-3" /> </Link>

```
  <div
    className="
      pointer-events-none
      invisible
      absolute
      left-0
      top-full
      z-[9999]
      w-[min(980px,calc(100vw-32px))]
      translate-y-1
      rounded-xl
      border
      border-border
      bg-popover
      p-3
      text-popover-foreground
      opacity-0
      shadow-2xl
      transition-all
      duration-150
      group-hover:pointer-events-auto
      group-hover:visible
      group-hover:translate-y-0
      group-hover:opacity-100
    "
  >
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {categoria.subcategorias.map((subcategoria) => {
        const temTerceiroNivel = Boolean(
          subcategoria.subcategorias?.length,
        );
        const estaAberta = aberta === subcategoria.slug;

        return (
          <div
            key={subcategoria.slug}
            className="min-w-0 rounded-lg border border-transparent p-1 hover:border-border"
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
                  onClick={() =>
                    setAberta(estaAberta ? null : subcategoria.slug)
                  }
                  className="p-1.5"
                  aria-label={`Mostrar ${subcategoria.nome}`}
                >
                  <ChevronRight
                    className={`size-3.5 ${
                      estaAberta ? "rotate-90" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {temTerceiroNivel && estaAberta && (
              <div className="mt-1 max-h-48 overflow-y-auto border-l border-border pl-2">
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
                    className="block rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
</div>
```

);
}

function SideMenu({
aberto,
fechar,
}: {
aberto: boolean;
fechar: () => void;
}) {
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

```
  <aside
    className={`fixed left-0 top-0 z-[110] flex h-dvh w-[86vw] max-w-sm flex-col bg-sidebar shadow-card transition-transform ${
      aberto ? "translate-x-0" : "-translate-x-full"
    }`}
  >
    <div className="flex items-center justify-between bg-primary px-4 py-4">
      <Logo className="h-9" />

      <button
        onClick={fechar}
        aria-label="Fechar menu"
        className="p-2 text-primary-foreground"
      >
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
        <div
          key={categoria.slug}
          className="border-b border-sidebar-border/60 py-1"
        >
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
```

);
}

export function SiteHeader() {
const [menuAberto, setMenuAberto] = useState(false);
const [termo, setTermo] = useState("");
const [termoBusca, setTermoBusca] = useState("");
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
const timer = setTimeout(() => {
setTermoBusca(termo.trim());
}, 250);

```
return () => clearTimeout(timer);
```

}, [termo]);

useEffect(() => {
if (primeiro.current) {
primeiro.current = false;
return;
}

```
setPop(true);

const t = setTimeout(() => setPop(false), 400);

return () => clearTimeout(t);
```

}, [totalItens]);

const { data: sugestoes = [] } = useQuery(
buscaQueryOptions(termoBusca, 6),
);

const enviar = (e: React.FormEvent) => {
e.preventDefault();

```
if (termo.trim()) {
  navigate({
    to: "/busca",
    search: {
      q: termo.trim(),
    },
  });
}
```

};

return (
<> <header className="sticky top-0 z-[1000] w-full max-w-full overflow-visible bg-primary text-primary-foreground"> <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2.5 sm:px-6 md:flex-row md:items-center md:gap-4"> <div className="flex shrink-0 items-center justify-between gap-3 md:contents">
<button
onClick={() => setMenuAberto(true)}
aria-label="Abrir menu"
className="shrink-0 p-2 md:order-1"
> <Menu className="size-5" /> </button>

```
        <Link to="/" className="shrink-0 md:order-2">
          <Logo className="h-9 sm:h-11" />
        </Link>

        <Link
          to="/carrinho"
          className="relative shrink-0 p-2 md:order-4"
        >
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
              onBlur={() =>
                setTimeout(() => setFocado(false), 150)
              }
              placeholder="O que você está procurando?"
              className="h-10 w-full rounded-full bg-background pl-9 pr-3 text-sm text-foreground outline-none"
            />
          </form>

          {focado && sugestoes.length > 0 && (
            <div className="absolute left-0 right-0 top-12 z-[9999] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-card">
              <ul>
                {sugestoes.map((produto) => (
                  <li key={produto.id}>
                    <Link
                      to="/produto/$id"
                      params={{ id: produto.id }}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <div className="size-10">
                        <ProductImage produto={produto} />
                      </div>

                      <span className="line-clamp-1 flex-1 text-sm">
                        {produto.nome}
                      </span>

                      <span className="text-sm font-semibold text-primary">
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

    <div className="hidden w-full border-t border-primary-foreground/10 md:block">
      <nav className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-visible px-4 py-1.5 text-xs font-medium">
        <button
          onClick={() => setMenuAberto(true)}
          className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-2 hover:bg-primary-foreground/10"
        >
          ☰ Categorias
        </button>

        {categorias.map((categoria) => (
          <DesktopCategoryMenu
            key={categoria.slug}
            categoria={categoria}
          />
        ))}
      </nav>
    </div>
  </header>

  <SideMenu
    aberto={menuAberto}
    fechar={() => setMenuAberto(false)}
  />
</>
```

);
}
