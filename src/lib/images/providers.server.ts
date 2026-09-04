/**
 * ============================================================
 * FONTES DE IMAGENS DE PRODUTOS
 * ============================================================
 *
 * ESTRATÉGIA DE BUSCA:
 *
 * 1. Código de barras / EAN
 * 2. Google Image Search
 * 3. Google Image Search restrito à Pague Menos
 * 4. Google Image Search restrito à Farmácia Permanente
 * 5. Google Image Search restrito à Drogasil
 * 6. Google Image Search restrito à Droga Raia
 * 7. Nome + fabricante
 * 8. Open Food Facts
 * 9. Open Beauty Facts
 * 10. Open Products Facts
 * 11. Cosmos Bluesoft
 *
 * IMPORTANTE:
 *
 * O Google Custom Search permite no máximo 10 resultados por
 * requisição.
 *
 * Para obter até 20 imagens, este arquivo faz:
 *
 * start=1  -> resultados 1 até 10
 * start=11 -> resultados 11 até 20
 *
 * Também são feitas buscas separadas por domínio para aumentar
 * as chances de encontrar imagens corretas de produtos
 * farmacêuticos brasileiros.
 * ============================================================
 */

import type { Candidato, ProdutoRef } from "./matching";

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

/**
 * Quantidade máxima desejada de imagens por pesquisa.
 */
const LIMITE_IMAGENS = 20;

/**
 * Máximo permitido pelo Google Custom Search por requisição.
 */
const LIMITE_POR_REQUISICAO_GOOGLE = 10;

/**
 * Domínios prioritários.
 *
 * A busca geral do Google também continua sendo utilizada.
 */
const DOMINIOS_PRIORITARIOS = [
  {
    id: "pague_menos",

    nome: "Pague Menos",

    dominio: "paguemenos.com.br",
  },

  {
    id: "farmacia_permanente",

    nome: "Farmácia Permanente",

    dominio: "farmaciapermanente.com.br",
  },

  {
    id: "drogasil",

    nome: "Drogasil",

    dominio: "drogasil.com.br",
  },

  {
    id: "droga_raia",

    nome: "Droga Raia",

    dominio: "drogaraia.com.br",
  },
] as const;

/* ============================================================
   TIPOS
   ============================================================ */

export type ImageProvider = {
  id: string;

  nome: string;

  /**
   * Informa se a fonte está disponível.
   */
  disponivel: () => boolean;

  /**
   * Indica se a fonte possui licença conhecida e apropriada
   * para uso conforme a política da fonte.
   */
  licencaSegura: boolean;

  /**
   * Busca utilizando código de barras / EAN.
   */
  buscarPorEan?: (ean: string) => Promise<Candidato[]>;

  /**
   * Busca utilizando nome e fabricante.
   */
  buscarPorNome?: (produto: ProdutoRef) => Promise<Candidato[]>;
};

/* ============================================================
   FUNÇÃO DE FETCH JSON
   ============================================================ */

