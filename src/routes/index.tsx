import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Truck, ShieldCheck, Clock } from "lucide-react";

import { ProductCard } from "@/components/ProductCard";
import { RasgaPreco } from "@/components/RasgaPreco";
import { WHATSAPP_URL, type Produto } from "@/lib/catalog";
import { useCatalogo } from "@/lib/catalog-context";
import { listarBannersPublicos } from "@/lib/admin.functions";

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
    titulo: "Seg a sex, 8h às 17h30",
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
  ativo: boolean;
  ordem: number;
};

/* ============================================================
   CARROSSEL DE BANNERS
   ============================================================ */

function BannerCarousel() {
  const [bannerAtual, setBannerAtual] = useState(0);

  const {
    data: banners = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["banners"],
    queryFn: () => listarBannersPublicos(),
  });

  /* ==========================================================
     QUANDO OS BANNERS MUDAM
     ========================================================== */

  useEffect(() => {
    setBannerAtual(0);
  }, [banners.length]);

  /* ==========================================================
     CARROSSEL AUTOMÁTICO
     ========================================================== */

  useEffect(() => {
    if (banners.length <= 1) {
      return;
    }

    const intervalo = setInterval(() => {
      setBannerAtual((atual) => (atual + 1) % banners.length);
    }, 4000);

    return () => {
      clearInterval(intervalo);
    };
  }, [banners.length]);

  /* ==========================================================
     CARREGANDO
     ========================================================== */

  if (isLoading) {
    return (
      <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl border border-border bg-muted/40">
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
      <div className="relative flex aspect-[16/6] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Não foi possível carregar os banners.</p>

          <p className="mt-1 text-xs text-muted-foreground/70">Verifique a configuração dos banners.</p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     NENHUM BANNER
     ========================================================== */

  if (banners.length === 0) {
    return (
      <div className="relative flex aspect-[16/6] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">Área de banners promocionais</p>

          <p className="mt-1 text-xs text-muted-foreground/70">Os banners serão adicionados pela administração.</p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     BANNERS
     ========================================================== */

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      <div className="relative aspect-[16/6] w-full overflow-hidden bg-muted">
        {banners.map((banner: Banner, index: number) => (
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

      {/* ======================================================
          BOLINHAS DE NAVEGAÇÃO
          ====================================================== */}

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/30 px-3 py-2 backdrop-blur-sm">
          {banners.map((banner: Banner, index: number) => (
            <button
              key={banner.id}
              type="button"
              aria-label={`Ir para o banner ${index + 1}`}
              onClick={() => setBannerAtual(index)}
              className={`rounded-full transition-all duration-300 ${
                index === bannerAtual ? "h-2.5 w-6 bg-white" : "size-2.5 bg-white/60 hover:bg-white/90"
              }`}
            />
          ))}
        </div>
      )}

      {/* ======================================================
          SETA ESQUERDA
          ====================================================== */}

      {banners.length > 1 && (
        <button
          type="button"
          aria-label="Banner anterior"
          onClick={() => setBannerAtual((bannerAtual - 1 + banners.length) % banners.length)}
          className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur-sm transition hover:bg-black/50"
        >
          ‹
        </button>
      )}

      {/* ======================================================
          SETA DIREITA
          ====================================================== */}

      {banners.length > 1 && (
        <button
          type="button"
          aria-label="Próximo banner"
          onClick={() => setBannerAtual((bannerAtual + 1) % banners.length)}
          className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-2xl text-white backdrop-blur-sm transition hover:bg-black/50"
        >
          ›
        </button>
      )}
    </div>
  );
}

/* ============================================================
   HOME
   ============================================================ */

function Index() {
  const { categorias, ofertas: emOferta, rasgaPreco, destaques } = useCatalogo();

  const ofertas = emOferta.slice(0, 10);

  const usados = new Set([...ofertas, ...rasgaPreco].map((p) => p.id));

  const maisVendidos = destaques.filter((p) => !usados.has(p.id)).slice(0, 10);

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
          {beneficios.map((b) => (
            <div key={b.titulo} className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <b.icone className="size-5" />
              </span>

              <div>
                <p className="text-sm font-semibold text-primary">{b.titulo}</p>

                <p className="text-xs text-muted-foreground">{b.texto}</p>
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
        <h2 className="text-xl font-bold text-primary sm:text-2xl">Categorias</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {categorias.map((c) => (
            <Link
              key={c.slug}
              to="/categoria/$slug"
              params={{ slug: c.slug }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card"
            >
              <span className="text-2xl">{c.icone}</span>

              <span className="text-xs font-medium leading-snug">{c.nome}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================
          OFERTAS
          ====================================================== */}

      <Vitrine titulo="Ofertas da semana" itens={ofertas} />

      {/* ======================================================
          MAIS PROCURADOS
          ====================================================== */}

      <Vitrine titulo="Mais procurados" itens={maisVendidos} />
    </div>
  );
}

/* ============================================================
   VITRINE
   ============================================================ */

function Vitrine({ titulo, itens }: { titulo: string; itens: Produto[] }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <h2 className="mb-4 text-xl font-bold text-primary sm:text-2xl">{titulo}</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {itens.map((p) => (
          <ProductCard key={p.id} produto={p} />
        ))}
      </div>
    </section>
  );
}
