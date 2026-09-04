/**
 * ============================================================
 * FONTES DE IMAGENS DE PRODUTOS
 * ============================================================
 *
 * PRIORIDADE DA BUSCA:
 *
 * 1. Código de barras / EAN
 * 2. Cosmos Bluesoft
 * 3. Open Food Facts
 * 4. Open Beauty Facts
 * 5. Open Products Facts
 * 6. Pague Menos
 * 7. Farmácia Permanente
 * 8. Drogasil
 * 9. Droga Raia
 * 10. Google Images / Busca geral
 *
 * A busca pode retornar até 20 candidatos por produto.
 *
 * Para o Google:
 *
 * - primeira página: resultados 1 a 10
 * - segunda página: resultados 11 a 20
 *
 * ============================================================
 */

import type { Candidato, ProdutoRef } from "./matching";

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

const LIMITE_IMAGENS = 20;

const LIMITE_GOOGLE_POR_BUSCA = 10;

/* ============================================================
   DOMÍNIOS PRIORITÁRIOS
   ============================================================ */

const DOMINIOS_FARMACIAS = [
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
   TIPO DO PROVIDER
   ============================================================ */

export type ImageProvider = {
  id: string;

  nome: string;

  disponivel: () => boolean;

  licencaSegura: boolean;

  buscarPorEan?: (ean: string) => Promise<Candidato[]>;

  buscarPorNome?: (produto: ProdutoRef) => Promise<Candidato[]>;
};

/* ============================================================
   UTILITÁRIOS
   ============================================================ */

function normalizarEan(valor: string | undefined | null): string {
  return (valor ?? "").replace(/\D/g, "");
}

function removerDuplicados(candidatos: Candidato[]): Candidato[] {
  const urls = new Set<string>();

  const resultado: Candidato[] = [];

  for (const candidato of candidatos) {
    if (!candidato.imageUrl) {
      continue;
    }

    const chave = candidato.imageUrl.trim().toLowerCase().split("?")[0];

    if (!chave) {
      continue;
    }

    if (urls.has(chave)) {
      continue;
    }

    urls.add(chave);

    resultado.push(candidato);
  }

  return resultado;
}

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
   OPEN FACTS
   ============================================================ */

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

    const imagem =
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

        licenca: "Open Database License (conforme termos da fonte)",
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
   ============================================================ */

const cosmos: ImageProvider = {
  id: "cosmos",

  nome: "Cosmos Bluesoft (GTIN Brasil)",

  disponivel: () => Boolean(process.env["COSMOS_API_KEY"]),

  licencaSegura: true,

  buscarPorEan: async (ean) => {
    const chave = process.env["COSMOS_API_KEY"];

    if (!chave) {
      return [];
    }

    const codigo = normalizarEan(ean);

    if (!codigo) {
      return [];
    }

    const data = await json(`https://api.cosmos.bluesoft.com.br/gtins/${encodeURIComponent(codigo)}.json`, {
      headers: {
        "X-Cosmos-Token": chave,
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

        licenca: "Cosmos Bluesoft (conforme termos da API)",
      },
    ];
  },
};

/* ============================================================
   GOOGLE CUSTOM SEARCH
   ============================================================ */

function googleDisponivel(): boolean {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

/**
 * Faz uma busca no Google.
 *
 * O Google retorna no máximo 10 resultados por requisição.
 */
async function buscarPaginaGoogle(
  termo: string,
  opcoes?: {
    start?: number;

    dominio?: string;

    source?: string;

    ean?: string;
  },
): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"];

  const cx = process.env["GOOGLE_CSE_CX"];

  if (!key || !cx) {
    return [];
  }

  const parametros = new URLSearchParams();

  parametros.set("key", key);

  parametros.set("cx", cx);

  parametros.set("searchType", "image");

  parametros.set("num", String(LIMITE_GOOGLE_POR_BUSCA));

  parametros.set("start", String(opcoes?.start ?? 1));

  parametros.set("imgSize", "medium");

  parametros.set("q", termo);

  if (opcoes?.dominio) {
    parametros.set("siteSearch", opcoes.dominio);

    parametros.set("siteSearchFilter", "i");
  }

  const data = await json(`https://www.googleapis.com/customsearch/v1?${parametros.toString()}`);

  return (data?.items ?? [])
    .map((item: any): Candidato | null => {
      if (!item?.link) {
        return null;
      }

      return {
        imageUrl: item.link,

        source: opcoes?.source ?? "google_images",

        sourceUrl: item?.image?.contextLink || item?.displayLink || undefined,

        ean: opcoes?.ean,

        nome: item?.title || undefined,

        fabricante: undefined,

        licenca: "Resultado de busca web — verificar direitos de uso antes da publicação",
      };
    })
    .filter(Boolean) as Candidato[];
}

/**
 * Busca até 20 imagens.
 *
 * Primeira chamada:
 *
 * start = 1
 *
 * Segunda chamada:
 *
 * start = 11
 */
async function buscarGoogle20(
  termo: string,
  opcoes?: {
    dominio?: string;

    source?: string;

    ean?: string;
  },
): Promise<Candidato[]> {
  const primeira = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 1,
  });

  const segunda = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 11,
  });

  return removerDuplicados([...primeira, ...segunda]).slice(0, LIMITE_IMAGENS);
}

