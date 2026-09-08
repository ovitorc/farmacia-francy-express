/**
 * ============================================================
 * BUSCA DE IMAGENS DE PRODUTOS
 * ============================================================
 *
 * GOOGLE E FIRECRAWL NÃO SÃO UTILIZADOS.
 *
 * A busca funciona exclusivamente com:
 *
 * - Pague Menos
 * - Farmácia Permanente
 * - Droga Raia
 *
 * Estratégia:
 *
 * 1. Pesquisa o produto por EAN.
 * 2. Se necessário, pesquisa pelo nome.
 * 3. Localiza páginas públicas dos sites.
 * 4. Acessa diretamente as páginas encontradas.
 * 5. Extrai imagens através de:
 *
 *    - og:image
 *    - twitter:image
 *    - JSON-LD
 *    - __NEXT_DATA__
 *    - JSON embutido
 *    - image
 *    - imageUrl
 *    - contentUrl
 *    - URLs de CDN
 *
 * Não utiliza:
 *
 * - Google Custom Search
 * - Google API
 * - Firecrawl
 * - API Key
 *
 * ============================================================
 */

import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 50;

const LIMITE_RESULTADOS_SITE = 8;

const LIMITE_IMAGENS_POR_PAGINA = 10;

const TIMEOUT_BUSCA = 15000;

const SITES = [
  {
    id: "pague_menos",
    nome: "Pague Menos",
    dominio: "paguemenos.com.br",
    urlsBusca: ["https://www.paguemenos.com.br/busca?q={TERMO}", "https://www.paguemenos.com.br/search?q={TERMO}"],
  },

  {
    id: "farmacia_permanente",
    nome: "Farmácia Permanente",
    dominio: "farmaciapermanente.com.br",
    urlsBusca: [
      "https://www.farmaciapermanente.com.br/busca?q={TERMO}",
      "https://www.farmaciapermanente.com.br/search?q={TERMO}",
    ],
  },

  {
    id: "droga_raia",
    nome: "Droga Raia",
    dominio: "drogaraia.com.br",
    urlsBusca: ["https://www.drogaraia.com.br/search?q={TERMO}", "https://www.drogaraia.com.br/busca?q={TERMO}"],
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

/**
 * ============================================================
 * UTILITÁRIOS
 * ============================================================
 */

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

    if (!chave) {
      return false;
    }

    if (vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);

    return true;
  });
}

function limitar(candidatos: Candidato[], limite = LIMITE_IMAGENS): Candidato[] {
  return removerDuplicados(candidatos).slice(0, limite);
}

function decodificarHtml(valor: string): string {
  return valor
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
}

function urlValida(url: string | undefined | null): url is string {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function pertenceAoSite(url: string, site: Site): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");

    const dominio = site.dominio.toLowerCase().replace(/^www\./, "");

    return hostname === dominio || hostname.endsWith(`.${dominio}`);
  } catch {
    return false;
  }
}

function criarController(timeout = TIMEOUT_BUSCA) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);

  return {
    signal: controller.signal,

    cancelar() {
      clearTimeout(timer);
    },
  };
}

function headersNavegador(): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",

    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",

    "Accept-Encoding": "gzip, deflate, br",

    Connection: "keep-alive",

    "Upgrade-Insecure-Requests": "1",
  };
}

async function fetchComTimeout(url: string, options: RequestInit = {}, timeout = TIMEOUT_BUSCA): Promise<Response> {
  const controller = criarController(timeout);

  try {
    return await fetch(url, {
      ...options,

      headers: {
        ...headersNavegador(),
        ...(options.headers ?? {}),
      },

      signal: controller.signal,

      redirect: "follow",
    });
  } finally {
    controller.cancelar();
  }
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

  return [codigo, `"${codigo}"`, `EAN ${codigo}`];
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
    const descricaoCurta = descricao.split(" ").slice(0, 10).join(" ");

    if (descricaoCurta) {
      consultas.push(`${nome} ${descricaoCurta}`);
    }
  }

  if (descricao) {
    consultas.push(descricao.split(" ").slice(0, 12).join(" "));
  }

  return [...new Set(consultas.map((consulta) => limpar(consulta)).filter(Boolean))].slice(0, 4);
}

