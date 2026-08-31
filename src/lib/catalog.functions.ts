import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Catalogo, Categoria, Produto } from "@/lib/catalog";

type LinhaProduto = Database["public"]["Tables"]["produtos"]["Row"];

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },

    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);

        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }

        h.set("apikey", key);

        return fetch(input, {
          ...init,
          headers: h,
        });
      },
    },
  });
}

function mapear(p: LinhaProduto): Produto {
  return {
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
  };
}

const COLUNAS = "*";

/**
 * ============================================================
 * CATÁLOGO PRINCIPAL
 * ============================================================
 *
 * O Rasga Preço é controlado EXCLUSIVAMENTE
 * pelo campo:
 *
 * rasga_preco = true
 *
 * Não existe fallback automático.
 *
 * Se nenhum produto estiver marcado:
 *
 * vitrines.rasgaPreco = []
 *
 * e o componente RasgaPreco desaparece automaticamente.
 */

export const getCatalogo = createServerFn({
  method: "GET",
}).handler(async (): Promise<Catalogo> => {
  const supabase = publicClient();

  const [cats, subs, rasga, ofertas, populares, promocionais] = await Promise.all([
    /*
     * ========================================================
     * CATEGORIAS
     * ========================================================
     */

    supabase.from("categorias").select("slug, nome, icone, ordem").order("ordem"),

    /*
     * ========================================================
     * SUBCATEGORIAS
     * ========================================================
     */

    supabase.from("subcategorias").select("categoria_slug, slug, nome, ordem").order("ordem"),

    /*
     * ========================================================
     * RASGA PREÇO
     * ========================================================
     *
     * Busca exclusivamente produtos que possuem:
     *
     * rasga_preco = true
     *
     * Não existe limite de produtos.
     *
     * Se nenhum produto estiver marcado,
     * o resultado será uma lista vazia.
     */

    supabase.from("produtos").select(COLUNAS).eq("rasga_preco", true).eq("disponivel", true).order("ordem"),

    /*
     * ========================================================
     * OFERTAS
     * ========================================================
     *
     * Mantém o comportamento atual.
     */

    supabase.from("produtos").select(COLUNAS).eq("oferta", true).eq("disponivel", true).order("ordem").limit(10),

    /*
     * ========================================================
     * MAIS PROCURADOS
     * ========================================================
     */

    supabase
      .from("produtos")
      .select(COLUNAS)
      .eq("disponivel", true)
      .gt("estoque", 0)
      .order("estoque", {
        ascending: false,
      })
      .limit(20),

    /*
     * ========================================================
     * PRODUTOS COM DESCONTO
     * ========================================================
     *
     * Continua sendo utilizado para o fallback das OFERTAS,
     * preservando o comportamento atual.
     *
     * IMPORTANTE:
     *
     * NÃO é mais utilizado como fallback do Rasga Preço.
     */

    supabase
      .from("produtos")
      .select(COLUNAS)
      .eq("disponivel", true)
      .gt("estoque", 0)
      .not("preco_promocional", "is", null)
      .order("estoque", {
        ascending: false,
      })
      .limit(24),
  ]);

  /*
   * ==========================================================
   * ORGANIZAR CATEGORIAS
   * ==========================================================
   */

  const categorias: Categoria[] = (cats.data ?? []).map((c) => ({
    nome: c.nome,

    slug: c.slug,

    icone: c.icone,

    subcategorias: (subs.data ?? [])
      .filter((s) => s.categoria_slug === c.slug)
      .map((s) => ({
        nome: s.nome,

        slug: s.slug,
      })),
  }));

  /*
   * ==========================================================
   * PRODUTOS MARCADOS
   * ==========================================================
   */

  const marcadosRasga = rasga.data ?? [];

  const marcadosOferta = ofertas.data ?? [];

  /*
   * ==========================================================
   * PRODUTOS COM DESCONTO
   * ==========================================================
   *
   * Utilizados apenas para a lógica existente
   * da vitrine de ofertas.
   */

  const comDesconto = [...(promocionais.data ?? [])].sort((a, b) => {
    const da = Number(a.preco) > 0 ? 1 - Number(a.preco_promocional) / Number(a.preco) : 0;

    const db = Number(b.preco) > 0 ? 1 - Number(b.preco_promocional) / Number(b.preco) : 0;

    return db - da;
  });

  /*
   * ==========================================================
   * RASGA PREÇO
   * ==========================================================
   *
   * REGRA DEFINITIVA:
   *
   * Mostrar SOMENTE produtos que possuem:
   *
   * rasga_preco = true
   *
   * Se não existir nenhum produto marcado:
   *
   * fonteRasga = []
   *
   * Portanto:
   *
   * O Rasga Preço desaparece completamente da Home.
   */

  const fonteRasga = marcadosRasga;

  /*
   * ==========================================================
   * OFERTAS
   * ==========================================================
   *
   * Mantido exatamente com a lógica anterior.
   */

  const fonteOferta = marcadosOferta.length > 0 ? marcadosOferta : comDesconto.slice(12, 22);

  /*
   * ==========================================================
   * CATÁLOGO GERAL
   * ==========================================================
   *
   * Evita duplicação de produtos.
   */

  const vistos = new Set<string>();

  const produtos: Produto[] = [];

  for (const linha of [...fonteRasga, ...fonteOferta, ...(populares.data ?? [])]) {
    if (vistos.has(linha.id)) {
      continue;
    }

    vistos.add(linha.id);

    produtos.push(mapear(linha));
  }

  /*
   * ==========================================================
   * RETORNO FINAL
   * ==========================================================
   */

  return {
    categorias,

    produtos,

    vitrines: {
      /*
       * RASGA PREÇO
       *
       * Agora somente produtos marcados
       * manualmente no painel administrativo.
       */

      rasgaPreco: fonteRasga.map(mapear),

      /*
       * OFERTAS
       *
       * Mantém o comportamento atual.
       */

      ofertas: fonteOferta.map(mapear),
    },
  };
});

