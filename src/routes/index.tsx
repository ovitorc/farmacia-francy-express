import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Truck, ShieldCheck, Clock } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { RasgaPreco } from "@/components/RasgaPreco";
import popularAsset from "@/assets/farmacia-popular.png.asset.json";
import { WHATSAPP_URL, type Produto } from "@/lib/catalog";
import { useCatalogo } from "@/lib/catalog-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Farmácias Francy | Credibilidade popular em João Pessoa" },
      {
        name: "description",
        content:
          "Medicamentos, higiene, perfumaria e cuidados diários com preço justo na Farmácias Francy. Monte seu pedido online e finalize pelo WhatsApp.",
      },
      { property: "og:title", content: "Farmácias Francy | Credibilidade popular" },
      {
        property: "og:description",
        content: "Sua farmácia de bairro em João Pessoa, agora também online. Pedido pelo WhatsApp.",
      },
    ],
  }),
  component: Index,
});

const beneficios = [
  { icone: Truck, titulo: "Entrega no bairro", texto: "Combine a entrega pelo WhatsApp" },
  { icone: ShieldCheck, titulo: "Produtos registrados", texto: "Farmacêutica responsável presente" },
  { icone: Clock, titulo: "Seg a sex, 8h às 17h30", texto: "Atendimento humano e rápido" },
];

function Index() {
  const { categorias, ofertas: emOferta, rasgaPreco, destaques } = useCatalogo();
  const ofertas = emOferta.slice(0, 10);
  const usados = new Set([...ofertas, ...rasgaPreco].map((p) => p.id));
  const maisVendidos = destaques.filter((p) => !usados.has(p.id)).slice(0, 10);



  return (
    <div>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-10 md:grid-cols-2 md:py-16">
          <div>
            <span className="inline-block rounded-full bg-brand-red px-3 py-1 text-xs font-bold text-brand-red-foreground">
              CREDIBILIDADE POPULAR
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Sua farmácia de bairro, agora também online
            </h1>
            <p className="mt-4 max-w-lg text-sm text-primary-foreground/85 sm:text-base">
              Medicamentos, higiene, perfumaria e cuidados diários com preço justo. Monte seu
              pedido no site e finalize com a nossa equipe pelo WhatsApp.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-brand-red-foreground transition-opacity hover:opacity-90"
              >
                <MessageCircle className="size-4" /> Falar no WhatsApp
              </a>
              <Link
                to="/categoria/$slug"
                params={{ slug: "medicamentos" }}
                className="inline-flex items-center rounded-full border border-primary-foreground/30 px-5 py-3 text-sm font-semibold transition-colors hover:bg-primary-foreground/10"
              >
                Ver medicamentos
              </Link>
            </div>
          </div>
          <Link
            to="/farmacia-popular"
            className="mx-auto w-44 transition-transform hover:scale-105 md:w-56 md:justify-self-end"
          >
            <img src={popularAsset.url} alt="Aqui tem Farmácia Popular" className="w-full" />
          </Link>
        </div>
      </section>

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

      <RasgaPreco />

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

      <Vitrine titulo="Ofertas da semana" itens={ofertas} />
      <Vitrine titulo="Mais procurados" itens={maisVendidos} />
    </div>
  );
}

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
