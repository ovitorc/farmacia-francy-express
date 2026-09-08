/**
 * Busca de imagens exclusivamente nas páginas públicas de
 * Pague Menos, Farmácia Permanente e Droga Raia.
 * Sem Google, sem Firecrawl e sem qualquer API paga.
 */
import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 24;
const LIMITE_POR_SITE = 8;
const TEMPO_LIMITE_MS = 12000;

const SITES = [
  { id: "pague_menos", nome: "Pague Menos", dominio: "paguemenos.com.br", base: "https://www.paguemenos.com.br" },
  {
    id: "farmacia_permanente",
    nome: "Farmácia Permanente",
    dominio: "farmaciapermanente.com.br",
    base: "https://www.farmaciapermanente.com.br",
  },
  { id: "droga_raia", nome: "Droga Raia", dominio: "drogaraia.com.br", base: "https://www.drogaraia.com.br" },
] as const;

type Site = (typeof SITES)[number];

export type ImageProvider = {
  id: string;
  nome: string;
  dominio: string;
  disponivel: () => boolean;
  licencaSegura: boolean;
  buscarPorEan: (ean: string) => Promise<Candidato[]>;
  buscarPorNome: (produto: ProdutoRef & { descricao?: string | null }) => Promise<Candidato[]>;
};

const CABECALHOS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

function normalizarEan(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "");
}
function limpar(v: string | null | undefined) {
  return (v ?? "").replace(/\s+/g, " ").trim();
}
function removerDuplicados(c: Candidato[]) {
  const vistos = new Set<string>();
  return c.filter((x) => {
    const k = (x.imageUrl ?? "").trim().split("?")[0].toLowerCase();
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

function imagemValida(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  const u = url.toLowerCase();
  if (/\.svg(\?|$)/.test(u)) return false;
  if (/(sprite|logo|icon|placeholder|banner|bandeira|selo)/.test(u)) return false;
  return true;
}

async function pegar(url: string, aceitar: string): Promise<string | null> {
  try {
    const controlador = new AbortController();
    const t = setTimeout(() => controlador.abort(), TEMPO_LIMITE_MS);
    const r = await fetch(url, {
      headers: { ...CABECALHOS, Accept: aceitar },
      signal: controlador.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

function candidato(site: Site, imageUrl: string, sourceUrl?: string, extras?: Partial<Candidato>): Candidato {
  return {
    imageUrl,
    source: site.id,
    sourceUrl: sourceUrl ?? site.base,
    licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
    ...extras,
  } as Candidato;
}

/** Catálogo público VTEX (usado por Pague Menos, Droga Raia e Farmácia Permanente). */
async function buscarCatalogo(site: Site, termo: string): Promise<Candidato[]> {
  const q = encodeURIComponent(limpar(termo));
  if (!q) return [];
  const texto = await pegar(`${site.base}/api/catalog_system/pub/products/search?ft=${q}&_from=0&_to=4`, "application/json");
  if (!texto || !texto.trim().startsWith("[")) return [];
  let lista: any[];
  try {
    lista = JSON.parse(texto);
  } catch {
    return [];
  }
  const achados: Candidato[] = [];
  for (const p of lista) {
    const sourceUrl: string | undefined = p?.link ?? (p?.linkText ? `${site.base}/${p.linkText}/p` : undefined);
    for (const item of Array.isArray(p?.items) ? p.items : []) {
      for (const img of Array.isArray(item?.images) ? item.images : []) {
        const url = img?.imageUrl;
        if (typeof url === "string" && imagemValida(url)) {
          achados.push(
            candidato(site, url, sourceUrl, {
              nome: p?.productName || undefined,
              fabricante: p?.brand || undefined,
              ean: normalizarEan(item?.ean) || undefined,
            }),
          );
        }
      }
    }
  }
  return achados;
}

/** Fallback: página pública de busca em HTML (og:image, JSON-LD, <img> e CDN). */
async function buscarHtml(site: Site, termo: string): Promise<Candidato[]> {
  const q = encodeURIComponent(limpar(termo));
  if (!q) return [];
  const sourceUrl = `${site.base}/${q}?_q=${q}&map=ft`;
  const html = await pegar(sourceUrl, "text/html");
  if (!html) return [];

  const urls = new Set<string>();
  for (const m of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  ))
    urls.add(m[1]);
  for (const m of html.matchAll(/"image"\s*:\s*"(https?:\/\/[^"]+)"/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/"(?:imageUrl|image_url|thumbnail)"\s*:\s*"(https?:\/\/[^"]+)"/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)) urls.add(m[0]);

  const achados: Candidato[] = [];
  for (const url of urls) {
    const limpo = url.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
    if (imagemValida(limpo)) achados.push(candidato(site, limpo, sourceUrl));
  }
  return achados;
}

async function buscarNoSite(site: Site, termo: string, ean?: string): Promise<Candidato[]> {
  if (!limpar(termo)) return [];
  let achados = await buscarCatalogo(site, termo);
  if (achados.length === 0) achados = await buscarHtml(site, termo);
  if (ean) achados = achados.map((c) => ({ ...c, ean: c.ean ?? ean }));
  return removerDuplicados(achados).slice(0, LIMITE_POR_SITE);
}

/** Consulta os três sites simultaneamente. */
async function buscarTodosOsSites(termo: string, ean?: string): Promise<Candidato[]> {
  const resultados = await Promise.allSettled(SITES.map((site) => buscarNoSite(site, termo, ean)));
  return removerDuplicados(resultados.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
}

function criarProvider(site: Site): ImageProvider {
  return {
    id: site.id,
    nome: site.nome,
    dominio: site.dominio,
    disponivel: () => true,
    licencaSegura: false,
    buscarPorEan: async (ean) => buscarNoSite(site, normalizarEan(ean), normalizarEan(ean)),
    buscarPorNome: async (produto) =>
      buscarNoSite(site, [limpar(produto.nome), limpar(produto.fabricante)].filter(Boolean).join(" ")),
  };
}

export const PROVIDERS: ImageProvider[] = SITES.map(criarProvider);
export function providersAtivos(): ImageProvider[] {
  return PROVIDERS;
}

export async function buscarAte50Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
): Promise<Candidato[]> {
  const ean = normalizarEan(produto.codigo_barras);
  const nome = limpar(produto.nome);
  const fabricante = limpar(produto.fabricante);

  // 1) Código de barras tem prioridade — se achar, não gasta mais buscas.
  if (ean) {
    const porEan = await buscarTodosOsSites(ean, ean);
    if (porEan.length > 0) return porEan.slice(0, LIMITE_IMAGENS);
  }

  // 2) Nome do produto.
  if (nome) {
    const porNome = await buscarTodosOsSites(nome);
    if (porNome.length > 0) return porNome.slice(0, LIMITE_IMAGENS);

    // 3) Nome + fabricante.
    if (fabricante) {
      const porNomeFab = await buscarTodosOsSites(`${nome} ${fabricante}`);
      if (porNomeFab.length > 0) return porNomeFab.slice(0, LIMITE_IMAGENS);
    }
  }

  return [];
}

export async function buscarAte20Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
): Promise<Candidato[]> {
  return buscarAte50Imagens(produto);
}
