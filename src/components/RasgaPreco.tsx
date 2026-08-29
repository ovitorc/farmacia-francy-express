import { useCallback, useEffect, useMemo, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog";

const VELOCIDADE = 40;
const RETOMAR_APOS = 1500;

// Quantas cópias da lista serão criadas.
// Pode aumentar para 10, 20, 50 etc.
const REPETICOES = 20;

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);
  const offset = useRef(0);
  const largura = useRef(0);

  const pausado = useRef(false);
  const arrastando = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Cria várias cópias dos produtos.
   *
   * Exemplo:
   * 5 produtos × 20 repetições = 100 cards
   *
   * Isso faz o carrossel continuar funcionando mesmo
   * quando existem poucos produtos no Rasga Preço.
   */
  const trilha = useMemo(() => {
    if (itens.length === 0) return [];

    return Array.from({ length: REPETICOES }, () => itens).flat();
  }, [itens]);

  const aplicar = useCallback(() => {
    const l = largura.current;

    if (l > 0) {
      /*
       * O tamanho de uma repetição completa.
       * Quando chega ao final, volta para o começo
       * sem o usuário perceber.
       */
      offset.current = ((offset.current % l) + l) % l;
      offset.current -= l;
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  const pausar = useCallback(() => {
    pausado.current = true;

    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const agendarRetomada = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      pausado.current = false;
    }, RETOMAR_APOS);
  }, []);

  /*
   * Mede apenas UMA cópia da lista.
   *
   * Como a trilha possui várias repetições,
   * usamos o tamanho total dividido pela quantidade
   * de repetições.
   */
  useEffect(() => {
    const el = trilhaRef.current;

    if (!el || itens.length === 0) return;

    const medir = () => {
      largura.current = el.scrollWidth / REPETICOES;
      aplicar();
    };

    medir();

    const ro = new ResizeObserver(medir);
    ro.observe(el);

    return () => {
      ro.disconnect();
    };
  }, [aplicar, itens.length]);

  /*
   * Animação automática.
   */
  useEffect(() => {
    if (itens.length === 0) return;

    const reduz = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let anterior = performance.now();

    const aoVoltar = () => {
      anterior = performance.now();
    };

    document.addEventListener("visibilitychange", aoVoltar);

    const passo = (agora: number) => {
      const dt = (agora - anterior) / 1000;

      anterior = agora;

      if (!pausado.current && !arrastando.current && !reduz) {
        offset.current -= VELOCIDADE * dt;
        aplicar();
      }

      raf = requestAnimationFrame(passo);
    };

    raf = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(raf);

      document.removeEventListener("visibilitychange", aoVoltar);

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [aplicar, itens.length]);

  if (itens.length === 0) {
    return null;
  }

  /*
   * Começa o arraste.
   *
   * IMPORTANTE:
   * Se o usuário clicar em um botão,
   * não inicia o arraste.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    if (target.closest("button")) {
      return;
    }

    arrastando.current = true;

    inicioX.current = e.clientX;
    inicioOffset.current = offset.current;

    pausar();

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /*
   * Movimento do arraste.
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const delta = e.clientX - inicioX.current;

    offset.current = inicioOffset.current + delta;

    aplicar();
  };

  /*
   * Finaliza o arraste.
   */
  const finalizar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    arrastando.current = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    agendarRetomada();
  };

  return (
    <section className="py-8">
      <div className="mx-auto mb-5 flex max-w-7xl items-center gap-3 px-6">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-brand-red-foreground">
          <Flame className="size-5" />
        </span>

        <div>
          <h2 className="text-xl font-bold text-brand-red sm:text-2xl">Rasga Preço</h2>

          <p className="text-xs text-muted-foreground">Ofertas válidas de quinta a domingo, toda semana.</p>
        </div>
      </div>

      <div
        className="relative overflow-hidden px-6"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
      >
        <div ref={trilhaRef} className="flex w-max cursor-grab active:cursor-grabbing">
          {trilha.map((p, i) => (
            <div key={`${p.id}-${i}`} className="w-44 shrink-0 pr-4 sm:w-52">
              <ProductCard produto={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
