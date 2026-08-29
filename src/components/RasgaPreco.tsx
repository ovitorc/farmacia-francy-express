import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

const VELOCIDADE = 40; // pixels por segundo
const RETOMAR_APOS = 1500; // tempo para voltar a andar depois de interação

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offset = useRef(0);
  const larguraCopia = useRef(0);

  const pausado = useRef(false);
  const arrastando = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  const moveu = useRef(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * Aplica a posição da trilha.
   *
   * A trilha possui duas cópias dos produtos.
   * Quando chega ao final da primeira cópia,
   * voltamos para o início sem o usuário perceber.
   */
  const aplicarPosicao = useCallback(() => {
    const largura = larguraCopia.current;

    if (largura > 0) {
      /*
       * Mantém o offset sempre dentro da primeira cópia.
       * Isso cria o efeito de loop infinito.
       */
      while (offset.current <= -largura) {
        offset.current += largura;
      }

      while (offset.current > 0) {
        offset.current -= largura;
      }
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  /*
   * Agenda a retomada automática depois que o usuário
   * terminar de arrastar.
   */
  const agendarRetomada = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      pausado.current = false;
    }, RETOMAR_APOS);
  }, []);

  /*
   * Pausa o movimento automático.
   */
  const pausar = useCallback(() => {
    pausado.current = true;

    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /*
   * Mede exatamente a largura de UMA cópia dos produtos.
   *
   * Como duplicamos a lista:
   *
   * [produto1 ... produtoN][produto1 ... produtoN]
   *
   * scrollWidth / 2 = largura de uma cópia.
   */
  useEffect(() => {
    const elemento = trilhaRef.current;

    if (!elemento) return;

    const medir = () => {
      larguraCopia.current = elemento.scrollWidth / 2;
      aplicarPosicao();
    };

    medir();

    const observer = new ResizeObserver(medir);
    observer.observe(elemento);

    window.addEventListener("resize", medir);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [aplicarPosicao, itens.length]);

  /*
   * ANIMAÇÃO AUTOMÁTICA
   *
   * Essa parte é a responsável por fazer os produtos
   * andarem automaticamente da direita para a esquerda.
   *
   * requestAnimationFrame funciona tanto em desktop
   * quanto em celular.
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
       * Só movimenta quando não estiver pausado
       * e o usuário não estiver arrastando.
       */
      if (!pausado.current && !arrastando.current) {
        offset.current -= VELOCIDADE * delta;

        aplicarPosicao();
      }

      animationFrame = requestAnimationFrame(animar);
    };

    animationFrame = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(animationFrame);

      document.removeEventListener("visibilitychange", resetarTempo);

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [aplicarPosicao, itens.length]);

  if (itens.length === 0) {
    return null;
  }

  /*
   * IMPORTANTE:
   *
   * Não limitamos os produtos a 10.
   *
   * Se o administrador cadastrar:
   *
   * 5 produtos  -> mostra 5
   * 10 produtos -> mostra 10
   * 11 produtos -> mostra 11
   * 20 produtos -> mostra 20
   * 50 produtos -> mostra 50
   *
   * A duplicação abaixo existe SOMENTE para criar
   * o loop infinito visual.
   */
  const trilha = [...itens, ...itens];

  /*
   * Início do arraste.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    arrastando.current = true;
    moveu.current = false;

    inicioX.current = e.clientX;
    inicioOffset.current = offset.current;

    pausar();

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /*
   * Movimento manual.
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const delta = e.clientX - inicioX.current;

    if (Math.abs(delta) > 4) {
      moveu.current = true;
    }

    offset.current = inicioOffset.current + delta;

    aplicarPosicao();
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

    /*
     * Depois de 1,5 segundo o movimento automático
     * volta sozinho.
     */
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
        className="relative overflow-hidden px-6 select-none"
        style={{
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        onClickCapture={(e) => {
          /*
           * Se o usuário arrastou o carrossel,
           * não queremos abrir o produto acidentalmente.
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
