import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  categoriaFoiRemovida,
  classificarProdutoNoSite,
  ESTRUTURA_CATEGORIAS_SITE,
  ordenarProdutosPorRelevancia,
  produtosDaCategoriaSite,
  removerProdutosDeCategoriasRemovidas,
  type Catalogo,
  type Produto,
} from "@/lib/catalog";

type LinhaProduto = Database["public"]["Tables"]["produtos"]["Row"];

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];

  if (!key || !url) {
    throw new Error("Configuração do Supabase não encontrada.");
  }

  return createClient<Database>(url, key, {
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
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function textoSeguro(valor: string | null | undefined) {
  return valor ?? "";
}

function mapear(produto: LinhaProduto): Produto {
  return {
    id: produto.id,
    codigo: textoSeguro(produto.codigo),
    nome: textoSeguro(produto.nome),
    categoria: textoSeguro(produto.categoria_slug),
    subcategoria: textoSeguro(produto.subcategoria_slug),
    descricao: textoSeguro(produto.descricao),
    preco: Number(produto.preco ?? 0),
    precoPromocional: produto.preco_promocional == null ? undefined : Number(produto.preco_promocional),
    imagem: produto.imagem ?? undefined,
    disponivel: produto.disponivel ?? true,
    oferta: produto.oferta ?? false,
    rasgaPreco: produto.rasga_preco ?? false,
    informacoes: Array.isArray(produto.informacoes) ? produto.informacoes : [],
  };
}

const COLUNAS = "*";

function prepararProdutos(linhas: LinhaProduto[] | null) {
  return ordenarProdutosPorRelevancia(removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear)));
}

/* ============================================================
   CATÁLOGO PRINCIPAL

   IMPORTANTE:
   Cada produto é classificado uma única vez. A versão anterior
   recalculava toda a classificação centenas de vezes ao montar o
   Header, o que podia estourar o tempo do loader e gerar GET / 500.
============================================================ */
export const getCatalogo = createServerFn({
  method: "GET",
}).handler(async (): Promise<Catalogo> => {
  const supabase = publicClient();

  const [todosProdutosResult, rasgaResult, ofertasResult, promocionaisResult] = await Promise.all([
    supabase.from("produtos").select(COLUNAS).eq("disponivel", true),
    supabase.from("produtos").select(COLUNAS).eq("rasga_preco", true).eq("disponivel", true).order("ordem"),
    supabase.from("produtos").select(COLUNAS).eq("oferta", true).eq("disponivel", true),
    supabase.from("produtos").select(COLUNAS).eq("disponivel", true).not("preco_promocional", "is", null),
  ]);

  if (todosProdutosResult.error) {
    throw new Error(`Não foi possível carregar os produtos: ${todosProdutosResult.error.message}`);
  }

  const produtos = prepararProdutos(todosProdutosResult.data);

  /* Classifica somente uma vez e monta índices rápidos. */
  const classificados = produtos.map((produto) => ({
    produto,
    classificacao: classificarProdutoNoSite(produto),
  }));

  const totaisCategorias = new Map<string, number>();
  const totaisSubcategorias = new Map<string, number>();

  for (const { classificacao } of classificados) {
    if (!classificacao.categoria) continue;

    totaisCategorias.set(classificacao.categoria, (totaisCategorias.get(classificacao.categoria) ?? 0) + 1);

    const chave = `${classificacao.categoria}:${classificacao.subcategoria}`;
    totaisSubcategorias.set(chave, (totaisSubcategorias.get(chave) ?? 0) + 1);
  }

  const categorias = ESTRUTURA_CATEGORIAS_SITE.filter(
    (categoria) => (totaisCategorias.get(categoria.slug) ?? 0) > 0,
  ).map((categoria) => ({
    ...categoria,
    subcategorias: categoria.subcategorias.filter(
      (subcategoria) => (totaisSubcategorias.get(`${categoria.slug}:${subcategoria.slug}`) ?? 0) > 0,
    ),
  }));

  const produtosRasga = rasgaResult.error ? [] : prepararProdutos(rasgaResult.data);

  const ofertasMarcadas = ofertasResult.error ? [] : prepararProdutos(ofertasResult.data);

  const produtosPromocionais = promocionaisResult.error ? [] : prepararProdutos(promocionaisResult.data);

  const idsOfertas = new Set<string>();
  const fonteOferta: Produto[] = [];

  for (const produto of [...ofertasMarcadas, ...produtosPromocionais]) {
    if (!idsOfertas.has(produto.id)) {
      idsOfertas.add(produto.id);
      fonteOferta.push(produto);
    }
  }

  return {
    categorias,
    produtos,
    vitrines: {
      rasgaPreco: produtosRasga,
      ofertas: ordenarProdutosPorRelevancia(fonteOferta).slice(0, 10),
    },
  };
});

