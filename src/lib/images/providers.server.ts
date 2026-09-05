// ============================================================
// ARQUIVO COMPLETO
// src/lib/images/providers.server.ts
// ============================================================

/**
 * BUSCA RÁPIDA E PARALELA DE IMAGENS
 *
 * Principais melhorias:
 *
 * - Busca vários sites simultaneamente.
 * - Busca várias consultas simultaneamente.
 * - Google busca páginas simultaneamente.
 * - Retorna até 50 imagens por produto.
 * - Limita concorrência para evitar bloqueios.
 * - EAN e nome são pesquisados em paralelo.
 */

import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 50;
const LIMITE_GOOGLE_POR_BUSCA = 10;
const PAGINAS_GOOGLE = [1, 11, 21, 31, 41];

const SITES = [
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
    id: "droga_raia",
    nome: "Droga Raia",
    dominio: "drogaraia.com.br",
  },
] as const;

export type ImageProvider = {
  id: string;
  nome: string;
  dominio: string;
  disponivel: () => boolean;
  licencaSegura: boolean;
  buscarPorEan: (ean: string) => Promise<Candidato[]>;
  buscarPorNome: (
    produto: ProdutoRef & {
      descricao?: string | null;
    },
  ) => Promise<Candidato[]>;
};

function normalizarEan(valor: string | null | undefined) {
  return (valor ?? "").replace(/\D/g, "");
}

function limpar(valor: string | null | undefined) {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function removerDuplicados(candidatos: Candidato[]) {
  const vistos = new Set<string>();

  return candidatos.filter((candidato) => {
    const chave = (candidato.imageUrl ?? "").trim().split("?")[0].toLowerCase();

    if (!chave || vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);

    return true;
  });
}

function googleDisponivel() {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

function firecrawlDisponivel() {
  const chave = process.env["FIRECRAWL_API_KEY"];

  if (!chave) {
    return false;
  }

  if (chave.startsWith("lovc_")) {
    return Boolean(process.env["LOVABLE_API_KEY"]);
  }

  return true;
}

/**
 * Executa tarefas simultaneamente com limite de concorrência.
 */
async function executarComConcorrencia<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!itens.length) {
    return [];
  }

  const resultados: R[] = [];
  let indice = 0;

  const workers = Array.from(
    {
      length: Math.min(limite, itens.length),
    },
    async () => {
      while (true) {
        const atual = indice++;

        if (atual >= itens.length) {
          break;
        }

        try {
          resultados[atual] = await tarefa(itens[atual]);
        } catch {
          resultados[atual] = undefined as R;
        }
      }
    },
  );

  await Promise.all(workers);

  return resultados.filter((resultado) => resultado !== undefined);
}

/**
 * Busca no Firecrawl.
 */