/**
 * ============================================================
 * EXTRAÇÃO DE TÍTULO
 * ============================================================
 */

function extrairTitulo(html: string): string | undefined {
  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);

  if (ogTitle?.[1]) {
    return decodificarHtml(ogTitle[1]);
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  if (title?.[1]) {
    return decodificarHtml(title[1].replace(/<[^>]+>/g, "").trim());
  }

  return undefined;
}

/**
 * ============================================================
 * CONVERSÃO DE URL RELATIVA
 * ============================================================
 */

function resolverUrl(valor: string, baseUrl: string): string | null {
  const url = decodificarHtml(valor).replace(/^["']/, "").replace(/["']$/, "").trim();

  if (!url) {
    return null;
  }

  if (url.startsWith("data:") || url.startsWith("javascript:")) {
    return null;
  }

  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * ============================================================
 * EXTRAÇÃO OG IMAGE
 * ============================================================
 */

function extrairOgImages(html: string, baseUrl: string): string[] {
  const imagens = new Set<string>();

  const regexes = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,

    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/gi,

    /<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,

    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']twitter:image["']/gi,
  ];

  for (const regex of regexes) {
    for (const match of html.matchAll(regex)) {
      const valor = match[1];

      if (!valor) {
        continue;
      }

      const url = resolverUrl(valor, baseUrl);

      if (urlValida(url)) {
        imagens.add(url);
      }
    }
  }

  return [...imagens];
}

/**
 * ============================================================
 * EXTRAÇÃO DE JSON-LD
 * ============================================================
 */

function extrairImagensJsonLd(html: string, baseUrl: string): string[] {
  const imagens = new Set<string>();

  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(regex)) {
    const texto = match[1]?.trim();

    if (!texto) {
      continue;
    }

    try {
      const dados = JSON.parse(texto);

      percorrerJsonPorImagem(dados, baseUrl, imagens);
    } catch {
      /**
       * Alguns sites possuem JSON-LD parcialmente
       * inválido. Ignoramos sem interromper a busca.
       */
    }
  }

  return [...imagens];
}

/**
 * ============================================================
 * PERCORRE JSON
 * ============================================================
 */

function percorrerJsonPorImagem(valor: unknown, baseUrl: string, imagens: Set<string>): void {
  if (!valor) {
    return;
  }

  if (typeof valor === "string") {
    const url = resolverUrl(valor, baseUrl);

    if (urlValida(url) && pareceImagem(url)) {
      imagens.add(url);
    }

    return;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) {
      percorrerJsonPorImagem(item, baseUrl, imagens);
    }

    return;
  }

  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;

    const camposImagem = [
      "image",
      "images",
      "imageUrl",
      "image_url",
      "contentUrl",
      "thumbnailUrl",
      "thumbnail",
      "src",
      "url",
    ];

    for (const campo of camposImagem) {
      if (campo in objeto && objeto[campo]) {
        percorrerJsonPorImagem(objeto[campo], baseUrl, imagens);
      }
    }

    for (const [chave, item] of Object.entries(objeto)) {
      if (camposImagem.includes(chave)) {
        continue;
      }

      if (chave === "description" || chave === "name" || chave === "title" || chave === "sku" || chave === "id") {
        continue;
      }

      percorrerJsonPorImagem(item, baseUrl, imagens);
    }
  }
}

/**
 * ============================================================
 * IDENTIFICA URL DE IMAGEM
 * ============================================================
 */

function pareceImagem(url: string): boolean {
  const valor = url.toLowerCase();

  return (
    /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(valor) ||
    valor.includes("image") ||
    valor.includes("imagem") ||
    valor.includes("media") ||
    valor.includes("cdn") ||
    valor.includes("cloudinary")
  );
}

