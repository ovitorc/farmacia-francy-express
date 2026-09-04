import { useEffect, useRef, useState } from "react";

import { createFileRoute, Link } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { Truck, ShieldCheck, Clock } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";

import { RasgaPreco } from "@/components/RasgaPreco";

import { ordenarProdutosPorRelevancia, produtoTemImagem, type Produto } from "@/lib/catalog";

import { useCatalogo } from "@/lib/catalog-context";

import { listarBannersPublicos } from "@/lib/admin.functions";

/* ============================================================
   ROTA
   ============================================================ */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Farmácias Francy | Credibilidade popular em João Pessoa",
      },
      {
        name: "description",

        content:
          "Medicamentos, higiene, perfumaria e cuidados diários com preço justo na Farmácias Francy. Monte seu pedido online e finalize pelo WhatsApp.",
      },
      {
        property: "og:title",

        content: "Farmácias Francy | Credibilidade popular",
      },
      {
        property: "og:description",

        content: "Farmácia Francy, credibilidade popular. Pedido online e atendimento pelo WhatsApp.",
      },
    ],
  }),

  component: Index,
});

/* ============================================================
   BENEFÍCIOS
   ============================================================ */

const beneficios = [
  {
    icone: Truck,

    titulo: "Entrega no bairro",

    texto: "Combine a entrega pelo WhatsApp",
  },

  {
    icone: ShieldCheck,

    titulo: "Produtos registrados",

    texto: "Farmacêutica responsável presente",
  },

  {
    icone: Clock,

    titulo: "Domingo a domingo",

    texto: "Atendimento humano e rápido",
  },
];

/* ============================================================
   TIPO DO BANNER
   ============================================================ */

type Banner = {
  id: string;

  titulo: string;

  imagem: string;

  imagem_mobile: string | null;

  ativo: boolean;

  ordem: number;
};

/* ============================================================
   CARROSSEL DE BANNERS
   ============================================================ */

