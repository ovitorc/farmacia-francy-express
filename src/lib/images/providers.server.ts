/**
 * ============================================================
 * BUSCA DE IMAGENS DE PRODUTOS
 * ============================================================
 *
 * Estratégia:
 *
 * 1. Busca por EAN (mais precisa)
 * 2. Busca por nome + fabricante
 * 3. Google Custom Search, quando configurado
 * 4. Firecrawl, quando configurado
 * 5. DuckDuckGo HTML como fallback sem API
 *
 * O sistema nunca depende exclusivamente de uma API.
 */

import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 50;
const LIMITE_POR_FONTE = 12;
const TIMEOUT_MS = 12000;

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
  {
    id: "drogasil",
    nome: "Drogasil",
    dominio: "drogasil.com.br",
  },
  {
    id: "drogaria_sao_paulo",
    nome: "Drogaria São Paulo",
    dominio: "drogariasaopaulo.com.br",
  },
  {
    id: "panvel",
    nome: "Panvel",
    dominio: "panvel.com",
  },
] as const;

type Site = (typeof SITES)[number];

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

function normalizarEan(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

function removerDuplicados(candidatos: Candidato[]): Candidato[] {
  const vistos = new Set<string>();

  return candidatos.filter((candidato) => {
    const chave = (candidato.imageUrl ?? "").trim().split("?")[0]?.toLowerCase();

    if (!chave || vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);

    return true;
  });
}

function limitar(candidatos: Candidato[], limite = LIMITE_IMAGENS): Candidato[] {
  return removerDuplicados(candidatos).slice(0, limite);
}

function criarAbortController(timeout = TIMEOUT_MS) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  return {
    signal: controller.signal,
    limpar: () => clearTimeout(timer),
  };
}

async function fetchComTimeout(url: string, options: RequestInit = {}, timeout = TIMEOUT_MS): Promise<Response> {
  const controller = criarAbortController(timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    controller.limpar();
  }
}