async function json(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const resposta = await fetch(url, {
      ...init,

      headers: {
        "user-agent": "FarmaciasFrancy/1.0 (catalogo de produtos)",

        accept: "application/json",

        ...(init?.headers ?? {}),
      },
    });

    if (!resposta.ok) {
      return null;
    }

    return await resposta.json();
  } catch {
    return null;
  }
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function normalizarTexto(valor: string | undefined | null): string {
  return (valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Remove caracteres que não pertencem ao código de barras.
 */
function normalizarEan(valor: string | undefined | null): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Remove imagens duplicadas.
 *
 * A mesma imagem pode aparecer:
 *
 * - na busca geral;
 * - na busca por domínio;
 * - em mais de uma página do Google.
 */
function removerDuplicados(candidatos: Candidato[]): Candidato[] {
  const urls = new Set<string>();

  const resultado: Candidato[] = [];

  for (const candidato of candidatos) {
    const url = candidato.imageUrl?.trim();

    if (!url) {
      continue;
    }

    const chave = url.toLowerCase().split("?")[0];

    if (urls.has(chave)) {
      continue;
    }

    urls.add(chave);

    resultado.push(candidato);
  }

  return resultado;
}

/* ============================================================
   OPEN FACTS
   ============================================================
 *
 * Fontes abertas e gratuitas.
 *
 * - Open Food Facts
 * - Open Beauty Facts
 * - Open Products Facts
 * ============================================================
 */

function fromOpenFacts(base: string, source: string) {
  return async (ean: string): Promise<Candidato[]> => {
    const codigo = normalizarEan(ean);

    if (!codigo) {
      return [];
    }

    const data = await json(`${base}/api/v2/product/${encodeURIComponent(codigo)}.json`);

    const produto = data?.product;

    if (!produto) {
      return [];
    }

    const imagem: string | undefined =
      produto.image_front_url ||
      produto.image_url ||
      produto.selected_images?.front?.display?.pt ||
      produto.selected_images?.front?.display?.en;

    if (!imagem) {
      return [];
    }

    return [
      {
        imageUrl: imagem,

        source,

        sourceUrl: `${base}/product/${codigo}`,

        ean: String(produto.code ?? codigo),

        nome: produto.product_name_pt || produto.product_name || produto.generic_name || undefined,

        fabricante: produto.brands || undefined,

        licenca: "Open Database License (verificar atribuição e termos da fonte)",
      },
    ];
  };
}

/* ============================================================
   OPEN FOOD FACTS
   ============================================================ */

const openFoodFacts: ImageProvider = {
  id: "open_food_facts",

  nome: "Open Food Facts",

  disponivel: () => true,

  licencaSegura: true,

  buscarPorEan: fromOpenFacts("https://world.openfoodfacts.org", "open_food_facts"),
};

/* ============================================================
   OPEN BEAUTY FACTS
   ============================================================ */

const openBeautyFacts: ImageProvider = {
  id: "open_beauty_facts",

  nome: "Open Beauty Facts",

  disponivel: () => true,

  licencaSegura: true,

  buscarPorEan: fromOpenFacts("https://world.openbeautyfacts.org", "open_beauty_facts"),
};

/* ============================================================
   OPEN PRODUCTS FACTS
   ============================================================ */

const openProductsFacts: ImageProvider = {
  id: "open_products_facts",

  nome: "Open Products Facts",

  disponivel: () => true,

  licencaSegura: true,

  buscarPorEan: fromOpenFacts("https://world.openproductsfacts.org", "open_products_facts"),
};

/* ============================================================
   COSMOS BLUESOFT
   ============================================================
 *
 * Base brasileira de GTIN.
 *
 * Necessita:
 *
 * COSMOS_API_KEY
 * ============================================================
 */

const cosmos: ImageProvider = {
  id: "cosmos",

  nome: "Cosmos Bluesoft (GTIN Brasil)",

  disponivel: () => Boolean(process.env["COSMOS_API_KEY"]),

  licencaSegura: true,

  buscarPorEan: async (ean) => {
    const key = process.env["COSMOS_API_KEY"];

    if (!key) {
      return [];
    }

    const codigo = normalizarEan(ean);

    if (!codigo) {
      return [];
    }

    const data = await json(`https://api.cosmos.bluesoft.com.br/gtins/${encodeURIComponent(codigo)}.json`, {
      headers: {
        "X-Cosmos-Token": key,
      },
    });

    const imagem = data?.thumbnail || data?.picture || data?.image;

    if (!imagem) {
      return [];
    }

    return [
      {
        imageUrl: imagem,

        source: "cosmos",

        sourceUrl: `https://cosmos.bluesoft.com.br/produtos/${codigo}`,

        ean: String(data.gtin ?? codigo),

        nome: data.description || undefined,

        fabricante: data.brand?.name || undefined,

        licenca: "Cosmos Bluesoft — conforme os termos da API",
      },
    ];
  },
};

/* ============================================================
   GOOGLE IMAGE SEARCH
   ============================================================
 *
 * CONFIGURAÇÃO NECESSÁRIA:
 *
 * GOOGLE_CSE_KEY
 * GOOGLE_CSE_CX
 *
 * A busca é feita através do mecanismo configurado pelo
 * administrador.
 *
 * ESTRATÉGIA:
 *
 * 1. Busca geral por EAN
 * 2. Busca geral por nome
 * 3. Busca em domínios específicos
 *
 * Cada busca pode buscar até 20 candidatos usando:
 *
 * start=1
 * start=11
 * ============================================================
 */

function googleDisponivel(): boolean {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

/**
 * Faz uma única requisição paginada ao Google.
 */
async function buscarPaginaGoogle(
  termo: string,
  opcoes?: {
    start?: number;

    site?: string;

    source?: string;

    sourceNome?: string;

    ean?: string;
  },
): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"];

  const cx = process.env["GOOGLE_CSE_CX"];

  if (!key || !cx) {
    return [];
  }

  const start = opcoes?.start ?? 1;

  const parametros = new URLSearchParams();

  parametros.set("key", key);

  parametros.set("cx", cx);

  parametros.set("searchType", "image");

  parametros.set("num", String(LIMITE_POR_REQUISICAO_GOOGLE));

  parametros.set("start", String(start));

  /**
   * A pesquisa pelo código de barras é o parâmetro principal.
   */
  parametros.set("q", termo);

  /**
   * Imagens médias ou grandes tendem a ter melhor qualidade
   * para o catálogo.
   */
  parametros.set("imgSize", "medium");

  /**
   * Quando existe domínio específico, restringe a busca.
   */
  if (opcoes?.site) {
    parametros.set("siteSearch", opcoes.site);

    parametros.set("siteSearchFilter", "i");
  }

  const url = `https://www.googleapis.com/customsearch/v1?${parametros.toString()}`;

  const data = await json(url);

  const itens = data?.items ?? [];

  return itens
    .map((item: any): Candidato | null => {
      const imageUrl = item?.link;

      if (!imageUrl) {
        return null;
      }

      return {
        imageUrl,

        source: opcoes?.source ?? "google_images",

        sourceUrl: item?.image?.contextLink || item?.displayLink || undefined,

        ean: opcoes?.ean,

        nome: item?.title || undefined,

        licenca: "Resultado de busca web — verificar direitos e termos da imagem antes de publicar",
      };
    })
    .filter(Boolean) as Candidato[];
}

/**
 * Faz até duas requisições ao Google:
 *
 * start=1
 * start=11
 *
 * Resultado máximo:
 *
 * 20 imagens.
 */
async function buscarGoogle20(
  termo: string,
  opcoes?: {
    site?: string;

    source?: string;

    sourceNome?: string;

    ean?: string;
  },
): Promise<Candidato[]> {
  const primeira = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 1,
  });

  /**
   * Caso já existam 20 resultados,
   * não precisa buscar novamente.
   */
  if (primeira.length >= LIMITE_IMAGENS) {
    return primeira.slice(0, LIMITE_IMAGENS);
  }

  const segunda = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 11,
  });

  return removerDuplicados([...primeira, ...segunda]).slice(0, LIMITE_IMAGENS);
}

