import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog";

const VELOCIDADE = 45; // pixels por segundo
const RETOMAR_APOS = 1200; // tempo para voltar a andar após arrastar

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offsetRef = useRef(0);
  const larguraCopiaRef = useRef(0);

  const arrastandoRef = useRef(false);
  const pausadoRef = useRef(false);

  const inicioXRef = useRef(0);
  const inicioOffsetRef = useRef(0);

  const moveuRef = useRef(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Aplica o deslocamento visual da trilha.
   */
  const aplicarOffset = useCallback(() => {
    const largura = larguraCopiaRef.current;

    if (largura > 0) {
      /*
       * Mantém o offset sempre dentro do tamanho
       * de uma cópia dos produtos.
       *
       * Isso cria o efeito de loop infinito.
       */
      while (offsetRef.current <= -largura) {
        offsetRef.current += largura;
      }

      while (offsetRef.current > 0) {
        offsetRef.current -= largura;
      }
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  /*
   * Pausa temporariamente a animação.
   */
  const pausar = useCallback(() => {
    pausadoRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /*
   * Volta a animação depois que o usuário termina
   * de arrastar.
   */
  const retomarDepois = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      pausadoRef.current = false;
    }, RETOMAR_APOS);
  }, []);

  /*
   * Mede a largura da primeira cópia dos produtos.
   *
   * A trilha contém:
   *
   * produtos
   * produtos
   *
   * Portanto scrollWidth / 2 representa uma cópia.
   */
  useEffect(() => {
    const elemento = trilhaRef.current;

    if (!elemento) return;

    const medir = () => {
      larguraCopiaRef.current = elemento.scrollWidth / 2;
      aplicarOffset();
    };

    medir();

    const observer = new ResizeObserver(medir);
    observer.observe(elemento);

    window.addEventListener("resize", medir);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [aplicarOffset, itens.length]);

  /*
   * ANIMAÇÃO AUTOMÁTICA
   *
   * Essa parte é independente de touch.
   *
   * Portanto funciona:
   *
   * - desktop
   * - notebook
   * - celular
   * - tablet
   */
  useEffect(() => {
    if (itens.length === 0) return;

    let animationFrame = 0;
    let anterior = performance.now();

    const resetarTempo = () => {
      anterior = performance.now();
    };

    document.addEventListener("visibilitychange", resetarTempo);

    const animar = (agora: number) => {
      const delta = (agora - anterior) / 1000;

      anterior = agora;

      /*
       * Não anima enquanto o usuário está arrastando.
       */
      if (!pausadoRef.current && !arrastandoRef.current) {
        /*
         * Movimento para a ESQUERDA.
         */
        offsetRef.current -= VELOCIDADE * delta;

        aplicarOffset();
      }

      animationFrame = requestAnimationFrame(animar);
    };

    animationFrame = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(animationFrame);

      document.removeEventListener("visibilitychange", resetarTempo);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [aplicarOffset, itens.length]);

  /*
   * Início do arraste.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastandoRef.current = true;
    moveuRef.current = false;

    inicioXRef.current = e.clientX;
    inicioOffsetRef.current = offsetRef.current;

    pausar();

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /*
   * Movimento do mouse/dedo.
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastandoRef.current) return;

    const delta = e.clientX - inicioXRef.current;

    if (Math.abs(delta) > 5) {
      moveuRef.current = true;
    }

    offsetRef.current = inicioOffsetRef.current + delta;

    aplicarOffset();
  };

  /*
   * Finaliza o arraste.
   */
  const finalizarArraste = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastandoRef.current) return;

    arrastandoRef.current = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    retomarDepois();
  };

  /*
   * Evita abrir o produto quando o usuário
   * estava arrastando a vitrine.
   */
  const bloquearCliqueDepoisDoArraste = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moveuRef.current) {
      e.preventDefault();
      e.stopPropagation();

      moveuRef.current = false;
    }
  };

  if (itens.length === 0) {
    return null;
  }

  /*
   * Fazemos duas cópias.
   *
   * Isso NÃO significa limitar a 10 produtos.
   *
   * Se o administrador colocar:
   *
   * 5 produtos  -> 5 + 5
   * 20 produtos -> 20 + 20
   * 50 produtos -> 50 + 50
   * 100 produtos -> 100 + 100
   *
   * A quantidade depende diretamente do painel.
   */
  const trilha = [...itens, ...itens];

  return (
    <section className="py-8">
      {/* Título */}
      <div className="mx-auto mb-5 flex max-w-7xl items-center gap-3 px-6">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-brand-red-foreground">
          <Flame className="size-5" />
        </span>

        <div>
          <h2 className="text-xl font-bold text-brand-red sm:text-2xl">Rasga Preço</h2>

          <p className="text-xs text-muted-foreground">Ofertas válidas de quinta a domingo, toda semana.</p>
        </div>
      </div>

      {/* Área da vitrine */}
      <div
        className="relative select-none overflow-hidden px-6"
        style={{
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizarArraste}
        onPointerCancel={finalizarArraste}
        onPointerLeave={(e) => {
          /*
           * No desktop, se o mouse sair enquanto estiver
           * capturado, o pointer capture continua funcionando.
           */
          if (arrastandoRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
            return;
          }
        }}
        onClickCapture={bloquearCliqueDepoisDoArraste}
      >
        <div
          ref={trilhaRef}
          className="flex w-max cursor-grab active:cursor-grabbing"
          style={{
            willChange: "transform",
          }}
        >
          {trilha.map((produto, index) => (
            <div key={`${produto.id}-${index}`} className="w-44 shrink-0 pr-4 sm:w-52">
              <ProductCard produto={produto} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
