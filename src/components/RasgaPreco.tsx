import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

const VELOCIDADE = 40; // velocidade normal em px por segundo
const SUAVIDADE = 5; // quanto maior, mais rápida a aceleração/desaceleração

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offset = useRef(0);
  const largura = useRef(0);

  const arrastando = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  const moveu = useRef(false);

  // Velocidade atual da animação
  const velocidadeAtual = useRef(VELOCIDADE);

  // Velocidade desejada
  const velocidadeAlvo = useRef(VELOCIDADE);

  const aplicar = useCallback(() => {
    const l = largura.current;

    if (l > 0) {
      /*
       * Mantém o deslocamento dentro de uma única cópia.
       * Isso permite o loop infinito.
       */
      offset.current = ((offset.current % l) + l) % l;
      offset.current -= l;
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  /*
   * Mede a largura de uma cópia da lista.
   */
  useEffect(() => {
    const el = trilhaRef.current;

    if (!el) return;

    const medir = () => {
      largura.current = el.scrollWidth / 2;
      aplicar();
    };

    medir();

    const ro = new ResizeObserver(medir);
    ro.observe(el);

    return () => ro.disconnect();
  }, [aplicar, itens.length]);

  /*
   * Animação automática.
   *
   * A velocidade não muda instantaneamente.
   * Ela vai se aproximando da velocidade desejada
   * de maneira suave.
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
      const dt = Math.min((agora - anterior) / 1000, 0.05);

      anterior = agora;

      if (!reduz) {
        /*
         * Suaviza a mudança da velocidade.
         *
         * Exemplo:
         * 40 -> 32 -> 25 -> 18 -> 10 -> 0
         *
         * em vez de:
         * 40 -> 0
         */
        velocidadeAtual.current += (velocidadeAlvo.current - velocidadeAtual.current) * Math.min(1, SUAVIDADE * dt);

        /*
         * Só movimenta automaticamente quando
         * o usuário não está arrastando.
         */
        if (!arrastando.current) {
          offset.current -= velocidadeAtual.current * dt;
          aplicar();
        }
      }

      raf = requestAnimationFrame(passo);
    };

    raf = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [aplicar, itens.length]);

  if (itens.length === 0) return null;

  /*
   * Duas cópias são necessárias para criar
   * o efeito de rolagem infinita.
   *
   * Isso NÃO limita a quantidade de produtos.
   * Todos os produtos cadastrados no painel
   * serão utilizados.
   */
  const trilha = [...itens, ...itens];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastando.current = true;

    moveu.current = false;

    inicioX.current = e.clientX;
    inicioOffset.current = offset.current;

    /*
     * Quando começa a arrastar,
     * a velocidade alvo vai para zero.
     *
     * A velocidade atual também vai desacelerar
     * suavemente, em vez de parar de uma vez.
     */
    velocidadeAlvo.current = 0;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const delta = e.clientX - inicioX.current;

    if (Math.abs(delta) > 4) {
      moveu.current = true;
    }

    /*
     * O movimento do mouse controla diretamente
     * a posição enquanto o cliente arrasta.
     */
    offset.current = inicioOffset.current + delta;

    aplicar();
  };

  const finalizar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    arrastando.current = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    /*
     * Depois que o usuário solta o mouse,
     * a velocidade volta gradualmente para a normal.
     *
     * Portanto:
     *
     * solta o mouse
     * ↓
     * 0 px/s
     * ↓
     * 8 px/s
     * ↓
     * 18 px/s
     * ↓
     * 30 px/s
     * ↓
     * 40 px/s
     */
    velocidadeAlvo.current = VELOCIDADE;
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onClickCapture={(e) => {
          /*
           * Evita abrir o produto quando o usuário
           * estava arrastando a vitrine.
           */
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
          style={{
            willChange: "transform",
          }}
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