/* ============================================================
   CONSULTAS INTELIGENTES
   ============================================================ */

/**
 * Gera variações para pesquisa por código de barras.
 */
function gerarConsultasEan(ean: string): string[] {
  const codigo = normalizarEan(ean);

  if (!codigo) {
    return [];
  }

  return [
    /**
     * PRIORIDADE ABSOLUTA:
     * código de barras puro.
     */
    codigo,

    /**
     * Variação explicitando o produto.
     */
    `${codigo} produto`,

    /**
     * Variação GTIN.
     */
    `${codigo} GTIN`,
  ];
}

/**
 * Gera consultas por nome.
 */
function gerarConsultasNome(produto: ProdutoRef): string[] {
  const nome = (produto.nome ?? "").trim();

  const fabricante = (produto.fabricante ?? "").trim();

  const consultas: string[] = [];

  if (nome && fabricante) {
    consultas.push(`${nome} ${fabricante}`);
  }

  if (nome) {
    consultas.push(nome);

    consultas.push(`${nome} embalagem`);

    consultas.push(`${nome} produto`);
  }

  return Array.from(new Set(consultas));
}

/* ============================================================
   BUSCA GERAL GOOGLE
   ============================================================ */

async function buscarGooglePorEan(ean: string): Promise<Candidato[]> {
  const consultas = gerarConsultasEan(ean);

  const resultados: Candidato[] = [];

  /**
   * O código puro é sempre pesquisado primeiro.
   */
  for (const consulta of consultas) {
    const encontrados = await buscarGoogle20(consulta, {
      source: "google_images",

      sourceNome: "Google Images",

      ean: ean,
    });

    resultados.push(...encontrados);

    /**
     * Não fazemos uma quantidade infinita de requisições.
     *
     * Assim que houver 20 candidatos únicos,
     * a busca geral é suficiente.
     */
    if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
      break;
    }
  }

  return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
}

async function buscarGooglePorNome(produto: ProdutoRef): Promise<Candidato[]> {
  const consultas = gerarConsultasNome(produto);

  const resultados: Candidato[] = [];

  for (const consulta of consultas) {
    const encontrados = await buscarGoogle20(consulta, {
      source: "google_images",

      sourceNome: "Google Images",
    });

    resultados.push(...encontrados);

    if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
      break;
    }
  }

  return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
}

/* ============================================================
   BUSCA NOS SITES DE FARMÁCIA
   ============================================================ */

