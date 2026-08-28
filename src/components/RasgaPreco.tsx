import { useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Flame } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useCatalogo } from "@/lib/catalog-context";

type Posicao = "esquerda" | "centro" | "direita";

const POSICOES: { valor: Posicao; rotulo: string; icone: typeof AlignLeft }[] = [
  { valor: "esquerda", rotulo: "Alinhar à esquerda", icone: AlignLeft },
  { valor: "centro", rotulo: "Centralizar", icone: AlignCenter },
  { valor: "direita", rotulo: "Alinhar à direita", icone: AlignRight },
];

/** Deslocamento manual usa a propriedade `translate` (independente de `transform`). */
const DESLOCAMENTO: Record<Posicao, string> = {
  esquerda: "-4%",
  centro: "0%",
  direita: "4%",
};

const JUSTIFICA: Record<Posicao, string> = {
  esquerda: "flex-start",
  centro: "center",
  direita: "flex-end",
};

const CHAVE = "francy:rasga-preco-posicao";

export function RasgaPreco() {
  const { rasgaPreco: itens } = useCatalogo();
  const [posicao, setPosicao] = useState<Posicao>("esquerda");

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE) as Posicao | null;
    if (salvo && salvo in DESLOCAMENTO) setPosicao(salvo);
  }, []);

  const alterarPosicao = (valor: Posicao) => {
    setPosicao(valor);
    window.localStorage.setItem(CHAVE, valor);
  };

  if (itens.length === 0) return null;

  // Duplicamos a trilha para o loop infinito; cada cópia tem largura idêntica
  // (o espaçamento vive dentro do item, via padding), então o -50% não "pula".
  const trilha = [...itens, ...itens];

  return (
    <section className="py-8">
      <div className="mx-auto mb-5 flex max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-red text-brand-red-foreground">
            <Flame className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-brand-red sm:text-2xl">Rasga Preço</h2>
            <p className="text-xs text-muted-foreground">Ofertas com desconto especial</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {POSICOES.map((p) => (
            <button
              key={p.valor}
              type="button"
              aria-label={p.rotulo}
              aria-pressed={posicao === p.valor}
              onClick={() => alterarPosicao(p.valor)}
              className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                posicao === p.valor
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-primary-soft hover:text-primary"
              }`}
            >
              <p.icone className="size-4" />
            </button>
          ))}
        </div>
      </div>

      {/* 1. Viewport: recorta o excesso, nada mais */}
      <div className="group relative overflow-hidden">
        {/* 2. Wrapper de posicionamento: usa `translate` + justify-content */}
        <div
          className="flex w-full transition-[translate] duration-300 ease-out"
          style={{ translate: DESLOCAMENTO[posicao], justifyContent: JUSTIFICA[posicao] }}
        >
          {/* 3. Faixa animada: usa exclusivamente `transform` */}
          <div className="flex w-max marquee-track group-hover:[animation-play-state:paused]">
            {trilha.map((p, i) => (
              <div key={`${p.id}-${i}`} className="w-44 shrink-0 pr-4 sm:w-52">
                <ProductCard produto={p} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
