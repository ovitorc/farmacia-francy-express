import { createServerFn } from "@tanstack/react-start";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  categoriaFoiRemovida,
  ordenarCategoriasPorRelevancia,
  ordenarProdutosPorRelevancia,
  ordenarSubcategoriasPorRelevancia,
  removerProdutosDeCategoriasRemovidas,
  type Catalogo,
  type Categoria,
  type Produto,
} from "@/lib/catalog";

/* ============================================================
   TIPOS
   ============================================================ */

type LinhaProduto = Database["public"]["Tables"]["produtos"]["Row"];

/* ============================================================
   CLIENTE SUPABASE
   ============================================================ */

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },

    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);

        /*
         * Remove Authorization incorreto
         * quando necessário.
         */

        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }

        headers.set("apikey", key);

        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
  });
}

/* ============================================================
   MAPEAMENTO DO PRODUTO
   ============================================================ */

function mapear(produto: LinhaProduto): Produto {
  return {
    id: produto.id,

    codigo: produto.codigo,

    nome: produto.nome,

    categoria: produto.categoria_slug,

    subcategoria: produto.subcategoria_slug,

    descricao: produto.descricao,

    preco: Number(produto.preco),

    precoPromocional: produto.preco_promocional == null ? undefined : Number(produto.preco_promocional),

    imagem: produto.imagem ?? undefined,

    disponivel: produto.disponivel,

    oferta: produto.oferta,

    rasgaPreco: produto.rasga_preco,

    informacoes: produto.informacoes ?? [],
  };
}

/* ============================================================
   COLUNAS
   ============================================================ */

const COLUNAS = "*";

/* ============================================================
   CATÁLOGO PRINCIPAL
   ============================================================ */