async function buscarFirecrawl(termo: string, site: (typeof SITES)[number], ean?: string): Promise<Candidato[]> {
  const chave = process.env["FIRECRAWL_API_KEY"];

  if (!chave || !limpar(termo)) {
    return [];
  }

  const gateway = chave.startsWith("lovc_");

  const url = gateway
    ? "https://connector-gateway.lovable.dev/firecrawl/v2/search"
    : "https://api.firecrawl.dev/v2/search";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (gateway) {
    headers["Authorization"] = `Bearer ${process.env["LOVABLE_API_KEY"]}`;

    headers["X-Connection-Api-Key"] = chave;
  } else {
    headers["Authorization"] = `Bearer ${chave}`;
  }

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `${limpar(termo)} site:${site.dominio}`,
        limit: 10,
        lang: "pt",
        country: "br",
        scrapeOptions: {
          formats: ["html"],
        },
      }),
    });

    if (!resposta.ok) {
      return [];
    }

    const dados = await resposta.json();

    const itens = Array.isArray(dados?.data) ? dados.data : Array.isArray(dados?.data?.web) ? dados.data.web : [];

    const encontrados: Candidato[] = [];

    for (const item of itens) {
      const sourceUrl: string | undefined = item?.url;

      if (!sourceUrl || !sourceUrl.toLowerCase().includes(site.dominio.replace("www.", ""))) {
        continue;
      }

      const html: string = item?.html ?? item?.rawHtml ?? "";

      const meta = item?.metadata ?? {};

      const imagens = new Set<string>();

      for (const chaveMeta of ["og:image", "ogImage", "twitter:image", "image"]) {
        const valor = meta[chaveMeta];

        if (typeof valor === "string") {
          imagens.add(valor);
        }

        if (Array.isArray(valor)) {
          for (const imagem of valor) {
            if (typeof imagem === "string") {
              imagens.add(imagem);
            }
          }
        }
      }

      for (const match of html.matchAll(
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
      )) {
        imagens.add(match[1]);
      }

      for (const match of html.matchAll(/"image"\s*:\s*"(https?:\/\/[^"]+)"/gi)) {
        imagens.add(match[1]);
      }

      for (const imageUrl of imagens) {
        if (!/^https?:\/\//i.test(imageUrl)) {
          continue;
        }

        encontrados.push({
          imageUrl,
          source: site.id,
          sourceUrl,
          ean,
          nome: item?.title || undefined,
          fabricante: undefined,
          licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
        });
      }
    }

    return removerDuplicados(encontrados).slice(0, LIMITE_IMAGENS);
  } catch (erro) {
    console.error(`[imagens] Erro Firecrawl ${site.id}:`, erro);

    return [];
  }
}

/**
 * Google Custom Search.
 *
 * As páginas são pesquisadas simultaneamente.
 */
async function buscarGoogle(termo: string, site: (typeof SITES)[number], ean?: string): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"];
  const cx = process.env["GOOGLE_CSE_CX"];

  if (!key || !cx || !limpar(termo)) {
    return [];
  }

  const resultados = await executarComConcorrencia(PAGINAS_GOOGLE, 5, async (start) => {
    try {
      const parametros = new URLSearchParams({
        key,
        cx,
        q: limpar(termo),
        searchType: "image",
        num: String(LIMITE_GOOGLE_POR_BUSCA),
        start: String(start),
        siteSearch: site.dominio,
        siteSearchFilter: "i",
        imgSize: "medium",
      });

      const resposta = await fetch(`https://www.googleapis.com/customsearch/v1?${parametros.toString()}`);

      if (!resposta.ok) {
        return [] as Candidato[];
      }

      const dados = await resposta.json();

      const encontrados: Candidato[] = [];

      for (const item of Array.isArray(dados?.items) ? dados.items : []) {
        const imageUrl = item?.link;
        const sourceUrl = item?.image?.contextLink;

        if (typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) {
          continue;
        }

        if (sourceUrl && !String(sourceUrl).toLowerCase().includes(site.dominio.replace("www.", ""))) {
          continue;
        }

        encontrados.push({
          imageUrl,
          source: site.id,
          sourceUrl,
          ean,
          nome: item?.title || undefined,
          fabricante: undefined,
          licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
        });
      }

      return encontrados;
    } catch {
      return [] as Candidato[];
    }
  });

  return removerDuplicados(resultados.flat()).slice(0, LIMITE_IMAGENS);
}

function consultasEan(ean: string) {
  const codigo = normalizarEan(ean);

  if (!codigo) {
    return [];
  }

  return [codigo, `EAN ${codigo}`, `${codigo} produto`];
}

function consultasProduto(
  produto: ProdutoRef & {
    descricao?: string | null;
  },
) {
  const nome = limpar(produto.nome);

  const fabricante = limpar(produto.fabricante);

  const descricao = limpar(produto.descricao);

  const consultas: string[] = [];

  if (nome) {
    consultas.push(nome);
  }

  if (nome && fabricante) {
    consultas.push(`${nome} ${fabricante}`);
  }

  if (nome && descricao) {
    consultas.push(`${nome} ${descricao.split(" ").slice(0, 12).join(" ")}`);
  }

  if (descricao) {
    consultas.push(descricao.split(" ").slice(0, 15).join(" "));
  }

  return [...new Set(consultas.filter(Boolean))];
}