export type PaginaProdutos = {
  itens: Produto[];
  total: number;
};

export const listarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { categoria: string; sub?: string; ordem?: string; pagina?: number }) => dados)
  .handler(async ({ data }): Promise<PaginaProdutos> => {
    if (categoriaFoiRemovida(data.categoria)) {
      return { itens: [], total: 0 };
    }

    const supabase = publicClient();
    const pagina = Math.max(1, data.pagina ?? 1);
    const porPagina = 40;

    const categoriaVirtual = ESTRUTURA_CATEGORIAS_SITE.some((categoria) => categoria.slug === data.categoria);

    let query = supabase.from("produtos").select(COLUNAS).eq("disponivel", true);

    if (!categoriaVirtual) {
      query = query.eq("categoria_slug", data.categoria);
      if (data.sub) query = query.eq("subcategoria_slug", data.sub);
    }

    if (data.ordem === "ofertas") query = query.eq("oferta", true);

    const resultado = await query;

    if (resultado.error) {
      throw new Error(`Não foi possível listar os produtos: ${resultado.error.message}`);
    }

    let produtos = prepararProdutos(resultado.data);

    if (categoriaVirtual) {
      produtos = produtos.filter((produto) => {
        const classificacao = classificarProdutoNoSite(produto);
        return classificacao.categoria === data.categoria && (!data.sub || classificacao.subcategoria === data.sub);
      });
    }

    if (data.ordem === "menor-preco") {
      produtos = [...produtos].sort((a, b) => a.preco - b.preco);
    } else if (data.ordem === "maior-preco") {
      produtos = [...produtos].sort((a, b) => b.preco - a.preco);
    } else {
      produtos = ordenarProdutosPorRelevancia(produtos);
    }

    const total = produtos.length;
    const inicio = (pagina - 1) * porPagina;

    return {
      itens: produtos.slice(inicio, inicio + porPagina),
      total,
    };
  });

export const buscarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { q: string; limite?: number }) => dados)
  .handler(async ({ data }): Promise<Produto[]> => {
    const termo = data.q.trim();
    if (termo.length < 2) return [];

    const supabase = publicClient();
    const like = `%${termo.replace(/[%,]/g, " ")}%`;

    const resultado = await supabase
      .from("produtos")
      .select(COLUNAS)
      .eq("disponivel", true)
      .or(`nome.ilike.${like},codigo.ilike.${like},principio_ativo.ilike.${like}`);

    if (resultado.error) return [];

    return prepararProdutos(resultado.data).slice(0, data.limite ?? 60);
  });

export const obterProduto = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { id: string }) => dados)
  .handler(async ({ data }): Promise<{ produto: Produto; relacionados: Produto[] } | null> => {
    const supabase = publicClient();

    const resultado = await supabase.from("produtos").select(COLUNAS).eq("id", data.id).maybeSingle();

    if (resultado.error || !resultado.data) return null;

    const produto = mapear(resultado.data);
    if (categoriaFoiRemovida(produto.categoria)) return null;

    const relacionadosResult = await supabase
      .from("produtos")
      .select(COLUNAS)
      .eq("disponivel", true)
      .neq("id", produto.id);

    const todosRelacionados = relacionadosResult.error ? [] : prepararProdutos(relacionadosResult.data);

    const classificacaoAtual = classificarProdutoNoSite(produto);

    let relacionados = todosRelacionados.filter((item) => {
      const classificacao = classificarProdutoNoSite(item);
      return classificacao.categoria === classificacaoAtual.categoria;
    });

    if (relacionados.length === 0) {
      relacionados = todosRelacionados.filter((item) => item.categoria === produto.categoria);
    }

    return {
      produto,
      relacionados: ordenarProdutosPorRelevancia(relacionados).slice(0, 5),
    };
  });