/**
 * Pesquisa o código de barras e depois o nome dentro
 * dos sites prioritários.
 */
async function buscarNosDominios(termo: string, ean?: string): Promise<Candidato[]> {
  const resultados: Candidato[] = [];

  for (const dominioInfo of DOMINIOS_PRIORITARIOS) {
    /**
     * Cada domínio pode retornar até 20 imagens.
     */
    const encontrados = await buscarGoogle20(termo, {
      site: dominioInfo.dominio,

      source: dominioInfo.id,

      sourceNome: dominioInfo.nome,

      ean,
    });

    resultados.push(...encontrados);
  }

  return removerDuplicados(resultados);
}

/**
 * Pesquisa prioritariamente pelo código de barras
 * dentro das farmácias.
 */
async function buscarDominiosPorEan(ean: string): Promise<Candidato[]> {
  const consultas = gerarConsultasEan(ean);

  const resultados: Candidato[] = [];

  for (const consulta of consultas) {
    const encontrados = await buscarNosDominios(consulta, ean);

    resultados.push(...encontrados);

    /**
     * Já existem muitos candidatos.
     *
     * Não precisamos executar todas as variações.
     */
    if (removerDuplicados(resultados).length >= LIMITE_IMAGENS * 2) {
      break;
    }
  }

  return removerDuplicados(resultados);
}

/**
 * Pesquisa por nome dentro das farmácias.
 */
async function buscarDominiosPorNome(produto: ProdutoRef): Promise<Candidato[]> {
  const consultas = gerarConsultasNome(produto);

  const resultados: Candidato[] = [];

  for (const consulta of consultas) {
    const encontrados = await buscarNosDominios(consulta);

    resultados.push(...encontrados);

    if (removerDuplicados(resultados).length >= LIMITE_IMAGENS * 2) {
      break;
    }
  }

  return removerDuplicados(resultados);
}

/* ============================================================
   PROVIDER GOOGLE COMPLETO
   ============================================================
 *
 * Esta fonte reúne:
 *
 * - Google Images
 * - Pague Menos
 * - Farmácia Permanente
 * - Drogasil
 * - Droga Raia
 *
 * O pipeline existente fará a classificação dos candidatos.
 * ============================================================
 */

const googleImages: ImageProvider = {
  id: "google_images",

  nome: "Google Images + Farmácias Brasileiras",

  disponivel: googleDisponivel,

  /**
   * Resultados da web não podem ser automaticamente
   * considerados livres de direitos.
   */
  licencaSegura: false,

  buscarPorEan: async (ean) => {
    const codigo = normalizarEan(ean);

    if (!codigo) {
      return [];
    }

    /**
     * ====================================================
     * BUSCA GERAL GOOGLE
     * ====================================================
     */

    const google = await buscarGooglePorEan(codigo);

    /**
     * ====================================================
     * BUSCA NOS DOMÍNIOS
     * ====================================================
     */

    const dominios = await buscarDominiosPorEan(codigo);

    /**
     * ====================================================
     * ORDEM DE PRIORIDADE
     * ====================================================
     *
     * 1. Resultados do código de barras no Google
     * 2. Resultados do código nos sites farmacêuticos
     */

    return removerDuplicados([...google, ...dominios]).slice(0, LIMITE_IMAGENS);
  },

  buscarPorNome: async (produto) => {
    /**
     * ====================================================
     * GOOGLE GERAL
     * ====================================================
     */

    const google = await buscarGooglePorNome(produto);

    /**
     * ====================================================
     * DOMÍNIOS DE FARMÁCIA
     * ====================================================
     */

    const dominios = await buscarDominiosPorNome(produto);

    return removerDuplicados([...google, ...dominios]).slice(0, LIMITE_IMAGENS);
  },
};

/* ============================================================
   PROVIDERS INDIVIDUAIS DE DOMÍNIO
   ============================================================
 *
 * Esses providers existem separadamente para que o pipeline
 * consiga identificar claramente a origem da imagem.
 * ============================================================
 */

