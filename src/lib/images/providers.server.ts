/**
 * ============================================================
 * FONTES DE IMAGENS DE PRODUTOS — FARMÁCIAS FRANCY
 * ============================================================
 *
 * PRIORIDADE:
 *
 * 1. EAN / CÓDIGO DE BARRAS
 *
 * 2. GOOGLE IMAGES GERAL
 *    → Principal fonte de procura
 *
 * 3. GOOGLE COM RESTRIÇÃO PARA:
 *    → Pague Menos
 *    → Farmácia Permanente
 *    → Drogasil
 *    → Droga Raia
 *
 * 4. BUSCA POR NOME + FABRICANTE
 *    → Google geral
 *    → Sites de farmácia
 *
 * 5. BASES DE PRODUTOS COMO COMPLEMENTO:
 *    → Cosmos Bluesoft
 *    → Open Food Facts
 *    → Open Beauty Facts
 *    → Open Products Facts
 *
 * RESULTADO:
 *
 * → Remove imagens duplicadas
 * → Prioriza EAN confirmado
 * → Prioriza Google e farmácias
 * → Retorna no máximo 20 imagens
 *
 * ============================================================
 */

import type { Candidato, ProdutoRef } from "./matching";

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

const LIMITE_IMAGENS = 20;

const LIMITE_GOOGLE_POR_BUSCA = 10;

const LIMITE_POR_FONTE = 6;

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

function normalizarTexto(valor: string | undefined | null): string {
  return (valor ?? "").trim().replace(/\s+/g, " ");
}

function chaveImagem(url: string | undefined | null): string {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    return `${parsed.origin}${parsed.pathname}`.trim().toLowerCase();
  } catch {
    return url.trim().toLowerCase().split("?")[0].split("#")[0];
  }
}