export const getCatalogo = createServerFn({
  method: "GET",
}).handler(async (): Promise<Catalogo> => {
  const supabase = publicClient();

  /*
   * ======================================================
   * BUSCAR TODOS OS DADOS NECESSÁRIOS
   * ======================================================
   */

  const [cats, subs, todosProdutos, rasga, ofertas, promocionais] = await Promise.all([
    /*
     * CATEGORIAS
     */

    supabase.from("categorias").select("slug, nome, icone, ordem").order("ordem"),

    /*
     * SUBCATEGORIAS
     */

    supabase.from("subcategorias").select("categoria_slug, slug, nome, ordem").order("ordem"),

    /*
     * TODOS OS PRODUTOS
     *
     * Necessário para calcular corretamente
     * a relevância das categorias.
     */

    supabase.from("produtos").select(COLUNAS).eq("disponivel", true),

    /*
     * RASGA PREÇO
     */

    supabase.from("produtos").select(COLUNAS).eq("rasga_preco", true).eq("disponivel", true).order("ordem"),

    /*
     * OFERTAS MARCADAS
     */

    supabase.from("produtos").select(COLUNAS).eq("oferta", true).eq("disponivel", true),

    /*
     * PRODUTOS COM PREÇO PROMOCIONAL
     */

    supabase.from("produtos").select(COLUNAS).eq("disponivel", true).not("preco_promocional", "is", null),
  ]);

  /*
   * ======================================================
   * TODOS OS PRODUTOS
   * ======================================================
   */

  const produtosDoBanco = (todosProdutos.data ?? []).map(mapear);

  /*
   * Remove completamente produtos Pet.
   */

  const produtosPermitidos = removerProdutosDeCategoriasRemovidas(produtosDoBanco);

  /*
   * Produtos com imagem primeiro.
   */

  const produtosOrdenados = ordenarProdutosPorRelevancia(produtosPermitidos);

  /*
   * ======================================================
   * CATEGORIAS PERMITIDAS
   * ======================================================
   */

  const categoriasPermitidas = (cats.data ?? []).filter((categoria) => !categoriaFoiRemovida(categoria.slug));

  /*
   * ======================================================
   * MONTAR CATEGORIAS
   * ======================================================
   */

  const categoriasBase: Categoria[] = categoriasPermitidas.map((categoria) => {
    const subcategorias = (subs.data ?? [])
      .filter((subcategoria) => subcategoria.categoria_slug === categoria.slug)
      .map((subcategoria) => ({
        nome: subcategoria.nome,

        slug: subcategoria.slug,
      }));

    return {
      nome: categoria.nome,

      slug: categoria.slug,

      icone: categoria.icone,

      /*
       * Subcategorias também seguem
       * relevância por imagem.
       */

      subcategorias: ordenarSubcategoriasPorRelevancia(subcategorias, categoria.slug, produtosOrdenados),
    };
  });

  /*
   * ======================================================
   * ORDENAR CATEGORIAS
   * ======================================================
   */

  const categorias = ordenarCategoriasPorRelevancia(categoriasBase, produtosOrdenados);

  /*
   * ======================================================
   * RASGA PREÇO
   * ======================================================
   */

  const produtosRasga = removerProdutosDeCategoriasRemovidas((rasga.data ?? []).map(mapear));

  const fonteRasga = ordenarProdutosPorRelevancia(produtosRasga);

  /*
   * ======================================================
   * OFERTAS
   * ======================================================
   */

  const ofertasMarcadas = removerProdutosDeCategoriasRemovidas((ofertas.data ?? []).map(mapear));

  const produtosPromocionais = removerProdutosDeCategoriasRemovidas((promocionais.data ?? []).map(mapear));

  /*
   * Evita produtos duplicados.
   */

  const idsOfertas = new Set<string>();

  const fonteOferta: Produto[] = [];

  /*
   * Primeiro entram as ofertas
   * marcadas manualmente.
   */

  for (const produto of ofertasMarcadas) {
    if (!idsOfertas.has(produto.id)) {
      idsOfertas.add(produto.id);

      fonteOferta.push(produto);
    }
  }

  /*
   * Depois entram os produtos
   * promocionais.
   */

  for (const produto of produtosPromocionais) {
    if (!idsOfertas.has(produto.id)) {
      idsOfertas.add(produto.id);

      fonteOferta.push(produto);
    }
  }

  const ofertasOrdenadas = ordenarProdutosPorRelevancia(fonteOferta).slice(0, 10);

  /*
   * ======================================================
   * RETORNO FINAL
   * ======================================================
   */

  return {
    categorias,

    /*
     * Agora o catálogo principal contém
     * todos os produtos disponíveis.
     *
     * Isso permite calcular corretamente
     * relevância em todo o site.
     */

    produtos: produtosOrdenados,

    vitrines: {
      rasgaPreco: fonteRasga,

      ofertas: ofertasOrdenadas,
    },
  };
});

/* ============================================================
   PAGINAÇÃO DE PRODUTOS
   ============================================================ */

export type PaginaProdutos = {
  itens: Produto[];

  total: number;
};