function criarProviderDominio(configuracao: {
  id: string;

  nome: string;

  dominio: string;
}): ImageProvider {
  return {
    id: configuracao.id,

    nome: configuracao.nome,

    disponivel: googleDisponivel,

    licencaSegura: false,

    buscarPorEan: async (ean) => {
      const codigo = normalizarEan(ean);

      if (!codigo) {
        return [];
      }

      const consultas = gerarConsultasEan(codigo);

      const resultados: Candidato[] = [];

      for (const consulta of consultas) {
        const encontrados = await buscarGoogle20(consulta, {
          site: configuracao.dominio,

          source: configuracao.id,

          sourceNome: configuracao.nome,

          ean: codigo,
        });

        resultados.push(...encontrados);

        if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
          break;
        }
      }

      return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
    },

    buscarPorNome: async (produto) => {
      const consultas = gerarConsultasNome(produto);

      const resultados: Candidato[] = [];

      for (const consulta of consultas) {
        const encontrados = await buscarGoogle20(consulta, {
          site: configuracao.dominio,

          source: configuracao.id,

          sourceNome: configuracao.nome,
        });

        resultados.push(...encontrados);

        if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
          break;
        }
      }

      return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
    },
  };
}

/* ============================================================
   PAGUE MENOS
   ============================================================ */

const pagueMenos = criarProviderDominio({
  id: "pague_menos",

  nome: "Pague Menos",

  dominio: "paguemenos.com.br",
});

/* ============================================================
   FARMÁCIA PERMANENTE
   ============================================================ */

const farmaciaPermanente = criarProviderDominio({
  id: "farmacia_permanente",

  nome: "Farmácia Permanente",

  dominio: "farmaciapermanente.com.br",
});

/* ============================================================
   DROGASIL
   ============================================================ */

const drogasil = criarProviderDominio({
  id: "drogasil",

  nome: "Drogasil",

  dominio: "drogasil.com.br",
});

/* ============================================================
   DROGA RAIA
   ============================================================ */

const drogaRaia = criarProviderDominio({
  id: "droga_raia",

  nome: "Droga Raia",

  dominio: "drogaraia.com.br",
});

/* ============================================================
   PROVIDERS
   ============================================================
 *
 * A ordem abaixo define a prioridade inicial das fontes.
 *
 * O matching.ts e o pipeline podem continuar avaliando
 * confiança e compatibilidade posteriormente.
 * ============================================================
 */

export const PROVIDERS: ImageProvider[] = [
  /**
   * Base brasileira por GTIN.
   */
  cosmos,

  /**
   * Fontes abertas.
   */
  openFoodFacts,

  openBeautyFacts,

  openProductsFacts,

  /**
   * Fontes farmacêuticas brasileiras.
   */
  pagueMenos,

  farmaciaPermanente,

  drogasil,

  drogaRaia,

  /**
   * Busca ampla no Google.
   *
   * Fica por último na lista porque as fontes específicas
   * são mais úteis para encontrar o produto correto.
   */
  googleImages,
];

/* ============================================================
   PROVIDERS ATIVOS
   ============================================================ */

export function providersAtivos(): ImageProvider[] {
  return PROVIDERS.filter((provider) => provider.disponivel());
}

/* ============================================================
   BUSCA UNIFICADA
   ============================================================
 *
 * Esta função é opcional para outros módulos do sistema.
 *
 * Ela executa todas as fontes disponíveis, remove duplicados
 * e devolve os primeiros 20 candidatos.
 *
 * PRIORIDADE:
 *
 * 1. EAN
 * 2. Nome
 * ============================================================
 */

export async function buscarAte20Imagens(produto: ProdutoRef): Promise<Candidato[]> {
  const resultados: Candidato[] = [];

  const ean = normalizarEan((produto as any).ean ?? (produto as any).codigo_barras ?? "");

  const ativos = providersAtivos();

  /**
   * ==========================================================
   * PRIORIDADE 1:
   * CÓDIGO DE BARRAS
   * ==========================================================
   */

  if (ean) {
    for (const provider of ativos) {
      if (!provider.buscarPorEan) {
        continue;
      }

      try {
        const encontrados = await provider.buscarPorEan(ean);

        resultados.push(...encontrados);
      } catch {
        /**
         * Uma fonte não pode interromper
         * a busca das demais.
         */
      }
    }
  }

  /**
   * ==========================================================
   * PRIORIDADE 2:
   * NOME + FABRICANTE
   * ==========================================================
   */

  if (removerDuplicados(resultados).length < LIMITE_IMAGENS) {
    for (const provider of ativos) {
      if (!provider.buscarPorNome) {
        continue;
      }

      try {
        const encontrados = await provider.buscarPorNome(produto);

        resultados.push(...encontrados);
      } catch {
        /**
         * Continua tentando as demais fontes.
         */
      }

      if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
        break;
      }
    }
  }

  /**
   * ==========================================================
   * RESULTADO FINAL
   * ==========================================================
   */

  return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
}