/**
 * ============================================================
 * PAGINAÇÃO DE PRODUTOS
 * ============================================================
 */

export type PaginaProdutos = {
  itens: Produto[];

  total: number;
};

export const listarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator(
    (d: {
      categoria: string;

      sub?: string;

      ordem?: string;

      pagina?: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<PaginaProdutos> => {
    const supabase = publicClient();

    const porPagina = 40;

    const pagina = Math.max(1, data.pagina ?? 1);

    const de = (pagina - 1) * porPagina;

    let q = supabase
      .from("produtos")
      .select(COLUNAS, {
        count: "exact",
      })
      .eq("categoria_slug", data.categoria);

    if (data.sub) {
      q = q.eq("subcategoria_slug", data.sub);
    }

    if (data.ordem === "ofertas") {
      q = q.eq("oferta", true);
    }

    if (data.ordem === "menor-preco") {
      q = q.order("preco", {
        ascending: true,
      });
    } else if (data.ordem === "maior-preco") {
      q = q.order("preco", {
        ascending: false,
      });
    } else {
      q = q
        .order("disponivel", {
          ascending: false,
        })
        .order("nome");
    }

    const { data: linhas, count } = await q.range(de, de + porPagina - 1);

    return {
      itens: (linhas ?? []).map(mapear),

      total: count ?? 0,
    };
  });

/**
 * ============================================================
 * BUSCAR PRODUTOS
 * ============================================================
 */

export const buscarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator(
    (d: {
      q: string;

      limite?: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<Produto[]> => {
    const termo = data.q.trim();

    if (termo.length < 2) {
      return [];
    }

    const supabase = publicClient();

    const like = `%${termo.replace(/[%,]/g, " ")}%`;

    const { data: linhas } = await supabase
      .from("produtos")
      .select(COLUNAS)
      .or(`nome.ilike.${like},codigo.ilike.${like},principio_ativo.ilike.${like}`)
      .order("disponivel", {
        ascending: false,
      })
      .order("nome")
      .limit(data.limite ?? 60);

    return (linhas ?? []).map(mapear);
  });

/**
 * ============================================================
 * PRODUTO INDIVIDUAL
 * ============================================================
 */

export const obterProduto = createServerFn({
  method: "GET",
})
  .inputValidator((d: { id: string }) => d)
  .handler(
    async ({
      data,
    }): Promise<{
      produto: Produto;

      relacionados: Produto[];
    } | null> => {
      const supabase = publicClient();

      const { data: linha } = await supabase.from("produtos").select(COLUNAS).eq("id", data.id).maybeSingle();

      if (!linha) {
        return null;
      }

      const { data: rel } = await supabase
        .from("produtos")
        .select(COLUNAS)
        .eq("categoria_slug", linha.categoria_slug)
        .eq("disponivel", true)
        .neq("id", linha.id)
        .limit(5);

      return {
        produto: mapear(linha),

        relacionados: (rel ?? []).map(mapear),
      };
    },
  );