/**
 * ============================================================
 * EXTRAÇÃO DE IMAGENS DO HTML
 * ============================================================
 */

function extrairImagensHtml(html: string, baseUrl: string): string[] {
  const imagens = new Set<string>();

  const atributos = [
    "src",
    "data-src",
    "data-original",
    "data-lazy",
    "data-image",
    "data-image-url",
    "data-zoom-image",
  ];

  for (const atributo of atributos) {
    const regex = new RegExp(`${atributo}=["']([^"']+)["']`, "gi");

    for (const match of html.matchAll(regex)) {
      const valor = match[1];

      if (!valor) {
        continue;
      }

      const url = resolverUrl(valor, baseUrl);

      if (urlValida(url) && pareceImagem(url)) {
        imagens.add(url);
      }
    }
  }

  /**
   * srcset
   */
  for (const match of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    const srcset = match[1];

    if (!srcset) {
      continue;
    }

    const partes = srcset.split(",");

    for (const parte of partes) {
      const valor = parte.trim().split(/\s+/)[0];

      if (!valor) {
        continue;
      }

      const url = resolverUrl(valor, baseUrl);

      if (urlValida(url) && pareceImagem(url)) {
        imagens.add(url);
      }
    }
  }

  return [...imagens];
}

/**
 * ============================================================
 * EXTRAÇÃO DE URLs DIRETAMENTE DO HTML
 * ============================================================
 */