/* ============================================================
   CONSULTAS POR EAN
   ============================================================ */

function consultasPorEan(ean: string): string[] {
  const codigo = normalizarEan(ean);

  if (!codigo) {
    return [];
  }

  return [codigo, `${codigo} produto`, `${codigo} medicamento`];
}

/* ============================================================
   CONSULTAS POR NOME
   ============================================================ */

function consultasPorNome(produto: ProdutoRef): string[] {
  const nome = (produto.nome ?? "").trim();

  const fabricante = (produto.fabricante ?? "").trim();

  const consultas: string[] = [];

  if (nome && fabricante) {
    consultas.push(`${nome} ${fabricante}`);
  }

  if (nome) {
    consultas.push(nome);

    consultas.push(`${nome} produto`);

    consultas.push(`${nome} embalagem`);
  }

  return Array.from(new Set(consultas.filter(Boolean)));
}

/* ============================================================
   PROVIDER DE DOMÍNIO
   ============================================================ */

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
      const consultas = consultasPorEan(ean);

      const resultados: Candidato[] = [];

      /**
       * O EAN é sempre a prioridade.
       */
      for (const consulta of consultas) {
        const encontrados = await buscarGoogle20(consulta, {
          dominio: configuracao.dominio,

          source: configuracao.id,

          ean,
        });

        resultados.push(...encontrados);

        if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
          break;
        }
      }

      return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
    },

    buscarPorNome: async (produto) => {
      const consultas = consultasPorNome(produto);

      const resultados: Candidato[] = [];

      for (const consulta of consultas) {
        const encontrados = await buscarGoogle20(consulta, {
          dominio: configuracao.dominio,

          source: configuracao.id,
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
   GOOGLE GERAL
   ============================================================ */

const googleImages: ImageProvider = {
  id: "google_images",

  nome: "Google Images",

  disponivel: googleDisponivel,

  licencaSegura: false,

  buscarPorEan: async (ean) => {
    const consultas = consultasPorEan(ean);

    const resultados: Candidato[] = [];

    /**
     * Pesquisa pelo código de barras
     * antes de qualquer outro parâmetro.
     */
    for (const consulta of consultas) {
      const encontrados = await buscarGoogle20(consulta, {
        source: "google_images",

        ean,
      });

      resultados.push(...encontrados);

      if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
        break;
      }
    }

    return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
  },

  buscarPorNome: async (produto) => {
    const consultas = consultasPorNome(produto);

    const resultados: Candidato[] = [];

    for (const consulta of consultas) {
      const encontrados = await buscarGoogle20(consulta, {
        source: "google_images",
      });

      resultados.push(...encontrados);

      if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
        break;
      }
    }

    return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
  },
};

/* ============================================================
   PROVIDERS
   ============================================================
 *
 * A ORDEM DEFINE A PRIORIDADE.
 *
 * PRIMEIRO:
 *
 * Fontes específicas e confiáveis.
 *
 * DEPOIS:
 *
 * Sites brasileiros de farmácia.
 *
 * POR ÚLTIMO:
 *
 * Google Images geral.
 * ============================================================
 */

export const PROVIDERS: ImageProvider[] = [
  cosmos,

  openFoodFacts,

  openBeautyFacts,

  openProductsFacts,

  pagueMenos,

  farmaciaPermanente,

  drogasil,

  drogaRaia,

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
 * Pode ser utilizada por outras partes do sistema.
 *
 * Busca primeiro:
 *
 * EAN
 *
 * Depois:
 *
 * nome e fabricante.
 *
 * O resultado final nunca ultrapassa 20 imagens.
 * ============================================================
 */

export async function buscarAte20Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
  },
): Promise<Candidato[]> {
  const resultados: Candidato[] = [];

  const ean = normalizarEan(produto.codigo_barras);

  const providers = providersAtivos();

  /* ==========================================================
     ETAPA 1 — EAN
     ========================================================== */

  if (ean) {
    for (const provider of providers) {
      if (!provider.buscarPorEan) {
        continue;
      }

      try {
        const encontrados = await provider.buscarPorEan(ean);

        resultados.push(...encontrados);
      } catch {
        /**
         * Se uma fonte falhar,
         * as outras continuam funcionando.
         */
      }
    }
  }

  /* ==========================================================
     ETAPA 2 — NOME
     ========================================================== */

  for (const provider of providers) {
    if (!provider.buscarPorNome) {
      continue;
    }

    try {
      const encontrados = await provider.buscarPorNome(produto);

      resultados.push(...encontrados);
    } catch {
      /**
       * Continua procurando
       * nas outras fontes.
       */
    }
  }

  /* ==========================================================
     RESULTADO FINAL
     ========================================================== */

  return removerDuplicados(resultados).slice(0, LIMITE_IMAGENS);
}
