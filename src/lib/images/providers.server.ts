/** Busca sequencial e cuidadosa de imagens em Pague Menos, Farmácia Permanente e Droga Raia. */
import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 24;
const LIMITE_POR_SITE = 8;
const TEMPO_LIMITE_MS = 12000;
const PAUSA_ENTRE_ETAPAS_MS = 250;
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
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const limpar = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const normalizarEan = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
function removerDuplicados(c: Candidato[]) {
  const s = new Set<string>();
  return c.filter((x) => {
    const k = (x.imageUrl ?? "").trim().split("?")[0].toLowerCase();
    if (!k || s.has(k)) return false;
    s.add(k);
    return true;
  });
}
function imagemValida(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  const u = url.toLowerCase();
  return !/\.svg(\?|$)/.test(u) && !/(sprite|logo|icon|placeholder|banner|bandeira|selo)/.test(u);
}
async function pegar(url: string, aceitar: string) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { headers: { ...HEADERS, Accept: aceitar }, signal: c.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
function candidato(site: Site, imageUrl: string, sourceUrl?: string, extras?: Record<string, unknown>): Candidato {
  return {
    imageUrl,
    source: site.id,
    sourceUrl: sourceUrl ?? site.base,
    licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
    ...extras,
  } as Candidato;
}
async function buscarCatalogo(site: Site, termo: string) {
  const q = encodeURIComponent(limpar(termo));
  if (!q) return [];
  const texto = await pegar(
    `${site.base}/api/catalog_system/pub/products/search?ft=${q}&_from=0&_to=9`,
    "application/json",
  );
  if (!texto || !texto.trim().startsWith("[")) return [];
  let lista: any[];
  try {
    lista = JSON.parse(texto);
  } catch {
    return [];
  }
  const a: Candidato[] = [];
  for (const p of lista)
    for (const item of Array.isArray(p?.items) ? p.items : [])
      for (const img of Array.isArray(item?.images) ? item.images : []) {
        const url = img?.imageUrl;
        if (typeof url === "string" && imagemValida(url))
          a.push(
            candidato(site, url, p?.link ?? (p?.linkText ? `${site.base}/${p.linkText}/p` : undefined), {
              nome: p?.productName || undefined,
              fabricante: p?.brand || undefined,
              ean: normalizarEan(item?.ean) || undefined,
            }),
          );
      }
  return a;
}
async function buscarHtml(site: Site, termo: string) {
  const q = encodeURIComponent(limpar(termo));
  if (!q) return [];
  const sourceUrl = `${site.base}/${q}?_q=${q}&map=ft`;
  const html = await pegar(sourceUrl, "text/html");
  if (!html) return [];
  const urls = new Set<string>();
  for (const m of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  ))
    if (m[1]) urls.add(m[1]);
  for (const m of html.matchAll(
    /"(?:imageUrl|image_url|thumbnail|image)"\s*:\s*"(https?:\/\/[^"\\]+(?:\\.[^"\\]+)*)"/gi,
  ))
    if (m[1]) urls.add(m[1]);
  for (const m of html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)) if (m[1]) urls.add(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/gi)) urls.add(m[0]);
  return [...urls]
    .map((u) => u.replace(/\\u002F/gi, "/").replace(/\\\//g, "/"))
    .filter(imagemValida)
    .map((u) => candidato(site, u, sourceUrl));
}
async function buscarNoSite(site: Site, termo: string, ean?: string) {
  if (!limpar(termo)) return [];
  let a = await buscarCatalogo(site, termo);
  if (a.length === 0) a = await buscarHtml(site, termo);
  if (ean) a = a.map((c) => ({ ...c, ean: c.ean ?? ean }));
  return removerDuplicados(a).slice(0, LIMITE_POR_SITE);
}
async function buscarTodosOsSites(termo: string, ean?: string) {
  const a: Candidato[] = [];
  for (const site of SITES) {
    const r = await buscarNoSite(site, termo, ean);
    a.push(...r);
  }
  return removerDuplicados(a);
}
function termosUnicos(xs: string[]) {
  return [...new Set(xs.map(limpar).filter(Boolean))];
}
export const PROVIDERS: ImageProvider[] = SITES.map((site) => ({
  id: site.id,
  nome: site.nome,
  dominio: site.dominio,
  disponivel: () => true,
  licencaSegura: false,
  buscarPorEan: (ean) => buscarNoSite(site, normalizarEan(ean), normalizarEan(ean)),
  buscarPorNome: (produto) =>
    buscarNoSite(site, [limpar(produto.nome), limpar(produto.fabricante)].filter(Boolean).join(" ")),
}));
export const providersAtivos = () => PROVIDERS;
/** Executa EAN primeiro e somente depois as buscas textuais; nenhuma etapa é cancelada por outra. */
export async function buscarAte50Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
): Promise<Candidato[]> {
  const ean = normalizarEan(produto.codigo_barras),
    nome = limpar(produto.nome),
    fab = limpar(produto.fabricante),
    desc = limpar(produto.descricao);
  const etapas = termosUnicos([
    ean,
    nome,
    nome && fab ? `${nome} ${fab}` : "",
    desc,
    desc && fab ? `${desc} ${fab}` : "",
  ]);
  const todos: Candidato[] = [];
  for (let i = 0; i < etapas.length; i++) {
    const termo = etapas[i]!;
    const r = await buscarTodosOsSites(termo, termo === ean && ean ? ean : undefined);
    todos.push(...r);
    if (i < etapas.length - 1) await sleep(PAUSA_ENTRE_ETAPAS_MS);
  }
  return removerDuplicados(todos).slice(0, LIMITE_IMAGENS);
}
export async function buscarAte20Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
) {
  return buscarAte50Imagens(produto);
}
