import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { precoFinal, formatarPreco, WHATSAPP_URL, type Produto } from "./catalog";

export type ItemCarrinho = { produto: Produto; quantidade: number };

type CartContextValue = {
  itens: ItemCarrinho[];
  totalItens: number;
  total: number;
  adicionar: (produto: Produto, quantidade?: number) => void;
  remover: (id: string) => void;
  definirQuantidade: (id: string, quantidade: number) => void;
  limpar: () => void;
  linkWhatsApp: () => string;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "francy-carrinho-v2";

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ItemCarrinho[];
        setItens(parsed.filter((i) => i && i.produto && typeof i.produto.id === "string"));
      }
    } catch {
      /* ignora */
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(itens));
  }, [itens, hidratado]);

  const value = useMemo<CartContextValue>(() => {
    const total = itens.reduce((acc, i) => acc + precoFinal(i.produto) * i.quantidade, 0);

    return {
      itens,
      total,
      totalItens: itens.reduce((a, i) => a + i.quantidade, 0),
      adicionar: (produto, quantidade = 1) =>
        setItens((prev) => {
          const existe = prev.find((i) => i.produto.id === produto.id);
          if (existe)
            return prev.map((i) =>
              i.produto.id === produto.id
                ? { produto, quantidade: i.quantidade + quantidade }
                : i,
            );
          return [...prev, { produto, quantidade }];
        }),
      remover: (id) => setItens((prev) => prev.filter((i) => i.produto.id !== id)),
      definirQuantidade: (id, quantidade) =>
        setItens((prev) =>
          quantidade <= 0
            ? prev.filter((i) => i.produto.id !== id)
            : prev.map((i) => (i.produto.id === id ? { ...i, quantidade } : i)),
        ),
      limpar: () => setItens([]),
      linkWhatsApp: () => {
        const linhas = itens.map(({ produto: p, quantidade }) =>
          [
            `Produto: ${p.nome}`,
            `Código: ${p.codigo}`,
            `Quantidade: ${quantidade}`,
            `Preço: ${formatarPreco(precoFinal(p))}`,
          ].join("\n"),
        );
        const msg = [
          "Olá, Farmácias Francy! Gostaria de realizar um pedido:",
          "",
          linhas.join("\n\n"),
          "",
          `Total aproximado: ${formatarPreco(total)}`,
          "",
          "Gostaria de confirmar a disponibilidade dos produtos.",
        ].join("\n");
        return `${WHATSAPP_URL}?text=${encodeURIComponent(msg)}`;
      },
    };
  }, [itens]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}