export const listarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { categoria: string; sub?: string; ordem?: string; pagina?: number }) => dados)
  .handler(async ({ data }): Promise<PaginaProdutos> => {
    /*
     * Bloqueia Pet.
     */

    if (categoriaFoiRemovida(data.categoria)) {
      return {
        itens: [],
        total: 0,
      };
    }

    const supabase = publicClient();

    const porPagina = 40;

    const pagina = Math.max(1, data.pagina ?? 1);

    /*
     * ====================================================
     * CONSULTA
     * ====================================================
     */

    let query = supabase.from("produtos").select(COLUNAS).eq("categoria_slug", data.categoria);

    /*
     * SUBCATEGORIA
     */

    if (data.sub) {
      query = query.eq("subcategoria_slug", data.sub);
    }

    /*
     * OFERTAS
     */

    if (data.ordem === "ofertas") {
      query = query.eq("oferta", true);
    }

    /*
     * Busca todos os produtos
     * antes de paginar.
     *
     * Isso é necessário para garantir
     * que produtos com imagem realmente
     * apareçam nas primeiras páginas.
     */

    const { data: linhas } = await query;

    let produtos = removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear));

    /*
     * ====================================================
     * ORDENAÇÃO
     * ====================================================
     */

    if (data.ordem === "menor-preco") {
      /*
       * Mesmo na ordenação por preço,
       * produtos com imagem continuam
       * sendo priorizados.
       */

      produtos = [...produtos].sort((a, b) => {
        const aImagem = Boolean(a.imagem?.trim());

        const bImagem = Boolean(b.imagem?.trim());

        if (aImagem !== bImagem) {
          return Number(bImagem) - Number(aImagem);
        }

        return a.preco - b.preco;
      });
    } else if (data.ordem === "maior-preco") {
      produtos = [...produtos].sort((a, b) => {
        const aImagem = Boolean(a.imagem?.trim());

        const bImagem = Boolean(b.imagem?.trim());

        if (aImagem !== bImagem) {
          return Number(bImagem) - Number(aImagem);
        }

        return b.preco - a.preco;
      });
    } else {
      /*
       * MAIS RELEVANTES
       */

      produtos = ordenarProdutosPorRelevancia(produtos);
    }

    /*
     * ====================================================
     * PAGINAÇÃO
     * ====================================================
     */

    const total = produtos.length;

    const inicio = (pagina - 1) * porPagina;

    const fim = inicio + porPagina;

    return {
      itens: produtos.slice(inicio, fim),

      total,
    };
  });

/* ============================================================
   BUSCAR PRODUTOS
   ============================================================ */

export const buscarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { q: string; limite?: number }) => dados)
  .handler(async ({ data }): Promise<Produto[]> => {
    const termo = data.q.trim();

    /*
     * Evita consultas vazias.
     */

    if (termo.length < 2) {
      return [];
    }

    const supabase = publicClient();

    const like = `%${termo.replace(/[%,]/g, " ")}%`;

    /*
     * Busca sem ordem alfabética.
     */

    const { data: linhas } = await supabase
      .from("produtos")
      .select(COLUNAS)
      .or(`nome.ilike.${like},codigo.ilike.${like},principio_ativo.ilike.${like}`);

    /*
     * Remove Pet.
     */

    const produtos = removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear));

    /*
     * Produtos com imagem aparecem primeiro.
     */

    const produtosOrdenados = ordenarProdutosPorRelevancia(produtos);

    return produtosOrdenados.slice(0, data.limite ?? 60);
  });

/* ============================================================
   PRODUTO INDIVIDUAL
   ============================================================ */

export const obterProduto = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { id: string }) => dados)
  .handler(
    async ({
      data,
    }): Promise<{
      produto: Produto;
      relacionados: Produto[];
    } | null> => {
      const supabase = publicClient();

      /*
       * Busca o produto.
       */

      const { data: linha } = await supabase.from("produtos").select(COLUNAS).eq("id", data.id).maybeSingle();

      /*
       * Produto não encontrado.
       */

      if (!linha) {
        return null;
      }

      const produto = mapear(linha);

      /*
       * Impede acesso a produto Pet.
       */

      if (categoriaFoiRemovida(produto.categoria)) {
        return null;
      }

      /*
       * Busca relacionados.
       */

      const { data: relacionadosBanco } = await supabase
        .from("produtos")
        .select(COLUNAS)
        .eq("categoria_slug", linha.categoria_slug)
        .eq("disponivel", true)
        .neq("id", linha.id);

      /*
       * Remove categorias proibidas
       * e ordena por imagem.
       */

      const relacionados = ordenarProdutosPorRelevancia(
        removerProdutosDeCategoriasRemovidas((relacionadosBanco ?? []).map(mapear)),
      ).slice(0, 5);

      return {
        produto,

        relacionados,
      };
    },
  );
