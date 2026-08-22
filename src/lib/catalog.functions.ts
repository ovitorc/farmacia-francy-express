import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Catalogo, Categoria, Produto } from "@/lib/catalog";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getCatalogo = createServerFn({ method: "GET" }).handler(async (): Promise<Catalogo> => {
  const supabase = publicClient();
  const [cats, subs, prods] = await Promise.all([
    supabase.from("categorias").select("slug, nome, icone, ordem").order("ordem"),
    supabase.from("subcategorias").select("categoria_slug, slug, nome, ordem").order("ordem"),
    supabase.from("produtos").select("*").order("ordem"),
  ]);

  const categorias: Categoria[] = (cats.data ?? []).map((c) => ({
    nome: c.nome,
    slug: c.slug,
    icone: c.icone,
    subcategorias: (subs.data ?? [])
      .filter((s) => s.categoria_slug === c.slug)
      .map((s) => ({ nome: s.nome, slug: s.slug })),
  }));

  const produtos: Produto[] = (prods.data ?? []).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoria_slug,
    subcategoria: p.subcategoria_slug,
    descricao: p.descricao,
    preco: Number(p.preco),
    precoPromocional: p.preco_promocional == null ? undefined : Number(p.preco_promocional),
    imagem: p.imagem ?? undefined,
    disponivel: p.disponivel,
    oferta: p.oferta,
    rasgaPreco: p.rasga_preco,
    informacoes: p.informacoes ?? [],
  }));

  return { categorias, produtos };
});
