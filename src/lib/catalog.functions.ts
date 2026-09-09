import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  categoriaFoiRemovida,
  ordenarProdutosPorRelevancia,
  removerProdutosDeCategoriasRemovidas,
  ESTRUTURA_CATEGORIAS_SITE,
  produtosDaCategoriaSite,
  type Catalogo,
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
   * Busca todos os produtos disponíveis.
   *
   * As categorias exibidas no site são calculadas
   * através da estrutura comercial definida em catalog.ts.
   */

  const [todosProdutos, rasga, ofertas, promocionais] = await Promise.all([
    supabase.from("produtos").select(COLUNAS).eq("disponivel", true),

    supabase.from("produtos").select(COLUNAS).eq("rasga_preco", true).eq("disponivel", true).order("ordem"),

    supabase.from("produtos").select(COLUNAS).eq("oferta", true).eq("disponivel", true),

    supabase.from("produtos").select(COLUNAS).eq("disponivel", true).not("preco_promocional", "is", null),
  ]);

  /* ============================================================
     TODOS OS PRODUTOS
  ============================================================ */

  const produtosDoBanco = (todosProdutos.data ?? []).map(mapear);

  const produtosPermitidos = removerProdutosDeCategoriasRemovidas(produtosDoBanco);

  const produtosOrdenados = ordenarProdutosPorRelevancia(produtosPermitidos);

  /* ============================================================
     CATEGORIAS COMERCIAIS DO SITE
  ============================================================ */

  const categorias = ESTRUTURA_CATEGORIAS_SITE.map((categoria) => {
    const subcategorias = categoria.subcategorias.filter((subcategoria) => {
      const produtos = produtosDaCategoriaSite(produtosOrdenados, categoria.slug, subcategoria.slug);

      return produtos.length > 0;
    });

    return {
      ...categoria,
      subcategorias,
    };
  }).filter((categoria) => {
    const produtos = produtosDaCategoriaSite(produtosOrdenados, categoria.slug);

    return produtos.length > 0;
  });

  /* ============================================================
     RASGA PREÇO
  ============================================================ */

  const produtosRasga = removerProdutosDeCategoriasRemovidas((rasga.data ?? []).map(mapear));

  const fonteRasga = ordenarProdutosPorRelevancia(produtosRasga);

  /* ============================================================
     OFERTAS
  ============================================================ */

  const ofertasMarcadas = removerProdutosDeCategoriasRemovidas((ofertas.data ?? []).map(mapear));

  const produtosPromocionais = removerProdutosDeCategoriasRemovidas((promocionais.data ?? []).map(mapear));

  const idsOfertas = new Set<string>();

  const fonteOferta: Produto[] = [];

  for (const produto of ofertasMarcadas) {
    if (!idsOfertas.has(produto.id)) {
      idsOfertas.add(produto.id);

      fonteOferta.push(produto);
    }
  }

  for (const produto of produtosPromocionais) {
    if (!idsOfertas.has(produto.id)) {
      idsOfertas.add(produto.id);

      fonteOferta.push(produto);
    }
  }

  const ofertasOrdenadas = ordenarProdutosPorRelevancia(fonteOferta).slice(0, 10);

  /* ============================================================
     RETORNO
  ============================================================ */

  return {
    categorias,

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
     * Bloqueia categorias removidas.
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
     * Verifica se a categoria solicitada
     * é uma categoria virtual/comercial do site.
     */

    const categoriaVirtual = ESTRUTURA_CATEGORIAS_SITE.some((categoria) => categoria.slug === data.categoria);

    /*
     * Para categorias comerciais, precisamos
     * buscar os produtos disponíveis e depois
     * classificá-los pela lógica do catalog.ts.
     */

    let query = supabase.from("produtos").select(COLUNAS).eq("disponivel", true);

    /*
     * Caso seja uma categoria antiga do banco,
     * mantém compatibilidade com o filtro original.
     */

    if (!categoriaVirtual) {
      query = query.eq("categoria_slug", data.categoria);

      if (data.sub) {
        query = query.eq("subcategoria_slug", data.sub);
      }
    }

    /*
     * FILTRO DE OFERTAS
     */

    if (data.ordem === "ofertas") {
      query = query.eq("oferta", true);
    }

    const { data: linhas } = await query;

    let produtos = removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear));

    /*
     * Aplica a classificação comercial
     * definida no catalog.ts.
     */

    if (categoriaVirtual) {
      produtos = produtosDaCategoriaSite(produtos, data.categoria, data.sub);
    }

    /* ============================================================
         ORDENAÇÃO
      ============================================================ */

    if (data.ordem === "menor-preco") {
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
      produtos = ordenarProdutosPorRelevancia(produtos);
    }

    /* ============================================================
         PAGINAÇÃO
      ============================================================ */

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

    if (termo.length < 2) {
      return [];
    }

    const supabase = publicClient();

    const like = `%${termo.replace(/[%,]/g, " ")}%`;

    const { data: linhas } = await supabase
      .from("produtos")
      .select(COLUNAS)
      .eq("disponivel", true)
      .or(`nome.ilike.${like},codigo.ilike.${like},principio_ativo.ilike.${like}`);

    const produtos = removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear));

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
       * PRODUTO PRINCIPAL
       */

      const { data: linha } = await supabase.from("produtos").select(COLUNAS).eq("id", data.id).maybeSingle();

      if (!linha) {
        return null;
      }

      const produto = mapear(linha);

      /*
       * Impede produtos de categorias removidas.
       */

      if (categoriaFoiRemovida(produto.categoria)) {
        return null;
      }

      /*
       * Para produtos relacionados,
       * buscamos os produtos disponíveis.
       *
       * Depois tentamos priorizar produtos
       * da mesma categoria comercial.
       */

      const { data: relacionadosBanco } = await supabase
        .from("produtos")
        .select(COLUNAS)
        .eq("disponivel", true)
        .neq("id", linha.id);

      const todosRelacionados = removerProdutosDeCategoriasRemovidas((relacionadosBanco ?? []).map(mapear));

      /*
       * Descobre a categoria comercial
       * do produto atual.
       */

      const categoriaComercial = ESTRUTURA_CATEGORIAS_SITE.find(
        (categoria) => produtosDaCategoriaSite([produto], categoria.slug).length > 0,
      );

      let relacionados = todosRelacionados;

      /*
       * Se o produto possuir uma categoria
       * comercial identificada, prioriza
       * produtos dessa mesma categoria.
       */

      if (categoriaComercial) {
        const mesmaCategoria = produtosDaCategoriaSite(todosRelacionados, categoriaComercial.slug);

        if (mesmaCategoria.length > 0) {
          relacionados = mesmaCategoria;
        }
      } else {
        /*
         * Compatibilidade com categorias
         * antigas do banco.
         */

        relacionados = todosRelacionados.filter(
          (produtoRelacionado) => produtoRelacionado.categoria === produto.categoria,
        );
      }

      relacionados = ordenarProdutosPorRelevancia(relacionados).slice(0, 5);

      return {
        produto,

        relacionados,
      };
    },
  );