function googleDisponivel(): boolean {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

function firecrawlDisponivel(): boolean {
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
 * ============================================================
 * CONSULTAS
 * ============================================================
 */

function consultasEan(ean: string): string[] {
  const codigo = normalizarEan(ean);

  if (!codigo) {
    return [];
  }

  return [`"${codigo}"`, codigo];
}

function consultasProduto(
  produto: ProdutoRef & {
    descricao?: string | null;
  },
): string[] {
  const nome = limpar(produto.nome);
  const fabricante = limpar(produto.fabricante);
  const descricao = limpar(produto.descricao);

  const consultas: string[] = [];

  if (nome && fabricante) {
    consultas.push(`${nome} ${fabricante}`);
  }

  if (nome) {
    consultas.push(nome);
  }

  if (nome && descricao) {
    const descricaoCurta = descricao.split(" ").slice(0, 8).join(" ");

    if (descricaoCurta) {
      consultas.push(`${nome} ${descricaoCurta}`);
    }
  }

  return [...new Set(consultas.map((consulta) => limpar(consulta)).filter(Boolean))].slice(0, 3);
}

/**
 * ============================================================
 * EXTRAÇÃO DE URLS DE IMAGENS
 * ============================================================
 */

function decodificarHtml(valor: string): string {
  return valor
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&quot;/gi, '"');
}

function extrairUrlsDeHtml(html: string): string[] {
  const urls = new Set<string>();

  const regexes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,

    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi,

    /["']image["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi,

    /["']image_url["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi,

    /https?:\\\/\\\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi,

    /https?:\/\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi,
  ];

  for (const regex of regexes) {
    for (const match of html.matchAll(regex)) {
      const valor = match[1] ?? match[0];

      if (!valor) {
        continue;
      }

      const url = decodificarHtml(valor.replace(/\\\//g, "/").replace(/^["']|["']$/g, ""));

      if (/^https?:\/\//i.test(url)) {
        urls.add(url);
      }
    }
  }

  return [...urls];
}

function extrairTitulo(html: string): string | undefined {
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  if (ogTitle?.[1]) {
    return decodificarHtml(ogTitle[1]).trim();
  }

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  if (title?.[1]) {
    return decodificarHtml(title[1]).trim();
  }

  return undefined;
}

function urlPertenceAoSite(url: string, site: Site): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    const dominio = site.dominio.toLowerCase().replace(/^www\./, "");

    return hostname === dominio || hostname.endsWith(`.${dominio}`);
  } catch {
    return false;
  }
}

/**
 * ============================================================
 * GOOGLE CUSTOM SEARCH
 * ============================================================
 */

async function buscarGoogle(termo: string, site?: Site, ean?: string): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"];
  const cx = process.env["GOOGLE_CSE_CX"];

  if (!key || !cx || !limpar(termo)) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      key,
      cx,
      q: limpar(termo),
      searchType: "image",
      num: "10",
      safe: "active",
    });

    if (site) {
      params.set("siteSearch", site.dominio);
      params.set("siteSearchFilter", "i");
    }

    const resposta = await fetchComTimeout(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);

    if (!resposta.ok) {
      return [];
    }

    const dados = await resposta.json();

    const candidatos: Candidato[] = [];

    for (const item of Array.isArray(dados?.items) ? dados.items : []) {
      const imageUrl = item?.link;
      const sourceUrl = item?.image?.contextLink;

      if (typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) {
        continue;
      }

      if (site && sourceUrl && !urlPertenceAoSite(sourceUrl, site)) {
        continue;
      }

      candidatos.push({
        imageUrl,
        source: site?.id ?? "google",
        sourceUrl,
        ...(ean ? { ean } : {}),
        nome: item?.title || undefined,
        licenca: site
          ? `Imagem encontrada em ${site.nome}. Verifique os direitos de uso antes da publicação.`
          : "Imagem localizada através de busca pública. Verifique os direitos de uso antes da publicação.",
      });
    }

    return limitar(candidatos, LIMITE_POR_FONTE);
  } catch (erro) {
    console.error("[imagens] Google Search:", erro);

    return [];
  }
}

/**
 * ============================================================
 * FIRECRAWL
 * ============================================================
 */

async function buscarFirecrawl(termo: string, site?: Site, ean?: string): Promise<Candidato[]> {
  const chave = process.env["FIRECRAWL_API_KEY"];

  if (!chave || !limpar(termo)) {
    return [];
  }

  const gateway = chave.startsWith("lovc_");

  const endpoint = gateway
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
    const consulta = site ? `${limpar(termo)} site:${site.dominio}` : limpar(termo);

    const resposta = await fetchComTimeout(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: consulta,
        limit: 5,
        lang: "pt",
        country: "br",
        scrapeOptions: {
          formats: ["html"],
        },
      }),
    });

    if (!resposta.ok) {
      console.error(`[imagens] Firecrawl falhou (${resposta.status})`);

      return [];
    }

    const dados = await resposta.json();

    const itens = Array.isArray(dados?.data) ? dados.data : Array.isArray(dados?.data?.web) ? dados.data.web : [];

    const candidatos: Candidato[] = [];

    for (const item of itens) {
      const sourceUrl = typeof item?.url === "string" ? item.url : undefined;

      if (!sourceUrl) {
        continue;
      }

      if (site && !urlPertenceAoSite(sourceUrl, site)) {
        continue;
      }

      const html = String(item?.html ?? item?.rawHtml ?? item?.content ?? "");

      const imagens = new Set<string>();

      const metadata = item?.metadata ?? {};

      for (const chaveMeta of ["og:image", "ogImage", "twitter:image", "image"]) {
        const valor = metadata[chaveMeta];

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

      for (const imagem of extrairUrlsDeHtml(html)) {
        imagens.add(imagem);
      }

      for (const imageUrl of imagens) {
        if (!/^https?:\/\//i.test(imageUrl)) {
          continue;
        }

        candidatos.push({
          imageUrl,
          source: site?.id ?? "firecrawl",
          sourceUrl,
          ...(ean ? { ean } : {}),
          nome: item?.title || extrairTitulo(html) || undefined,
          licenca: site
            ? `Imagem encontrada em ${site.nome}. Verifique os direitos de uso antes da publicação.`
            : "Imagem encontrada através de busca pública. Verifique os direitos de uso antes da publicação.",
        });
      }
    }

    return limitar(candidatos, LIMITE_POR_FONTE);
  } catch (erro) {
    console.error("[imagens] Firecrawl:", erro);

    return [];
  }
}