function BannerCarousel() {
  const [bannerAtual, setBannerAtual] = useState(0);

  const trilhoMobile = useRef<HTMLDivElement | null>(null);

  const {
    data: banners = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["banners"],

    queryFn: () => listarBannersPublicos(),
  });

  /* ==========================================================
     MOVER PARA BANNER MOBILE
     ========================================================== */

  function moverParaBannerMobile(indice: number, behavior: ScrollBehavior = "smooth") {
    const trilho = trilhoMobile.current;

    if (!trilho) {
      return;
    }

    const cartao = trilho.children[indice] as HTMLElement | undefined;

    if (!cartao) {
      return;
    }

    const posicao = cartao.offsetLeft - (trilho.clientWidth - cartao.clientWidth) / 2;

    trilho.scrollTo({
      left: Math.max(0, posicao),

      behavior,
    });
  }

  /* ==========================================================
     RESET
     ========================================================== */

  useEffect(() => {
    setBannerAtual(0);

    const tempo = setTimeout(() => {
      moverParaBannerMobile(0, "auto");
    }, 50);

    return () => {
      clearTimeout(tempo);
    };
  }, [banners.length]);

  /* ==========================================================
     TROCA AUTOMÁTICA
     ========================================================== */

  useEffect(() => {
    if (banners.length <= 1) {
      return;
    }

    const intervalo = setInterval(() => {
      setBannerAtual((atual) => {
        const proximo = (atual + 1) % banners.length;

        moverParaBannerMobile(proximo);

        return proximo;
      });
    }, 5000);

    return () => {
      clearInterval(intervalo);
    };
  }, [banners.length]);

  /* ==========================================================
     DETECTAR BANNER MOBILE
     ========================================================== */

  function aoRolarMobile() {
    const trilho = trilhoMobile.current;

    if (!trilho) {
      return;
    }

    const centro = trilho.scrollLeft + trilho.clientWidth / 2;

    let indiceMaisProximo = 0;

    let menorDistancia = Infinity;

    Array.from(trilho.children).forEach((elemento, indice) => {
      const cartao = elemento as HTMLElement;

      const centroCartao = cartao.offsetLeft + cartao.clientWidth / 2;

      const distancia = Math.abs(centro - centroCartao);

      if (distancia < menorDistancia) {
        menorDistancia = distancia;

        indiceMaisProximo = indice;
      }
    });

    setBannerAtual(indiceMaisProximo);
  }

  /* ==========================================================
     IR PARA BANNER
     ========================================================== */

  function irPara(indice: number) {
    setBannerAtual(indice);

    moverParaBannerMobile(indice);
  }

  /* ==========================================================
     CARREGANDO
     ========================================================== */

  if (isLoading) {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-muted/40 sm:aspect-[16/6]">
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Carregando banners...</p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     ERRO
     ========================================================== */

  if (isError) {
    return (
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40 sm:aspect-[16/6]">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Não foi possível carregar os banners.</p>

          <p className="mt-1 text-xs text-muted-foreground/70">Verifique a configuração dos banners.</p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     SEM BANNERS
     ========================================================== */

  if (banners.length === 0) {
    return (
      <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40 sm:aspect-[16/6]">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Área de banners promocionais</p>

          <p className="mt-1 text-xs text-muted-foreground/70">Os banners serão adicionados pela administração.</p>
        </div>
      </div>
    );
  }

  const lista = banners as Banner[];

  /* ==========================================================
     RETORNO
     ========================================================== */

  return (
    <div className="relative w-full">
      {/* ======================================================
          MOBILE
          ====================================================== */}

      <div
        ref={trilhoMobile}
        onScroll={aoRolarMobile}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden"
        style={{
          WebkitOverflowScrolling: "touch",

          touchAction: "pan-x pan-y",
        }}
      >
        {lista.map((banner) => (
          <div key={banner.id} className="w-[88%] shrink-0 snap-center overflow-hidden rounded-2xl bg-muted">
            <img
              src={banner.imagem_mobile || banner.imagem}
              alt={banner.titulo || "Banner promocional da Farmácias Francy"}
              loading="lazy"
              draggable={false}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* ======================================================
          DESKTOP
          ====================================================== */}

      <div className="relative hidden w-full overflow-hidden rounded-2xl sm:block">
        <div className="relative aspect-[16/6] w-full overflow-hidden bg-muted">
          {lista.map((banner, index) => (
            <img
              key={banner.id}
              src={banner.imagem}
              alt={banner.titulo || "Banner promocional da Farmácias Francy"}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                index === bannerAtual ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            />
          ))}
        </div>

        {lista.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Banner anterior"
              onClick={() => setBannerAtual((bannerAtual - 1 + lista.length) % lista.length)}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur-sm transition hover:bg-black/50"
            >
              ‹
            </button>

            <button
              type="button"
              aria-label="Próximo banner"
              onClick={() => setBannerAtual((bannerAtual + 1) % lista.length)}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur-sm transition hover:bg-black/50"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* ======================================================
          INDICADORES
          ====================================================== */}

      {lista.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2 sm:absolute sm:bottom-4 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2 sm:rounded-full sm:bg-black/30 sm:px-3 sm:py-2 sm:backdrop-blur-sm">
          {lista.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir para o banner ${index + 1}`}
              onClick={() => irPara(index)}
              className={`rounded-full transition-all duration-300 ${
                index === bannerAtual
                  ? "h-2.5 w-6 bg-primary sm:bg-white"
                  : "size-2.5 bg-primary/30 hover:bg-primary/60 sm:bg-white/60 sm:hover:bg-white/90"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */

function Index() {
  const { categorias, ofertas: ofertasCatalogo, rasgaPreco, destaques } = useCatalogo();

  /*
   * ==========================================================
   * OFERTAS
   *
   * Já chegam ordenadas com produtos com imagem primeiro.
   * ==========================================================
   */

  const ofertas = ordenarProdutosPorRelevancia(ofertasCatalogo).slice(0, 10);

  /*
   * ==========================================================
   * PRODUTOS JÁ UTILIZADOS
   * ==========================================================
   */

  const usados = new Set([...ofertas, ...rasgaPreco].map((produto) => produto.id));

  /*
   * ==========================================================
   * MAIS PROCURADOS
   *
   * Remove duplicados e prioriza produtos com imagem.
   * ==========================================================
   */

  const maisProcurados = ordenarProdutosPorRelevancia(destaques.filter((produto) => !usados.has(produto.id))).slice(
    0,
    10,
  );

  /*
   * ==========================================================
   * QUANTIDADE DE CATEGORIAS
   *
   * A ordem já vem calculada por relevância.
   * ==========================================================
   */

  const categoriasPrincipais = categorias;

  return (
    <div>
      {/* ======================================================
          TOPO
          ====================================================== */}

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-10">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl md:text-4xl">
              Farmácia Francy, credibilidade popular
            </h1>
          </div>

          <BannerCarousel />
        </div>
      </section>

      {/* ======================================================
          BENEFÍCIOS
          ====================================================== */}

      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 sm:grid-cols-3">
          {beneficios.map((beneficio) => (
            <div key={beneficio.titulo} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <beneficio.icone className="size-5" />
              </span>

              <div>
                <p className="text-sm font-semibold text-primary">{beneficio.titulo}</p>

                <p className="text-xs text-muted-foreground">{beneficio.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================
          RASGA PREÇO
          ====================================================== */}

      <RasgaPreco />

      {/* ======================================================
          CATEGORIAS
          ====================================================== */}

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-primary sm:text-2xl">Categorias</h2>

          <p className="text-xs text-muted-foreground">
            Categorias organizadas pela disponibilidade de produtos com imagem.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {categoriasPrincipais.map((categoria) => (
            <Link
              key={categoria.slug}
              to="/categoria/$slug"
              params={{
                slug: categoria.slug,
              }}
              className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
            >
              <span className="text-3xl">{categoria.icone}</span>

              <span className="text-xs font-semibold leading-snug">{categoria.nome}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================
          OFERTAS
          ====================================================== */}

      <Vitrine
        titulo="Ofertas da semana"
        subtitulo="Produtos com imagem e maior relevância aparecem primeiro."
        itens={ofertas}
      />

      {/* ======================================================
          MAIS PROCURADOS
          ====================================================== */}

      <Vitrine
        titulo="Mais procurados"
        subtitulo="Os produtos disponíveis com imagem recebem prioridade."
        itens={maisProcurados}
      />
    </div>
  );
}

/* ============================================================
   VITRINE
   ============================================================ */

function Vitrine({ titulo, subtitulo, itens }: { titulo: string; subtitulo?: string; itens: Produto[] }) {
  /*
   * Segurança adicional.
   *
   * Mesmo que os produtos tenham chegado
   * de outra fonte, são reorganizados aqui.
   */

  const produtosOrdenados = ordenarProdutosPorRelevancia(itens);

  /*
   * Separa visualmente a prioridade.
   */

  const produtosComImagem = produtosOrdenados.filter(produtoTemImagem);

  const produtosSemImagem = produtosOrdenados.filter((produto) => !produtoTemImagem(produto));

  const produtos = [...produtosComImagem, ...produtosSemImagem];

  /*
   * Não renderiza seção vazia.
   */

  if (produtos.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-primary sm:text-2xl">{titulo}</h2>

        {subtitulo && <p className="mt-1 text-xs text-muted-foreground">{subtitulo}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {produtos.map((produto) => (
          <ProductCard key={produto.id} produto={produto} />
        ))}
      </div>
    </section>
  );
}
