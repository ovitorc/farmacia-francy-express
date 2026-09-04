import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

const VELOCIDADE_AUTO = 40;

// Tempo (ms) de espera antes de retomar a animação
// depois que o usuário termina a interação.
const ESPERA_RETOMADA = 1000;

// Suavização da transição de velocidade (segundos).
const TRANSICAO_VELOCIDADE = 0.6;

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offset = useRef(0);
  const largura = useRef(0);

  const arrastando = useRef(false);
  const interagindo = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  const velocidadeAtual = useRef(VELOCIDADE_AUTO);
  const velocidadeAlvo = useRef(VELOCIDADE_AUTO);

  const moveu = useRef(false);

  const timerRetomada = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarRetomada = useCallback(() => {
    if (timerRetomada.current) {
      clearTimeout(timerRetomada.current);
      timerRetomada.current = null;
    }
  }, []);

  const pausar = useCallback(() => {
    cancelarRetomada();
    interagindo.current = true;
    velocidadeAlvo.current = 0;
  }, [cancelarRetomada]);

  const agendarRetomada = useCallback(() => {
    cancelarRetomada();

    timerRetomada.current = setTimeout(() => {
      timerRetomada.current = null;
      interagindo.current = false;
      velocidadeAlvo.current = VELOCIDADE_AUTO;
    }, ESPERA_RETOMADA);
  }, [cancelarRetomada]);

  const aplicar = useCallback(() => {
    const larguraCopia = largura.current;

    if (larguraCopia > 0) {
      offset.current = ((offset.current % larguraCopia) + larguraCopia) % larguraCopia;
      offset.current -= larguraCopia;
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  /* Mede a largura de uma cópia da lista. */
  useEffect(() => {
    const elemento = trilhaRef.current;

    if (!elemento) return;

    const medir = () => {
      largura.current = elemento.scrollWidth / 2;
      aplicar();
    };

    medir();

    const observer = new ResizeObserver(medir);
    observer.observe(elemento);

    return () => observer.disconnect();
  }, [aplicar, itens.length]);

  /* Motor da animação. */
  useEffect(() => {
    if (itens.length === 0) return;

    const reduzirMovimento =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let anterior = performance.now();

    const corrigirTempo = () => {
      anterior = performance.now();
    };

    document.addEventListener("visibilitychange", corrigirTempo);

    const animar = (agora: number) => {
      const deltaTempo = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;

      if (!reduzirMovimento) {
        const diferenca = velocidadeAlvo.current - velocidadeAtual.current;

        velocidadeAtual.current += diferenca * Math.min(1, deltaTempo / TRANSICAO_VELOCIDADE);

        if (Math.abs(diferenca) < 0.05) {
          velocidadeAtual.current = velocidadeAlvo.current;
        }

        if (!arrastando.current && velocidadeAtual.current !== 0) {
          offset.current -= velocidadeAtual.current * deltaTempo;
          aplicar();
        }
      }

      frame = requestAnimationFrame(animar);
    };

    frame = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", corrigirTempo);
    };
  }, [aplicar, itens.length]);

  /* Limpeza de timers ao desmontar. */
  useEffect(() => cancelarRetomada, [cancelarRetomada]);

  if (itens.length === 0) {
    return null;
  }

  const trilha = [...itens, ...itens];

  /*
   * Captura o início da interação ANTES de qualquer
   * elemento filho (botões e links) tratar o evento.
   * Assim a animação pausa sempre, mas o arraste só
   * começa fora de botões/links.
   */
  const onPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    pausar();

    moveu.current = false;

    const alvo = e.target as HTMLElement | null;
    const interativo = alvo?.closest("button, a, input, textarea, select");

    if (interativo) {
      arrastando.current = false;
      return;
    }

    arrastando.current = true;
    inicioX.current = e.clientX;
    inicioOffset.current = offset.current;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const delta = e.clientX - inicioX.current;

    if (Math.abs(delta) > 4) {
      moveu.current = true;
    }

    offset.current = inicioOffset.current + delta;

    aplicar();
  };

  const finalizar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (arrastando.current) {
      arrastando.current = false;

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
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
        className="relative select-none overflow-hidden px-6"
        style={{ touchAction: "pan-y" }}
        onPointerDownCapture={onPointerDownCapture}
        onPointerMove={onPointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onMouseEnter={pausar}
        onMouseLeave={agendarRetomada}
        onClickCapture={(e) => {
          if (moveu.current) {
            e.preventDefault();
            e.stopPropagation();

            moveu.current = false;
          }
        }}
      >
        <div
          ref={trilhaRef}
          className="flex w-max cursor-grab active:cursor-grabbing"
          style={{ willChange: "transform" }}
        >
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
