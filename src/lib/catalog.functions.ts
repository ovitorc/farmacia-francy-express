import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  categoriaFoiRemovida,
  classificarProdutoNoSite,
  slugify,
  ESTRUTURA_CATEGORIAS_SITE,
  ordenarProdutosPorRelevancia,
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

        return fetch(input, {
          ...init,
          headers,
        });
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

  const classificados = produtos.map((produto) => ({
    produto,
    classificacao: classificarProdutoNoSite(produto),
  }));

  const totaisCategorias = new Map<string, number>();

  const totaisSubcategorias = new Map<string, number>();

  for (const { classificacao } of classificados) {
    if (!classificacao.categoria) {
      continue;
    }

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
      return {
        itens: [],
        total: 0,
      };
    }

    const supabase = publicClient();

    const pagina = Math.max(1, data.pagina ?? 1);

    const porPagina = 40;

    const categoriaVirtual = ESTRUTURA_CATEGORIAS_SITE.some((categoria) => categoria.slug === data.categoria);

    let query = supabase.from("produtos").select(COLUNAS).eq("disponivel", true);

    if (!categoriaVirtual) {
      query = query.eq("categoria_slug", data.categoria);

      if (data.sub) {
        query = query.eq("subcategoria_slug", data.sub);
      }
    }

    if (data.ordem === "ofertas") {
      query = query.eq("oferta", true);
    }

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

const PALAVRAS_IGNORADAS_BUSCA = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "sem",
  "que",
]);

const SINONIMOS_BUSCA: Record<string, string[]> = {
  absorvente: ["absorvente", "abs", "intimus", "sempre livre", "sempre-livre", "always"],
  absorventes: ["absorvente", "abs", "intimus", "sempre livre", "sempre-livre", "always"],
  fralda: ["fralda", "fraldas"],
  fraldas: ["fralda", "fraldas"],
  infantil: ["infantil", "bebe", "bebê", "baby", "crianca", "criança", "mamae", "mamãe"],
  bebe: ["bebe", "bebê", "baby", "infantil", "crianca", "criança"],
  bebê: ["bebe", "bebê", "baby", "infantil", "crianca", "criança"],
  geriatrica: ["geriatrica", "geriátrica", "geriatrico", "geriátrico", "adulto", "incontinencia", "incontinência"],
  geriátrica: ["geriatrica", "geriátrica", "geriatrico", "geriátrico", "adulto", "incontinencia", "incontinência"],
  adulto: ["adulto", "geriatrica", "geriátrica", "incontinencia", "incontinência"],
  generico: ["generico", "genérico", "genericos", "genéricos"],
  genérico: ["generico", "genérico", "genericos", "genéricos"],
  similar: ["similar", "similares"],
  marca: ["marca", "marcas"],
  remedio: ["remedio", "remédio", "medicamento", "medicamentos"],
  remedios: ["remedio", "remédio", "medicamento", "medicamentos"],
  medicamento: ["medicamento", "medicamentos", "remedio", "remédio"],
  medicamentos: ["medicamento", "medicamentos", "remedio", "remédio"],
  protetor: ["protetor", "protecao", "proteção"],
  protetora: ["protetor", "protecao", "proteção"],
  solar: ["solar", "protetor solar", "filtro solar"],
};

function normalizarBusca(valor: string) {
  return slugify(valor).replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function tokensDaBusca(valor: string) {
  return normalizarBusca(valor)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !PALAVRAS_IGNORADAS_BUSCA.has(token));
}

function variantesDoToken(token: string) {
  const variantes = SINONIMOS_BUSCA[token] ?? [token];

  return Array.from(new Set(variantes.map(normalizarBusca).filter(Boolean)));
}

