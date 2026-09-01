/**
 * ============================================================
 * FONTES DE IMAGENS (PROVIDERS)
 * ============================================================
 *
 * Cada fonte implementa a interface ImageProvider.
 * Para adicionar uma nova fonte, basta criar um objeto
 * e incluí-lo em PROVIDERS.
 */

import type { Candidato, ProdutoRef } from "./matching";

export type ImageProvider = {
  id: string;
  nome: string;
  /** true quando a fonte está utilizável (chaves configuradas). */
  disponivel: () => boolean;
  /** Fonte confiável do ponto de vista de licenciamento/uso comercial. */
  licencaSegura: boolean;
  buscarPorEan?: (ean: string) => Promise<Candidato[]>;
  buscarPorNome?: (produto: ProdutoRef) => Promise<Candidato[]>;
};

async function json(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: {
        "user-agent": "FarmaciasFrancy/1.0 (catalogo de produtos)",
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!r.ok) return null;

    return await r.json();
  } catch {
    return null;
  }
}

/* ============================================================
   OPEN * FACTS (Open Food / Beauty / Products Facts)
   Bases abertas, gratuitas, sem chave. Imagens sob licença livre.
   ============================================================ */

function fromOpenFacts(base: string, source: string) {
  return async (ean: string): Promise<Candidato[]> => {
    const data = await json(`${base}/api/v2/product/${encodeURIComponent(ean)}.json`);

    const p = data?.product;
    if (!p) return [];

    const img: string | undefined =
      p.image_front_url || p.image_url || p.selected_images?.front?.display?.pt;

    if (!img) return [];

    return [
      {
        imageUrl: img,
        source,
        sourceUrl: `${base}/product/${ean}`,
        ean: String(p.code ?? ean),
        nome: p.product_name_pt || p.product_name || p.generic_name || undefined,
        fabricante: p.brands || undefined,
        licenca: "Open Database License (uso comercial permitido)",
      },
    ];
  };
}

const openFoodFacts: ImageProvider = {
  id: "open_food_facts",
  nome: "Open Food Facts",
  disponivel: () => true,
  licencaSegura: true,
  buscarPorEan: fromOpenFacts("https://world.openfoodfacts.org", "open_food_facts"),
};

const openBeautyFacts: ImageProvider = {
  id: "open_beauty_facts",
  nome: "Open Beauty Facts",
  disponivel: () => true,
  licencaSegura: true,
  buscarPorEan: fromOpenFacts("https://world.openbeautyfacts.org", "open_beauty_facts"),
};

const openProductsFacts: ImageProvider = {
  id: "open_products_facts",
  nome: "Open Products Facts",
  disponivel: () => true,
  licencaSegura: true,
  buscarPorEan: fromOpenFacts("https://world.openproductsfacts.org", "open_products_facts"),
};

/* ============================================================
   COSMOS / BLUESOFT — base brasileira de GTIN (exige chave)
   ============================================================ */

const cosmos: ImageProvider = {
  id: "cosmos",
  nome: "Cosmos Bluesoft (GTIN Brasil)",
  disponivel: () => Boolean(process.env["COSMOS_API_KEY"]),
  licencaSegura: true,

  buscarPorEan: async (ean) => {
    const key = process.env["COSMOS_API_KEY"];
    if (!key) return [];

    const data = await json(`https://api.cosmos.bluesoft.com.br/gtins/${encodeURIComponent(ean)}.json`, {
      headers: { "X-Cosmos-Token": key },
    });

    const img = data?.thumbnail || data?.picture;
    if (!img) return [];

    return [
      {
        imageUrl: img,
        source: "cosmos",
        sourceUrl: `https://cosmos.bluesoft.com.br/produtos/${ean}`,
        ean: String(data.gtin ?? ean),
        nome: data.description || undefined,
        fabricante: data.brand?.name || undefined,
        licenca: "Cosmos Bluesoft (conforme termos da API)",
      },
    ];
  },
};

/* ============================================================
   BUSCA WEB — fallback (exige Google Custom Search)
   ============================================================ */

const buscaWeb: ImageProvider = {
  id: "web_search",
  nome: "Busca na web (Google Custom Search)",
  disponivel: () => Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]),
  licencaSegura: false,

  buscarPorEan: async (ean) => buscarWeb(ean, ean),

  buscarPorNome: async (produto) =>
    buscarWeb(`${produto.nome} ${produto.fabricante ?? ""}`.trim(), undefined),
};

async function buscarWeb(termo: string, ean?: string): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"];
  const cx = process.env["GOOGLE_CSE_CX"];
  if (!key || !cx) return [];

  const url =
    `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}` +
    `&searchType=image&num=5&imgSize=medium&q=${encodeURIComponent(termo)}`;

  const data = await json(url);

  return (data?.items ?? []).map((i: any) => ({
    imageUrl: i.link,
    source: "web_search",
    sourceUrl: i.image?.contextLink,
    ean,
    nome: i.title,
    licenca: "Origem web — verificar direitos antes de publicar",
  }));
}

/* ============================================================
   ORDEM DE PRIORIDADE
   ============================================================ */

export const PROVIDERS: ImageProvider[] = [
  cosmos,
  openFoodFacts,
  openBeautyFacts,
  openProductsFacts,
  buscaWeb,
];

export function providersAtivos(): ImageProvider[] {
  return PROVIDERS.filter((p) => p.disponivel());
}