/**
 * ============================================================
 * DUCKDUCKGO HTML
 * ============================================================
 *
 * Fallback sem chave de API.
 *
 * Primeiro encontra páginas de produto e depois tenta extrair
 * og:image, twitter:image e imagens do HTML.
 */

async function buscarDuckDuckGoLinks(termo: string, site?: Site): Promise<string[]> {
  const consulta = site ? `${limpar(termo)} site:${site.dominio}` : limpar(termo);

  if (!consulta) {
    return [];
  }

  try {
    const url =
      "https://html.duckduckgo.com/html/?" +
      new URLSearchParams({
        q: consulta,
        kl: "br-pt",
      }).toString();

    const resposta = await fetchComTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!resposta.ok) {
      return [];
    }

    const html = await resposta.text();

    const links = new Set<string>();

    const regex = /class="result__a"[^>]*href="([^"]+)"/gi;

    for (const match of html.matchAll(regex)) {
      const href = decodificarHtml(match[1] ?? "");

      if (!href) {
        continue;
      }

      let destino = href;

      try {
        if (href.startsWith("//duckduckgo.com/l/?")) {
          const urlDuck = new URL(`https:${href}`);

          const uddg = urlDuck.searchParams.get("uddg");

          if (uddg) {
            destino = decodeURIComponent(uddg);
          }
        } else if (href.startsWith("/l/?")) {
          const urlDuck = new URL(href, "https://duckduckgo.com");

          const uddg = urlDuck.searchParams.get("uddg");

          if (uddg) {
            destino = decodeURIComponent(uddg);
          }
        }
      } catch {}

      if (!/^https?:\/\//i.test(destino)) {
        continue;
      }

      if (site && !urlPertenceAoSite(destino, site)) {
        continue;
      }

      links.add(destino);

      if (links.size >= 6) {
        break;
      }
    }

    return [...links];
  } catch (erro) {
    console.error("[imagens] DuckDuckGo links:", erro);

    return [];
  }
}

async function extrairImagemDaPagina(sourceUrl: string, source: string, ean?: string): Promise<Candidato[]> {
  try {
    const resposta = await fetchComTimeout(
      sourceUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      10000,
    );

    if (!resposta.ok) {
      return [];
    }

    const html = await resposta.text();

    const titulo = extrairTitulo(html);

    const imagens = extrairUrlsDeHtml(html);

    const candidatos: Candidato[] = [];

    for (const imageUrl of imagens.slice(0, 15)) {
      candidatos.push({
        imageUrl,
        source,
        sourceUrl,
        ...(ean ? { ean } : {}),
        nome: titulo,
        licenca: "Imagem encontrada em página pública. Verifique os direitos de uso antes da publicação.",
      });
    }

    return limitar(candidatos, 8);
  } catch {
    return [];
  }
}

async function buscarDuckDuckGo(termo: string, site?: Site, ean?: string): Promise<Candidato[]> {
  const links = await buscarDuckDuckGoLinks(termo, site);

  if (!links.length) {
    return [];
  }

  const resultados = await Promise.allSettled(
    links.map((link) => extrairImagemDaPagina(link, site?.id ?? "duckduckgo", ean)),
  );

  const candidatos = resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : []));

  return limitar(candidatos, LIMITE_POR_FONTE);
}

/**
 * ============================================================
 * BUSCA EM UMA FONTE
 * ============================================================
 */

