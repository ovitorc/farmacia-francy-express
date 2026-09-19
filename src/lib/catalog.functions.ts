import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  categoriaFoiRemovida,
  classificarProdutoNoSite,
  obterExpansaoBusca,
  slugify,
  ESTRUTURA_CATEGORIAS_SITE,
  ordenarProdutosPorRelevancia,
  removerProdutosDeCategoriasRemovidas,
  type Catalogo,
  type Produto,
} from "@/lib/catalog";

type ProdutoBanco = Database["public"]["Tables"]["produtos"]["Row"];
type LinhaProduto = Pick<
  ProdutoBanco,
  | "id"
  | "codigo"
  | "codigo_barras"
  | "nome"
  | "categoria_slug"
  | "subcategoria_slug"
  | "descricao"
  | "fabricante"
  | "principio_ativo"
  | "preco"
  | "preco_promocional"
  | "imagem"
  | "disponivel"
  | "oferta"
  | "rasga_preco"
  | "informacoes"
>;

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
  const mapeado: Produto = {
    id: produto.id,
    codigo: textoSeguro(produto.codigo),
    nome: textoSeguro(produto.nome),
    categoria: textoSeguro(produto.categoria_slug),
    subcategoria: textoSeguro(produto.subcategoria_slug),
    descricao: textoSeguro(produto.descricao),
    preco: Number(produto.preco ?? 0),
    disponivel: produto.disponivel ?? true,
    oferta: produto.oferta ?? false,
    rasgaPreco: produto.rasga_preco ?? false,
    informacoes: Array.isArray(produto.informacoes) ? produto.informacoes : [],
  };
  if (produto.preco_promocional != null) mapeado.precoPromocional = Number(produto.preco_promocional);
  if (produto.imagem) mapeado.imagem = produto.imagem;
  if (produto.codigo_barras) mapeado.codigoBarras = produto.codigo_barras;
  if (produto.fabricante) mapeado.fabricante = produto.fabricante;
  if (produto.principio_ativo) mapeado.principioAtivo = produto.principio_ativo;
  return mapeado;
}

const COLUNAS =
  "id, codigo, codigo_barras, nome, categoria_slug, subcategoria_slug, descricao, fabricante, principio_ativo, preco, preco_promocional, imagem, disponivel, oferta, rasga_preco, informacoes";

const COLUNAS_BUSCA =
  "id, codigo, codigo_barras, nome, categoria_slug, subcategoria_slug, descricao, fabricante, principio_ativo, preco, preco_promocional, imagem, disponivel, oferta, rasga_preco, informacoes";

const TAMANHO_LOTE_BANCO = 500;

async function buscarTodosProdutos(
  supabase: ReturnType<typeof publicClient>,
  configurador?: (query: any) => any,
): Promise<LinhaProduto[]> {
  const todos: LinhaProduto[] = [];
  let inicio = 0;

  while (true) {
    let query: any = supabase
      .from("produtos")
      .select(COLUNAS)
      .or("disponivel.eq.true,disponivel.is.null")
      .order("id", { ascending: true });

    if (configurador) query = configurador(query);

    const resultado = await query.range(inicio, inicio + TAMANHO_LOTE_BANCO - 1);

    if (resultado.error) {
      throw new Error(`Não foi possível carregar os produtos: ${resultado.error.message}`);
    }

    const lote = (resultado.data ?? []) as LinhaProduto[];
    todos.push(...lote);

    if (lote.length < TAMANHO_LOTE_BANCO) break;
    inicio += TAMANHO_LOTE_BANCO;
  }

  return todos;
}

async function buscarProdutosLimitados(
  supabase: ReturnType<typeof publicClient>,
  configurador?: (query: any) => any,
  limite = 24,
): Promise<LinhaProduto[]> {
  let query: any = supabase.from("produtos").select(COLUNAS).or("disponivel.eq.true,disponivel.is.null").limit(limite);

  if (configurador) query = configurador(query);

  const resultado = await query;
  if (resultado.error) {
    throw new Error(`Não foi possível carregar os produtos: ${resultado.error.message}`);
  }

  return (resultado.data ?? []) as LinhaProduto[];
}