function removerDuplicados(candidatos: Candidato[]): Candidato[] {
  const urls = new Set<string>();

  const resultado: Candidato[] = [];

  for (const candidato of candidatos) {
    if (!candidato.imageUrl) {
      continue;
    }

    const chave = chaveImagem(candidato.imageUrl);

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

function limitarPorFonte(candidatos: Candidato[], limite: number): Candidato[] {
  return candidatos.slice(0, limite);
}

function adicionarCandidatos(destino: Candidato[], candidatos: Candidato[], limitePorFonte = LIMITE_POR_FONTE): void {
  const novos = limitarPorFonte(removerDuplicados(candidatos), limitePorFonte);

  destino.push(...novos);
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
   GOOGLE SEARCH
   ============================================================ */

function googleDisponivel(): boolean {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

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

  parametros.set("safe", "active");

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

async function buscarGoogle(
  termo: string,
  opcoes?: {
    dominio?: string;

    source?: string;

    ean?: string;

    limite?: number;
  },
): Promise<Candidato[]> {
  const limite = Math.min(Math.max(opcoes?.limite ?? LIMITE_POR_FONTE, 1), LIMITE_IMAGENS);

  const primeira = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 1,
  });

  if (primeira.length >= limite) {
    return removerDuplicados(primeira).slice(0, limite);
  }

  const segunda = await buscarPaginaGoogle(termo, {
    ...opcoes,

    start: 11,
  });

  return removerDuplicados([...primeira, ...segunda]).slice(0, limite);
}

/* ============================================================
   CONSULTAS POR EAN
   ============================================================ */

function consultasPorEan(ean: string): string[] {
  const codigo = normalizarEan(ean);

  if (!codigo) {
    return [];
  }

  return [codigo, `${codigo} produto`, `${codigo} medicamento`, `${codigo} farmácia`];
}

/* ============================================================
   CONSULTAS POR NOME
   ============================================================ */

function consultasPorNome(produto: ProdutoRef): string[] {
  const nome = normalizarTexto(produto.nome);

  const fabricante = normalizarTexto(produto.fabricante);

  const consultas: string[] = [];

  if (nome && fabricante) {
    consultas.push(`${nome} ${fabricante}`);

    consultas.push(`${fabricante} ${nome}`);
  }

  if (nome) {
    consultas.push(nome);

    consultas.push(`${nome} produto`);

    consultas.push(`${nome} embalagem`);

    consultas.push(`${nome} medicamento`);
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

      for (const consulta of consultas) {
        const encontrados = await buscarGoogle(consulta, {
          dominio: configuracao.dominio,

          source: configuracao.id,

          ean,

          limite: LIMITE_POR_FONTE,
        });

        resultados.push(...encontrados);

        if (removerDuplicados(resultados).length >= LIMITE_POR_FONTE) {
          break;
        }
      }

      return removerDuplicados(resultados).slice(0, LIMITE_POR_FONTE);
    },

    buscarPorNome: async (produto) => {
      const consultas = consultasPorNome(produto);

      const resultados: Candidato[] = [];

      for (const consulta of consultas) {
        const encontrados = await buscarGoogle(consulta, {
          dominio: configuracao.dominio,

          source: configuracao.id,

          limite: LIMITE_POR_FONTE,
        });

        resultados.push(...encontrados);

        if (removerDuplicados(resultados).length >= LIMITE_POR_FONTE) {
          break;
        }
      }

      return removerDuplicados(resultados).slice(0, LIMITE_POR_FONTE);
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
   GOOGLE IMAGES
   ============================================================ */

const googleImages: ImageProvider = {
  id: "google_images",

  nome: "Google Images",

  disponivel: googleDisponivel,

  licencaSegura: false,

  buscarPorEan: async (ean) => {
    const consultas = consultasPorEan(ean);

    const resultados: Candidato[] = [];

    for (const consulta of consultas) {
      const encontrados = await buscarGoogle(consulta, {
        source: "google_images",

        ean,

        limite: LIMITE_IMAGENS,
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
      const encontrados = await buscarGoogle(consulta, {
        source: "google_images",

        limite: LIMITE_IMAGENS,
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
   PROVIDERS DE FARMÁCIA
   ============================================================ */

const PROVIDERS_FARMACIAS: ImageProvider[] = [pagueMenos, farmaciaPermanente, drogasil, drogaRaia];

/* ============================================================
   PROVIDERS COMPLEMENTARES
   ============================================================ */

const PROVIDERS_COMPLEMENTARES: ImageProvider[] = [cosmos, openFoodFacts, openBeautyFacts, openProductsFacts];

/* ============================================================
   PROVIDERS
   ============================================================ */

export const PROVIDERS: ImageProvider[] = [googleImages, ...PROVIDERS_FARMACIAS, ...PROVIDERS_COMPLEMENTARES];

/* ============================================================
   PROVIDERS ATIVOS
   ============================================================ */

export function providersAtivos(): ImageProvider[] {
  return PROVIDERS.filter((provider) => provider.disponivel());
}

/* ============================================================
   EXECUTAR BUSCA COM SEGURANÇA
   ============================================================ */

async function buscarComSeguranca(callback: () => Promise<Candidato[]>): Promise<Candidato[]> {
  try {
    return await callback();
  } catch {
    return [];
  }
}

/* ============================================================
   BUSCA UNIFICADA
   ============================================================
 *
 * ORDEM REAL:
 *
 * ETAPA 1
 * → EAN no Google Images
 *
 * ETAPA 2
 * → EAN nos sites:
 *   Pague Menos
 *   Farmácia Permanente
 *   Drogasil
 *   Droga Raia
 *
 * ETAPA 3
 * → EAN nas bases complementares
 *
 * ETAPA 4
 * → Nome + fabricante no Google Images
 *
 * ETAPA 5
 * → Nome + fabricante nos sites de farmácia
 *
 * ETAPA 6
 * → Bases complementares
 *
 * FINAL
 * → Até 20 imagens únicas
 *
 * ============================================================
 */

export async function buscarAte20Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
  },
): Promise<Candidato[]> {
  const resultados: Candidato[] = [];

  const ean = normalizarEan(produto.codigo_barras);

  /* ==========================================================
     ETAPA 1 — GOOGLE IMAGES POR EAN
     ========================================================== */

  if (ean && googleImages.disponivel() && googleImages.buscarPorEan) {
    const encontrados = await buscarComSeguranca(() => googleImages.buscarPorEan!(ean));

    adicionarCandidatos(resultados, encontrados, 8);
  }

  /* ==========================================================
     ETAPA 2 — SITES DE FARMÁCIA POR EAN
     ========================================================== */

  if (ean) {
    for (const provider of PROVIDERS_FARMACIAS) {
      if (!provider.disponivel() || !provider.buscarPorEan) {
        continue;
      }

      const encontrados = await buscarComSeguranca(() => provider.buscarPorEan!(ean));

      adicionarCandidatos(resultados, encontrados, 4);
    }
  }

  /* ==========================================================
     ETAPA 3 — BASES POR EAN
     ========================================================== */

  if (ean) {
    for (const provider of PROVIDERS_COMPLEMENTARES) {
      if (!provider.disponivel() || !provider.buscarPorEan) {
        continue;
      }

      const encontrados = await buscarComSeguranca(() => provider.buscarPorEan!(ean));

      adicionarCandidatos(resultados, encontrados, 2);
    }
  }

  /* ==========================================================
     ETAPA 4 — GOOGLE POR NOME
     ========================================================== */

  if (
    googleImages.disponivel() &&
    googleImages.buscarPorNome &&
    removerDuplicados(resultados).length < LIMITE_IMAGENS
  ) {
    const encontrados = await buscarComSeguranca(() => googleImages.buscarPorNome!(produto));

    adicionarCandidatos(resultados, encontrados, 8);
  }

  /* ==========================================================
     ETAPA 5 — FARMÁCIAS POR NOME
     ========================================================== */

  if (removerDuplicados(resultados).length < LIMITE_IMAGENS) {
    for (const provider of PROVIDERS_FARMACIAS) {
      if (!provider.disponivel() || !provider.buscarPorNome) {
        continue;
      }

      const encontrados = await buscarComSeguranca(() => provider.buscarPorNome!(produto));

      adicionarCandidatos(resultados, encontrados, 4);

      if (removerDuplicados(resultados).length >= LIMITE_IMAGENS) {
        break;
      }
    }
  }

  /* ==========================================================
     ETAPA 6 — ORGANIZAÇÃO FINAL
     ========================================================== */

  const unicos = removerDuplicados(resultados);

  return unicos.slice(0, LIMITE_IMAGENS);
}
