import { useCallback, useEffect, useRef } from "react";
import { Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

const VELOCIDADE_AUTO = 40;
const ACELERACAO_AUTO = 3;
const DESACELERACAO_INERCIA = 2.8;
const VELOCIDADE_MAXIMA_INERCIA = 700;

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();

  const trilhaRef = useRef<HTMLDivElement | null>(null);

  const offset = useRef(0);
  const largura = useRef(0);

  const arrastando = useRef(false);

  const inicioX = useRef(0);
  const inicioOffset = useRef(0);

  const ultimoX = useRef(0);
  const ultimoTempo = useRef(0);

  const velocidade = useRef(0);

  const moveu = useRef(false);

  const aplicar = useCallback(() => {
    const l = largura.current;

    if (l > 0) {
      offset.current = ((offset.current % l) + l) % l;
      offset.current -= l;
    }

    if (trilhaRef.current) {
      trilhaRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
    }
  }, []);

  /*
   * Mede a largura de UMA cópia da lista.
   */
  useEffect(() => {
    const el = trilhaRef.current;

    if (!el) return;

    const medir = () => {
      largura.current = el.scrollWidth / 2;
      aplicar();
    };

    medir();

    const observer = new ResizeObserver(medir);
    observer.observe(el);

    return () => observer.disconnect();
  }, [aplicar, itens.length]);

  /*
   * MOTOR DA ANIMAÇÃO
   *
   * Existem três estados:
   *
   * 1. Rolando automaticamente
   * 2. Usuário arrastando
   * 3. Inércia depois que o usuário solta
   */
  useEffect(() => {
    if (itens.length === 0) return;

    const reduzirMovimento =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let anterior = performance.now();

    const voltarPagina = () => {
      anterior = performance.now();
    };

    document.addEventListener("visibilitychange", voltarPagina);

    const animar = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);

      anterior = agora;

      if (!reduzirMovimento && !arrastando.current) {
        /*
         * Quando a velocidade é maior que a velocidade automática,
         * significa que o usuário acabou de soltar o mouse.
         *
         * Nesse momento a velocidade vai diminuindo suavemente.
         */
        if (Math.abs(velocidade.current) > VELOCIDADE_AUTO) {
          const sinal = velocidade.current > 0 ? 1 : -1;

          velocidade.current -= sinal * DESACELERACAO_INERCIA * Math.abs(velocidade.current) * dt;

          /*
           * Evita passar da velocidade automática.
           */
          if (sinal > 0 && velocidade.current < VELOCIDADE_AUTO) {
            velocidade.current = VELOCIDADE_AUTO;
          }

          if (sinal < 0 && velocidade.current > -VELOCIDADE_AUTO) {
            velocidade.current = -VELOCIDADE_AUTO;
          }
        } else {
          /*
           * Depois da inércia, volta suavemente
           * para a velocidade automática.
           */
          velocidade.current += (VELOCIDADE_AUTO - velocidade.current) * ACELERACAO_AUTO * dt;
        }

        offset.current -= velocidade.current * dt;

        aplicar();
      }

      frame = requestAnimationFrame(animar);
    };

    frame = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(frame);

      document.removeEventListener("visibilitychange", voltarPagina);
    };
  }, [aplicar, itens.length]);

  if (itens.length === 0) {
    return null;
  }

  /*
   * DUAS cópias são usadas somente para criar
   * o loop infinito.
   *
   * Se o administrador cadastrar:
   *
   * 5 produtos  → 5 + 5
   * 10 produtos → 10 + 10
   * 20 produtos → 20 + 20
   * 50 produtos → 50 + 50
   *
   * Não existe limite de 10 aqui.
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

    ultimoX.current = e.clientX;
    ultimoTempo.current = performance.now();

    /*
     * Enquanto o usuário segura o mouse,
     * a animação automática fica parada.
     */
    velocidade.current = 0;

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  /*
   * USUÁRIO ESTÁ ARRASTANDO
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    const agora = performance.now();

    const delta = e.clientX - inicioX.current;

    if (Math.abs(delta) > 4) {
      moveu.current = true;
    }

    /*
     * Move a trilha junto com o mouse.
     */
    offset.current = inicioOffset.current + delta;

    aplicar();

    /*
     * Calcula a velocidade do movimento do mouse.
     *
     * Isso é o que cria a INÉRCIA.
     */
    const distancia = e.clientX - ultimoX.current;

    const tempo = agora - ultimoTempo.current;

    if (tempo > 0) {
      const velocidadeMouse = distancia / (tempo / 1000);

      velocidade.current = velocidadeMouse * 0.9;
    }

    /*
     * Limita a velocidade para evitar
     * um salto absurdo caso o mouse se mova
     * muito rapidamente.
     */
    velocidade.current = Math.max(-VELOCIDADE_MAXIMA_INERCIA, Math.min(VELOCIDADE_MAXIMA_INERCIA, velocidade.current));

    ultimoX.current = e.clientX;
    ultimoTempo.current = agora;
  };

  /*
   * USUÁRIO SOLTOU O MOUSE
   */
  const finalizar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastando.current) return;

    arrastando.current = false;

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    /*
     * NÃO colocamos velocidade = 40 aqui.
     *
     * A velocidade que o usuário estava usando
     * continua existindo.
     *
     * O motor da animação vai desacelerá-la
     * gradualmente até chegar aos 40 px/s.
     */
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
           * Se o usuário arrastou,
           * não abre o produto acidentalmente.
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