function extrairUrlsDiretas(html: string, baseUrl: string): string[] {
  const imagens = new Set<string>();

  const regexes = [
    /https?:\\?\/\\?\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^"'\\\s<>]*)?/gi,

    /https?:\/\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^"'\s<>]*)?/gi,

    /["'](?:imageUrl|image_url|contentUrl|thumbnailUrl|image)["']\s*:\s*["']([^"']+)["']/gi,
  ];

  for (const regex of regexes) {
    for (const match of html.matchAll(regex)) {
      const valor = match[1] ?? match[0];

      if (!valor) {
        continue;
      }

      const url = resolverUrl(valor, baseUrl);

      if (urlValida(url) && pareceImagem(url)) {
        imagens.add(url);
      }
    }
  }

  return [...imagens];
}

/**
 * ============================================================
 * FILTRAGEM DE IMAGENS
 * ============================================================
 */

function filtrarImagensProduto(imagens: string[]): string[] {
  const bloqueadas = [
    "logo",
    "icon",
    "favicon",
    "sprite",
    "banner",
    "header",
    "footer",
    "facebook",
    "instagram",
    "whatsapp",
    "youtube",
    "google",
  ];

  const validas = imagens.filter((imagem) => {
    const valor = imagem.toLowerCase();

    if (bloqueadas.some((palavra) => valor.includes(palavra))) {
      return false;
    }

    return true;
  });

  /**
   * Se o filtro foi agressivo demais,
   * devolvemos as imagens originais.
   */
  if (!validas.length) {
    return imagens;
  }

  return validas;
}

/**
 * ============================================================
 * EXTRAIR TODAS AS IMAGENS DE UMA PÁGINA
 * ============================================================
 */

function extrairImagensPagina(html: string, baseUrl: string): string[] {
  const imagens = new Set<string>();

  const fontes = [
    extrairOgImages(html, baseUrl),

    extrairImagensJsonLd(html, baseUrl),

    extrairImagensHtml(html, baseUrl),

    extrairUrlsDiretas(html, baseUrl),
  ];

  for (const fonte of fontes) {
    for (const imagem of fonte) {
      if (urlValida(imagem)) {
        imagens.add(imagem);
      }
    }
  }

  return filtrarImagensProduto([...imagens]).slice(0, LIMITE_IMAGENS_POR_PAGINA);
}

/**
 * ============================================================
 * ENCONTRAR LINKS DE PRODUTO
 * ============================================================
 */

function extrairLinks(html: string, baseUrl: string, site: Site): string[] {
  const links = new Set<string>();

  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(regex)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    const url = resolverUrl(href, baseUrl);

    if (!urlValida(url)) {
      continue;
    }

    if (!pertenceAoSite(url, site)) {
      continue;
    }

    const valor = url.toLowerCase();

    /**
     * Ignora páginas sem relação com produto.
     */
    if (
      valor.includes("/login") ||
      valor.includes("/account") ||
      valor.includes("/carrinho") ||
      valor.includes("/cart") ||
      valor.includes("/institucional") ||
      valor.includes("/blog")
    ) {
      continue;
    }

    links.add(url);

    if (links.size >= LIMITE_RESULTADOS_SITE) {
      break;
    }
  }

  return [...links];
}

/**
 * ============================================================
 * BUSCA DIRETA NO SITE
 * ============================================================
 */

async function buscarLinksNoSite(termo: string, site: Site): Promise<string[]> {
  const termoLimpo = limpar(termo);

  if (!termoLimpo) {
    return [];
  }

  const resultados = new Set<string>();

  const buscas = site.urlsBusca.map(async (modelo) => {
    const url = modelo.replace("{TERMO}", encodeURIComponent(termoLimpo));

    try {
      const resposta = await fetchComTimeout(url, {
        headers: {
          Referer: `https://www.${site.dominio}/`,
        },
      });

      if (!resposta.ok) {
        console.warn(`[imagens] ${site.nome}: busca retornou ${resposta.status}`);

        return;
      }

      const html = await resposta.text();

      const links = extrairLinks(html, url, site);

      for (const link of links) {
        resultados.add(link);
      }
    } catch (erro) {
      console.error(`[imagens] Erro na busca ${site.nome}:`, erro);
    }
  });

  await Promise.allSettled(buscas);

  return [...resultados].slice(0, LIMITE_RESULTADOS_SITE);
}

/**
 * ============================================================
 * EXTRAIR IMAGENS DA PÁGINA DO PRODUTO
 * ============================================================
 */

async function buscarImagensDaPagina(sourceUrl: string, site: Site, ean?: string): Promise<Candidato[]> {
  try {
    const resposta = await fetchComTimeout(sourceUrl, {
      headers: {
        Referer: `https://www.${site.dominio}/`,
      },
    });

    if (!resposta.ok) {
      console.warn(`[imagens] ${site.nome}: página retornou ${resposta.status}`);

      return [];
    }

    const html = await resposta.text();

    const titulo = extrairTitulo(html);

    const imagens = extrairImagensPagina(html, sourceUrl);

    const candidatos: Candidato[] = [];

    for (const imageUrl of imagens) {
      candidatos.push({
        imageUrl,

        source: site.id,

        sourceUrl,

        ...(ean
          ? {
              ean,
            }
          : {}),

        nome: titulo,

        licenca: `Imagem encontrada diretamente em ${site.nome}. Verifique os direitos de uso antes da publicação.`,
      });
    }

    return limitar(candidatos, LIMITE_IMAGENS_POR_PAGINA);
  } catch (erro) {
    console.error(`[imagens] Erro ao acessar página ${site.nome}:`, erro);

    return [];
  }
}

/**
 * ============================================================
 * BUSCA COMPLETA EM UM SITE
 * ============================================================
 */

async function buscarNoSite(termo: string, site: Site, ean?: string): Promise<Candidato[]> {
  const termoLimpo = limpar(termo);

  if (!termoLimpo) {
    return [];
  }

  console.log(`[imagens] Pesquisando "${termoLimpo}" em ${site.nome}`);

  const links = await buscarLinksNoSite(termoLimpo, site);

  /**
   * Alguns sites podem colocar imagens diretamente
   * na página de resultados.
   *
   * Por isso tentamos acessar os links encontrados
   * simultaneamente.
   */
  if (!links.length) {
    console.warn(`[imagens] Nenhuma página encontrada em ${site.nome} para "${termoLimpo}"`);

    return [];
  }

  const resultados = await Promise.allSettled(links.map((link) => buscarImagensDaPagina(link, site, ean)));

  const candidatos = resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : []));

  console.log(`[imagens] ${site.nome}: ${candidatos.length} imagem(ns) encontrada(s)`);

  return limitar(candidatos);
}