function prepararProdutos(linhas: LinhaProduto[] | null) {
  return ordenarProdutosPorRelevancia(removerProdutosDeCategoriasRemovidas((linhas ?? []).map(mapear)));
}

export const getCatalogo = createServerFn({
  method: "GET",
}).handler(async (): Promise<Catalogo> => {
  const supabase = publicClient();

  const [destaquesRaw, rasgaRaw, ofertasRaw, categoriasResult, subcategoriasResult] = await Promise.all([
    buscarProdutosLimitados(supabase, (query) => query.order("id", { ascending: true }), 20),
    buscarProdutosLimitados(supabase, (query) => query.eq("rasga_preco", true).order("ordem", { ascending: true }), 24),
    buscarProdutosLimitados(
      supabase,
      (query) => query.or("oferta.eq.true,preco_promocional.not.is.null").order("id", { ascending: true }),
      24,
    ),
    supabase.from("categorias").select("id,nome,slug,icone,ordem").order("ordem").order("nome"),
    supabase.from("subcategorias").select("categoria_id,nome,slug,ordem").order("ordem").order("nome"),
  ]);

  if (categoriasResult.error) throw new Error(`Não foi possível carregar as categorias: ${categoriasResult.error.message}`);
  if (subcategoriasResult.error) {
    throw new Error(`Não foi possível carregar as subcategorias: ${subcategoriasResult.error.message}`);
  }

  const subcategorias = subcategoriasResult.data ?? [];
  const categorias = (categoriasResult.data ?? []).map((categoria) => ({
    nome: categoria.nome,
    slug: categoria.slug,
    icone: categoria.icone,
    subcategorias: subcategorias
      .filter((subcategoria) => subcategoria.categoria_id === categoria.id)
      .map((subcategoria) => ({ nome: subcategoria.nome, slug: subcategoria.slug })),
  }));

  return {
    categorias: categorias.filter((categoria) => !categoriaFoiRemovida(categoria.slug)),
    produtos: prepararProdutos(destaquesRaw),
    vitrines: {
      rasgaPreco: prepararProdutos(rasgaRaw),
      ofertas: ordenarProdutosPorRelevancia(prepararProdutos(ofertasRaw)).slice(0, 10),
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
  .inputValidator(
    (dados: { categoria: string; sub?: string; sub2?: string; ordem?: string; pagina?: number; porPagina?: number }) =>
      dados,
  )
  .handler(async ({ data }): Promise<PaginaProdutos> => {
    if (categoriaFoiRemovida(data.categoria)) return { itens: [], total: 0 };

    const supabase = publicClient();
    const pagina = Math.max(1, data.pagina ?? 1);
    const porPagina = Math.min(40, Math.max(1, data.porPagina ?? 20));
    let query: any = supabase
      .from("produtos")
      .select(COLUNAS, { count: "exact" })
      .or("disponivel.eq.true,disponivel.is.null")
      .eq("categoria_slug", data.categoria);
    if (data.sub) query = query.eq("subcategoria_slug", data.sub);
    if (data.sub2) query = query.eq("subcategoria_slug", data.sub2);
    if (data.ordem === "ofertas") query = query.eq("oferta", true);
    if (data.ordem === "menor-preco") query = query.order("preco", { ascending: true });
    else if (data.ordem === "maior-preco") query = query.order("preco", { ascending: false });
    else query = query.order("imagem", { ascending: false, nullsFirst: false }).order("nome", { ascending: true });
    const inicio = (pagina - 1) * porPagina;
    const { data: linhas, count, error } = await query.range(inicio, inicio + porPagina - 1);
    if (error) throw new Error(`Não foi possível carregar os produtos: ${error.message}`);
    return { itens: prepararProdutos((linhas ?? []) as LinhaProduto[]), total: count ?? 0 };
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
  "coisa",
  "coisas",
  "item",
  "itens",
  "produto",
  "produtos",
]);

const SINONIMOS_BUSCA: Record<string, string[]> = {
  abs: ["absorvente", "intimus", "sempre livre", "sempre-livre", "always"],
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
  comida: ["comida", "alimento", "alimentos", "alimentacao", "alimentação", "biscoito", "snack"],
  gripe: ["gripe", "resfriado", "antigripal", "antigripais"],
  resfriado: ["resfriado", "gripe", "antigripal", "antigripais"],
  cabeca: ["cabeca", "cabeça", "cefaleia", "enxaqueca", "analgesico", "analgésico"],
  dor: ["dor", "analgesico", "analgésico", "antitermico", "antitérmico"],
  azia: ["azia", "refluxo", "antiacido", "antiácido", "digestivo"],
  gases: ["gases", "gas", "simeticona", "dimeticona", "antiflatulento"],
  figado: ["figado", "fígado", "hepatico", "hepático", "hepatica", "hepática", "digestivo"],
  vomito: [
    "vomito",
    "vômito",
    "nausea",
    "náusea",
    "enjoo",
    "antiemetico",
    "antiemético",
    "ondansetrona",
    "dimenidrinato",
    "bromoprida",
    "metoclopramida",
  ],
  nausea: [
    "nausea",
    "náusea",
    "vomito",
    "vômito",
    "enjoo",
    "antiemetico",
    "antiemético",
    "ondansetrona",
    "dimenidrinato",
    "bromoprida",
    "metoclopramida",
  ],
  crianca: ["crianca", "criança", "infantil", "bebe", "bebê", "baby"],
  cabelo: ["cabelo", "cabelos", "capilar", "shampoo", "condicionador", "pente", "escova de cabelo"],
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
  const classificacao = obterExpansaoBusca(produto);

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
      produto.codigoBarras,
      produto.fabricante,
      produto.principioAtivo,
      produto.categoria,
      produto.subcategoria,
      produto.informacoes?.join(" "),
      classificacao.categoria,
      classificacao.subcategoria,
      aliasesCategoria[classificacao.categoria],
      aliasesSubcategoria[classificacao.subcategoria],
      aliasesSubcategoria[classificacao.subsubcategoria],
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
          // Termos muito curtos com busca parcial (como "abs") varrem quase
          // toda a base. As equivalências mais específicas ainda encontram
          // os produtos corretos sem deixar a tela presa em carregamento.
          .filter((valor) => valor.length >= 4),
      ),
    ).slice(0, 16);

    const campos = [
      "nome",
      "principio_ativo",
      "fabricante",
      "categoria_slug",
      "subcategoria_slug",
    ];

    const termoCodigo = sanitizarParaOr(normalizarBusca(frase));

    const filtros = variantes.flatMap((variante) => campos.map((campo) => `${campo}.ilike.%${variante}%`));

    if (/^[a-z0-9-]{2,24}$/i.test(termoCodigo)) {
      filtros.push(`codigo.ilike.%${termoCodigo}%`, `codigo_barras.ilike.%${termoCodigo}%`);
    }

    let candidatosQuery: any = supabase
      .from("produtos")
      .select(COLUNAS_BUSCA)
      .or("disponivel.eq.true,disponivel.is.null");

    if (filtros.length > 0) candidatosQuery = candidatosQuery.or(filtros.join(","));

    const candidatosResult = await candidatosQuery.limit(300);
    if (candidatosResult.error) {
      throw new Error(`Não foi possível pesquisar produtos: ${candidatosResult.error.message}`);
    }

    const candidatosRaw = (candidatosResult.data ?? []) as LinhaProduto[];

    const candidatos = prepararProdutos(candidatosRaw);

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
          classificacao.subcategoria === classificacaoAtual.subcategoria &&
          classificacao.subsubcategoria === classificacaoAtual.subsubcategoria
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