async function buscarNoSite(termo: string, site: Site, ean?: string): Promise<Candidato[]> {
  const tarefas: Promise<Candidato[]>[] = [];

  if (googleDisponivel()) {
    tarefas.push(buscarGoogle(termo, site, ean));
  }

  if (firecrawlDisponivel()) {
    tarefas.push(buscarFirecrawl(termo, site, ean));
  }

  /**
   * Sempre existe fallback.
   */
  tarefas.push(buscarDuckDuckGo(termo, site, ean));

  const resultados = await Promise.allSettled(tarefas);

  return limitar(
    resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : [])),
    LIMITE_POR_FONTE,
  );
}

async function buscarConsultasParalelas(consultas: string[], site: Site, ean?: string): Promise<Candidato[]> {
  const consultasLimitadas = consultas.slice(0, 2);

  const resultados = await Promise.allSettled(consultasLimitadas.map((consulta) => buscarNoSite(consulta, site, ean)));

  return limitar(
    resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : [])),
    LIMITE_POR_FONTE,
  );
}

/**
 * ============================================================
 * PROVIDERS
 * ============================================================
 */

function criarProvider(site: Site): ImageProvider {
  return {
    ...site,

    disponivel: () => true,

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
  /**
   * Agora os providers continuam ativos mesmo sem
   * GOOGLE_CSE_KEY ou FIRECRAWL_API_KEY.
   */
  return PROVIDERS.filter((provider) => provider.disponivel());
}

/**
 * ============================================================
 * BUSCA PRINCIPAL
 * ============================================================
 */

export async function buscarAte50Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
    descricao?: string | null;
  },
): Promise<Candidato[]> {
  const providers = providersAtivos();

  const ean = normalizarEan(produto.codigo_barras);

  const candidatos: Candidato[] = [];

  /**
   * PRIMEIRA ETAPA
   *
   * Busca por EAN nos sites.
   */
  if (ean) {
    const resultadosEan = await Promise.allSettled(providers.map((provider) => provider.buscarPorEan(ean)));

    candidatos.push(...resultadosEan.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : [])));

    /**
     * Se encontramos candidatos suficientes pelo EAN,
     * não precisamos disparar dezenas de buscas extras.
     */
    if (removerDuplicados(candidatos).length >= 8) {
      return limitar(candidatos);
    }
  }

  /**
   * SEGUNDA ETAPA
   *
   * Busca por nome e fabricante.
   *
   * Divide os providers em grupos para evitar uma
   * explosão de requisições simultâneas.
   */
  const grupos = [providers.slice(0, 3), providers.slice(3)];

  for (const grupo of grupos) {
    if (!grupo.length) {
      continue;
    }

    const resultados = await Promise.allSettled(grupo.map((provider) => provider.buscarPorNome(produto)));

    candidatos.push(...resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : [])));

    if (removerDuplicados(candidatos).length >= LIMITE_IMAGENS) {
      break;
    }
  }

  /**
   * ÚLTIMO FALLBACK
   *
   * Busca geral sem limitar a um site específico.
   */
  if (removerDuplicados(candidatos).length < 5) {
    const consultas = consultasProduto(produto);

    const resultados = await Promise.allSettled(
      consultas.slice(0, 2).map(async (consulta) => {
        const tarefas: Promise<Candidato[]>[] = [buscarDuckDuckGo(consulta, undefined, ean || undefined)];

        if (googleDisponivel()) {
          tarefas.push(buscarGoogle(consulta, undefined, ean || undefined));
        }

        if (firecrawlDisponivel()) {
          tarefas.push(buscarFirecrawl(consulta, undefined, ean || undefined));
        }

        const resposta = await Promise.allSettled(tarefas);

        return resposta.flatMap((item) => (item.status === "fulfilled" ? item.value : []));
      }),
    );

    candidatos.push(...resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : [])));
  }

  return limitar(candidatos);
}

export async function buscarAte20Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;
    descricao?: string | null;
  },
): Promise<Candidato[]> {
  const resultados = await buscarAte50Imagens(produto);

  return resultados.slice(0, 20);
}
