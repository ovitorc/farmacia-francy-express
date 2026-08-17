import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { produtos, precoFinal, formatarPreco, WHATSAPP_URL, type Produto } from "./catalog";

export type ItemCarrinho = { id: string; quantidade: number };

type CartContextValue = {
  itens: ItemCarrinho[];
  totalItens: number;
  total: number;
  adicionar: (id: string, quantidade?: number) => void;
  remover: (id: string) => void;
  definirQuantidade: (id: string, quantidade: number) => void;
  limpar: () => void;
  linkWhatsApp: () => string;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "francy-carrinho";

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItens(JSON.parse(raw) as ItemCarrinho[]);
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
    const encontrar = (id: string) => produtos.find((p) => p.id === id);
    const total = itens.reduce((acc, i) => {
      const p = encontrar(i.id);
      return p ? acc + precoFinal(p) * i.quantidade : acc;
    }, 0);

    return {
      itens,
      total,
      totalItens: itens.reduce((a, i) => a + i.quantidade, 0),
      adicionar: (id, quantidade = 1) =>
        setItens((prev) => {
          const existe = prev.find((i) => i.id === id);
          if (existe)
            return prev.map((i) => (i.id === id ? { ...i, quantidade: i.quantidade + quantidade } : i));
          return [...prev, { id, quantidade }];
        }),
      remover: (id) => setItens((prev) => prev.filter((i) => i.id !== id)),
      definirQuantidade: (id, quantidade) =>
        setItens((prev) =>
          quantidade <= 0
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? { ...i, quantidade } : i)),
        ),
      limpar: () => setItens([]),
      linkWhatsApp: () => {
        const linhas = itens
          .map((i) => encontrar(i.id))
          .filter((p): p is Produto => Boolean(p))
          .map((p) => {
            const i = itens.find((x) => x.id === p.id)!;
            return [
              `Produto: ${p.nome}`,
              `Código: ${p.codigo}`,
              `Quantidade: ${i.quantidade}`,
              `Preço: ${formatarPreco(precoFinal(p))}`,
            ].join("\n");
          });
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