/**
 * ============================================================
 * BUSCA DE VÁRIAS CONSULTAS
 * ============================================================
 */

async function buscarConsultasParalelas(consultas: string[], site: Site, ean?: string): Promise<Candidato[]> {
  const consultasUnicas = [...new Set(consultas.map((consulta) => limpar(consulta)).filter(Boolean))].slice(0, 3);

  if (!consultasUnicas.length) {
    return [];
  }

  const resultados = await Promise.allSettled(consultasUnicas.map((consulta) => buscarNoSite(consulta, site, ean)));

  const candidatos = resultados.flatMap((resultado) => (resultado.status === "fulfilled" ? resultado.value : []));

  return limitar(candidatos);
}

/**
 * ============================================================
 * PROVIDER
 * ============================================================
 */

function criarProvider(site: Site): ImageProvider {
  return {
    id: site.id,

    nome: site.nome,

    dominio: site.dominio,

    /**
     * Os sites ficam sempre disponíveis.
     *
     * Não dependem mais de Google,
     * Firecrawl ou API Keys.
     */
    disponivel: () => true,

    licencaSegura: false,

    buscarPorEan: async (ean) => {
      const codigo = normalizarEan(ean);

      return buscarConsultasParalelas(consultasEan(codigo), site, codigo);
    },

    buscarPorNome: async (produto) => {
      return buscarConsultasParalelas(consultasProduto(produto), site);
    },
  };
}

/**
 * ============================================================
 * PROVIDERS ATIVOS
 * ============================================================
 */

export const PROVIDERS: ImageProvider[] = SITES.map(criarProvider);

export function providersAtivos(): ImageProvider[] {
  /**
   * Sempre retorna os três sites.
   *
   * Não existe mais dependência de:
   *
   * GOOGLE_CSE_KEY
   * GOOGLE_CSE_CX
   * FIRECRAWL_API_KEY
   * LOVABLE_API_KEY
   */
  return PROVIDERS;
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
   * ==========================================================
   * PRIMEIRA ETAPA
   *
   * BUSCA POR EAN
   * ==========================================================
   */

  if (ean) {
    console.log(`[imagens] Iniciando busca por EAN: ${ean}`);

    const resultadosEan = await Promise.allSettled(providers.map((provider) => provider.buscarPorEan(ean)));

    for (const resultado of resultadosEan) {
      if (resultado.status === "fulfilled") {
        candidatos.push(...resultado.value);
      }
    }

    /**
     * Se já encontramos várias imagens,
     * retornamos rapidamente.
     */
    if (limitar(candidatos).length >= 8) {
      return limitar(candidatos);
    }
  }

  /**
   * ==========================================================
   * SEGUNDA ETAPA
   *
   * BUSCA POR NOME
   * ==========================================================
   */

  console.log(`[imagens] Iniciando busca por nome: ${produto.nome}`);

  const resultadosNome = await Promise.allSettled(providers.map((provider) => provider.buscarPorNome(produto)));

  for (const resultado of resultadosNome) {
    if (resultado.status === "fulfilled") {
      candidatos.push(...resultado.value);
    }
  }

  return limitar(candidatos);
}

/**
 * ============================================================
 * BUSCA ATÉ 20 IMAGENS
 * ============================================================
 */

export async function buscarAte20Imagens(
  produto: ProdutoRef & {
    codigo_barras?: string | null;

    descricao?: string | null;
  },
): Promise<Candidato[]> {
  const resultados = await buscarAte50Imagens(produto);

  return resultados.slice(0, 20);
}