/**
 * Busca uma consulta em Google e Firecrawl simultaneamente.
 */
async function buscarNoSite(termo: string, site: (typeof SITES)[number], ean?: string): Promise<Candidato[]> {
  const tarefas: Promise<Candidato[]>[] = [];

  if (googleDisponivel()) {
    tarefas.push(buscarGoogle(termo, site, ean));
  }

  if (firecrawlDisponivel()) {
    tarefas.push(buscarFirecrawl(termo, site, ean));
  }

  if (!tarefas.length) {
    return [];
  }

  const resultados = await Promise.allSettled(tarefas);

  const candidatos: Candidato[] = [];

  for (const resultado of resultados) {
    if (resultado.status === "fulfilled") {
      candidatos.push(...resultado.value);
    }
  }

  return removerDuplicados(candidatos).slice(0, LIMITE_IMAGENS);
}

/**
 * Busca todas as consultas simultaneamente para o mesmo site.
 */
async function buscarConsultasParalelas(
  consultas: string[],
  site: (typeof SITES)[number],
  ean?: string,
): Promise<Candidato[]> {
  if (!consultas.length) {
    return [];
  }

  const resultados = await executarComConcorrencia(consultas, 4, async (consulta) => buscarNoSite(consulta, site, ean));

  return removerDuplicados(resultados.flat()).slice(0, LIMITE_IMAGENS);
}

function criarProvider(site: (typeof SITES)[number]): ImageProvider {
  return {
    ...site,

    disponivel: () => googleDisponivel() || firecrawlDisponivel(),

    licencaSegura: false,

    buscarPorEan: async (ean) => {
      return buscarConsultasParalelas(consultasEan(ean), site, normalizarEan(ean));
    },

    buscarPorNome: async (produto) => {
      return buscarConsultasParalelas(consultasProduto(produto), site);
    },
  };
}

export const PROVIDERS: ImageProvider[] = SITES.map(criarProvider);

export function providersAtivos(): ImageProvider[] {
  return PROVIDERS.filter((provider) => provider.disponivel());
}

/**
 * BUSCA PRINCIPAL
 *
 * Agora:
 *
 * - Os 3 sites são pesquisados simultaneamente.
 * - EAN é pesquisado simultaneamente.
 * - Nome também pode ser pesquisado simultaneamente.
 * - Até 50 imagens são retornadas.
 */
export async function buscarAte50Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
    descricao?: string | null;
  },
): Promise<Candidato[]> {
  const providers = providersAtivos();

  if (!providers.length) {
    return [];
  }

  const ean = normalizarEan(produto.codigo_barras);

  const tarefas: Promise<Candidato[]>[] = [];

  /**
   * Pesquisa por EAN em TODOS os sites.
   */
  if (ean) {
    for (const provider of providers) {
      tarefas.push(provider.buscarPorEan(ean));
    }
  }

  /**
   * Pesquisa pelo nome em TODOS os sites.
   *
   * Isso acontece junto com o EAN,
   * aumentando muito a velocidade.
   */
  for (const provider of providers) {
    tarefas.push(provider.buscarPorNome(produto));
  }

  const resultados = await Promise.allSettled(tarefas);

  const candidatos: Candidato[] = [];

  for (const resultado of resultados) {
    if (resultado.status === "fulfilled") {
      candidatos.push(...resultado.value);
    }
  }

  return removerDuplicados(candidatos).slice(0, LIMITE_IMAGENS);
}

/**
 * Mantido para compatibilidade
 * com código antigo.
 */
export async function buscarAte20Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
    descricao?: string | null;
  },
): Promise<Candidato[]> {
  return buscarAte50Imagens(produto);
}
