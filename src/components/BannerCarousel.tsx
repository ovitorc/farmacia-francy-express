import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listarBanners } from "@/lib/catalog.functions";

const INTERVALO = 4000;

export function BannerCarousel() {
  const { data: banners = [] } = useQuery({
    queryKey: ["banners"],
    queryFn: () => listarBanners(),
    staleTime: 60_000,
  });

  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setAtual((i) => (i + 1) % banners.length), INTERVALO);
    return () => clearInterval(t);
  }, [banners.length]);

  useEffect(() => {
    if (atual >= banners.length) setAtual(0);
  }, [banners.length, atual]);

  if (banners.length === 0) return null;

  return (
    <section aria-label="Banners promocionais" className="bg-background">
      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="relative aspect-[16/6] w-full overflow-hidden rounded-2xl bg-muted shadow-card">
          {banners.map((b, i) => {
            const conteudo = (
              <img
                src={b.imagem}
                alt={b.titulo || "Banner promocional Farmácias Francy"}
                className="h-full w-full object-cover"
                loading={i === 0 ? "eager" : "lazy"}
              />
            );

            return (
              <div
                key={b.id}
                aria-hidden={i !== atual}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                  i === atual ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {b.link ? (
                  b.link.startsWith("http") ? (
                    <a href={b.link} target="_blank" rel="noreferrer" className="block h-full w-full">
                      {conteudo}
                    </a>
                  ) : (
                    <Link to={b.link} className="block h-full w-full">
                      {conteudo}
                    </Link>
                  )
                ) : (
                  conteudo
                )}
              </div>
            );
          })}

          {banners.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  aria-label={`Ir para o banner ${i + 1}`}
                  onClick={() => setAtual(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === atual ? "w-6 bg-background" : "w-2 bg-background/60"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
