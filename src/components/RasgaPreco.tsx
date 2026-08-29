import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

const VELOCIDADE_AUTO = 40;

// Quanto tempo aproximadamente leva para voltar
// à velocidade automática depois de soltar.
const TRANSICAO_VELOCIDADE = 1.2;

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offset = useRef(0);
  const largura = useRef(0);

  const arrastando = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  // Velocidade atual da faixa.
  const velocidadeAtual = useRef(VELOCIDADE_AUTO);

  // Velocidade que queremos atingir.
  const velocidadeAlvo = useRef(VELOCIDADE_AUTO);

  const moveu = useRef(false);

  const aplicar = useCallback(() => {
    const larguraCopia = largura.current;

    if (larguraCopia > 0) {
      /*
       * Mantém o deslocamento dentro da primeira cópia.
       * Quando chega ao final, volta para o começo
       * sem o usuário perceber.
       */
      offset.current = ((offset.current % larguraCopia) + larguraCopia) % larguraCopia;

      offset.current -= larguraCopia;
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  /*
   * Mede a largura da primeira cópia dos produtos.
   */
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

  /*
   * MOTOR PRINCIPAL DA ANIMAÇÃO
   */
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
      /*
       * Limita o delta para evitar um salto enorme
       * quando a aba fica em segundo plano.
       */
      const deltaTempo = Math.min((agora - anterior) / 1000, 0.05);

      anterior = agora;

      if (!reduzirMovimento) {
        /*
         * Transição suave entre a velocidade atual
         * e a velocidade desejada.
         */
        const diferenca = velocidadeAlvo.current - velocidadeAtual.current;

        velocidadeAtual.current += diferenca * Math.min(1, deltaTempo / TRANSICAO_VELOCIDADE);

        /*
         * Evita ficar infinitamente próximo de um valor
         * sem nunca chegar nele.
         */
        if (Math.abs(diferenca) < 0.05) {
          velocidadeAtual.current = velocidadeAlvo.current;
        }

        /*
         * Quando o usuário NÃO está arrastando,
         * a faixa continua andando.
         */
        if (!arrastando.current) {
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

  if (itens.length === 0) {
    return null;
  }

  /*
   * DUPLICAÇÃO SOMENTE PARA CRIAR O LOOP INFINITO.
   *
   * Se o administrador cadastrar:
   *
   * 10 produtos -> 20 elementos visuais
   * 20 produtos -> 40 elementos visuais
   * 50 produtos -> 100 elementos visuais
   *
   * Portanto, não existe limite de 10 produtos.
   */
  const trilha = [...itens, ...itens];

  /*
   * COMEÇOU A ARRASTAR
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastando.current = true;

    moveu.current = false;

    inicioX.current = e.clientX;

    inicioOffset.current = offset.current;

    /*
     * Enquanto arrasta, a velocidade automática
     * vai suavemente para zero.
     */
    velocidadeAlvo.current = 0;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /*
   * DURANTE O ARRASTO
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const delta = e.clientX - inicioX.current;

    if (Math.abs(delta) > 4) {
      moveu.current = true;
    }

    /*
     * O produto acompanha exatamente
     * o movimento do mouse.
     */
    offset.current = inicioOffset.current + delta;

    aplicar();
  };

  /*
   * SOLTOU O MOUSE / DEDO
   */
  const finalizar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    arrastando.current = false;

    /*
     * NÃO paramos a animação instantaneamente.
     *
     * Ela vai gradualmente de:
     *
     * 0 → 10 → 20 → 30 → 40
     *
     * até voltar à velocidade normal.
     */
    velocidadeAlvo.current = VELOCIDADE_AUTO;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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
        style={{
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onClickCapture={(e) => {
          /*
           * Se o usuário arrastou a faixa,
           * não abre o produto.
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