function campoDeBuscaDoProduto(produto: Produto) {
  const classificacao = classificarProdutoNoSite(produto);

  const aliasesCategoria: Record<string, string> = {
    "mamae-e-bebe": "mamae bebe baby infantil crianca criança",
    "incontinencia-cuidados-adultos": "adulto geriatrico geriátrico incontinencia incontinência",
    "higiene-feminina-intima": "feminino feminina intimo íntimo menstrual menstruacao menstruação",
    "medicamentos-genericos": "generico genérico genericos genéricos",
    "medicamentos-similares": "similar similares",
    "medicamentos-de-marca": "marca marcas original referencia referência",
    "perfumaria-cosmeticos": "perfumaria cosmetico cosmético beleza",
    "saude-bucal": "bucal dental dentes odontologia",
    "vitaminas-suplementos": "vitamina suplemento nutricao nutrição",
    "saude-primeiros-socorros-hospitalar": "saude saúde hospitalar primeiros socorros",
    "ortopedia-cuidados-especiais": "ortopedia ortopedico ortopédico",
  };

  const aliasesSubcategoria: Record<string, string> = {
    "fraldas-infantis": "fralda infantil bebe bebê baby criança crianca",
    "fraldas-shortinho": "fralda infantil bebe bebê baby criança crianca shortinho",
    "fraldas-calca": "fralda infantil bebe bebê baby criança crianca calca calça",
    "fraldas-recem-nascido": "fralda infantil bebe bebê recém nascido rn",
    "fraldas-geriatricas": "fralda geriatrica geriátrica geriatrico geriátrico adulto incontinencia incontinência",
    "absorventes-menstruais": "absorvente feminino feminina menstrual menstruação menstruacao",
    "absorventes-noturnos": "absorvente feminino feminina menstrual noturno noturna",
    "absorventes-internos": "absorvente feminino feminina interno menstrual tampao tampão",
    "protetores-diarios": "absorvente protetor diario diário feminino",
    antibioticos: "antibiotico antibiótico antibióticos antibioticos",
    "analgesicos-antitermicos": "analgesico analgésico antitermico antitérmico dor febre",
    "cardiovasculares-pressao": "pressao pressão hipertensao hipertensão coracao coração cardiovascular",
    "diabetes-metabolismo": "diabetes diabetico diabético glicose",
    "colesterol-triglicerideos": "colesterol triglicerideo triglicerídeo",
  };

  return normalizarBusca(
    [
      produto.nome,
      produto.descricao,
      produto.codigo,
      produto.categoria,
      produto.subcategoria,
      produto.informacoes?.join(" "),
      classificacao.categoria,
      classificacao.subcategoria,
      aliasesCategoria[classificacao.categoria],
      aliasesSubcategoria[classificacao.subcategoria],
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function produtoCombinaComBusca(produto: Produto, tokens: string[]) {
  const haystack = campoDeBuscaDoProduto(produto);

  return tokens.every((token) => variantesDoToken(token).some((variante) => haystack.includes(variante)));
}

function pontuacaoDaBusca(produto: Produto, tokens: string[], frase: string) {
  const haystack = campoDeBuscaDoProduto(produto);
  const nome = normalizarBusca(produto.nome);
  let pontos = 0;
  let tokensEncontrados = 0;

  for (const token of tokens) {
    const variantes = variantesDoToken(token);
    const encontrado = variantes.find((variante) => haystack.includes(variante));

    if (encontrado) {
      tokensEncontrados += 1;
      pontos += 20;

      if (nome.includes(encontrado)) {
        pontos += 25;
      }

      if (nome.startsWith(encontrado)) {
        pontos += 8;
      }
    }
  }

  if (normalizarBusca(produto.nome).includes(normalizarBusca(frase))) {
    pontos += 50;
  }

  if (produto.imagem) {
    pontos += 2;
  }

  if (produto.oferta) {
    pontos += 1;
  }

  pontos += tokensEncontrados * 10;

  return pontos;
}

function sanitizarParaOr(termo: string) {
  return termo
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const buscarProdutos = createServerFn({
  method: "GET",
})
  .inputValidator((dados: { q: string; limite?: number }) => dados)
  .handler(async ({ data }): Promise<Produto[]> => {
    const frase = data.q.trim();

    if (frase.length < 2) {
      return [];
    }

    const tokens = tokensDaBusca(frase);

    if (tokens.length === 0) {
      return [];
    }

    const supabase = publicClient();

    const variantes = Array.from(
      new Set(
        tokens
          .flatMap(variantesDoToken)
          .map(sanitizarParaOr)
          .filter((valor) => valor.length >= 2),
      ),
    );

    const campos = [
      "nome",
      "descricao",
      "principio_ativo",
      "fabricante",
      "codigo",
      "codigo_barras",
      "categoria_slug",
      "subcategoria_slug",
    ];

    const filtros = variantes.flatMap((variante) => campos.map((campo) => `${campo}.ilike.%${variante}%`));

    let query = supabase.from("produtos").select(COLUNAS).eq("disponivel", true);

    if (filtros.length > 0) {
      query = query.or(filtros.join(","));
    }

    const resultado = await query.limit(500);

    if (resultado.error) {
      return [];
    }

    const candidatos = prepararProdutos(resultado.data);

    const exatos = candidatos
      .filter((produto) => produtoCombinaComBusca(produto, tokens))
      .map((produto) => ({
        produto,
        pontos: pontuacaoDaBusca(produto, tokens, frase),
      }))
      .sort((a, b) => b.pontos - a.pontos);

    return exatos.slice(0, data.limite ?? 60).map((item) => item.produto);
  });

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

      const resultado = await supabase.from("produtos").select(COLUNAS).eq("id", data.id).maybeSingle();

      if (resultado.error || !resultado.data) {
        return null;
      }

      const produto = mapear(resultado.data);

      if (categoriaFoiRemovida(produto.categoria)) {
        return null;
      }

      const relacionadosResult = await supabase
        .from("produtos")
        .select(COLUNAS)
        .eq("disponivel", true)
        .neq("id", produto.id);

      const todosRelacionados = relacionadosResult.error ? [] : prepararProdutos(relacionadosResult.data);

      const classificacaoAtual = classificarProdutoNoSite(produto);

      let relacionados = todosRelacionados.filter((item) => {
        const classificacao = classificarProdutoNoSite(item);

        return (
          classificacao.categoria === classificacaoAtual.categoria &&
          classificacao.subcategoria === classificacaoAtual.subcategoria
        );
      });

      if (relacionados.length === 0) {
        relacionados = todosRelacionados.filter((item) => item.categoria === produto.categoria);
      }

      return {
        produto,

        relacionados: ordenarProdutosPorRelevancia(relacionados).slice(0, 5),
      };
    },
  );
