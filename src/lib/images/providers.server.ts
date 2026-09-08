/** Busca de candidatos em três fontes, sem priorizar automaticamente a primeira que responder. */
import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_POR_SITE = 10;
const LIMITE_TOTAL = 50;
const TEMPO_LIMITE_MS = 15000;
const PAUSA_ENTRE_ETAPAS_MS = 400;

const SITES = [
  {
    id: "pague_menos",
    nome: "Pague Menos",
    dominio: "paguemenos.com.br",
    base: "https://www.paguemenos.com.br",
    busca: (q: string) => `https://www.paguemenos.com.br/busca?q=${encodeURIComponent(q)}`,
  },
  {
    id: "farmacia_permanente",
    nome: "Farmácia Permanente",
    dominio: "farmaciapermanente.com.br",
    base: "https://www.farmaciapermanente.com.br",
    busca: (q: string) => `https://www.farmaciapermanente.com.br/busca?q=${encodeURIComponent(q)}`,
  },
  {
    id: "droga_raia",
    nome: "Droga Raia",
    dominio: "drogaraia.com.br",
    base: "https://www.drogaraia.com.br",
    busca: (q: string) => `https://www.drogaraia.com.br/search?text=${encodeURIComponent(q)}`,
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
  buscarPorNome: (produto: ProdutoRef & { descricao?: string | null }) => Promise<Candidato[]>;
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const limpar = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
const normalizarEan = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function imagemValida(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  const u = url.toLowerCase();
  return !/\.svg(?:\?|$)/.test(u) && !/(sprite|logo|icon|placeholder|banner|bandeira|selo|favicon)/.test(u);
}

function removerDuplicados(candidatos: Candidato[]) {
  const vistos = new Set<string>();
  return candidatos.filter((c) => {
    const chave = String(c.imageUrl ?? "")
      .split("?")[0]
      .toLowerCase();
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

async function pegar(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(url, { headers: HEADERS, signal: controller.signal, redirect: "follow" });
    if (!resposta.ok) return null;
    return await resposta.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function candidato(site: Site, imageUrl: string, sourceUrl: string, extras: Record<string, unknown> = {}): Candidato {
  return {
    imageUrl,
    source: site.id,
    sourceUrl,
    licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
    ...extras,
  } as Candidato;
}

function extrairUrls(html: string) {
  const urls = new Set<string>();
  const adicionar = (valor?: string) => {
    if (!valor) return;
    const url = valor
      .replace(/\\u002F/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&")
      .trim();
    if (imagemValida(url)) urls.add(url);
  };

  for (const m of html.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  ))
    adicionar(m[1]);
  for (const m of html.matchAll(/"(?:imageUrl|image_url|thumbnailUrl|thumbnail|image)"\s*:\s*"([^"]+)"/gi))
    adicionar(m[1]);
  for (const m of html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)) adicionar(m[1]);
  for (const m of html.matchAll(/https?:\/\/[^"'\\\s]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s]*)?/gi)) adicionar(m[0]);

  return [...urls];
}

async function buscarCatalogoVtex(site: Site, termo: string) {
  const q = encodeURIComponent(limpar(termo));
  if (!q) return [] as Candidato[];
  const url = `${site.base}/api/catalog_system/pub/products/search?ft=${q}&_from=0&_to=19`;
  const texto = await pegar(url);
  if (!texto || !texto.trim().startsWith("[")) return [];
  try {
    const lista = JSON.parse(texto) as any[];
    const saida: Candidato[] = [];
    for (const p of lista) {
      for (const item of Array.isArray(p?.items) ? p.items : []) {
        for (const img of Array.isArray(item?.images) ? item.images : []) {
          if (typeof img?.imageUrl === "string" && imagemValida(img.imageUrl)) {
            saida.push(
              candidato(site, img.imageUrl, p?.link ?? url, {
                nome: p?.productName ?? undefined,
                fabricante: p?.brand ?? undefined,
                ean: normalizarEan(item?.ean) || undefined,
              }),
            );
          }
        }
      }
    }
    return removerDuplicados(saida);
  } catch {
    return [];
  }
}

async function buscarHtml(site: Site, termo: string) {
  const sourceUrl = site.busca(limpar(termo));
  const html = await pegar(sourceUrl);
  if (!html) return [] as Candidato[];
  return extrairUrls(html).map((url) => candidato(site, url, sourceUrl));
}

async function buscarNoSite(site: Site, termo: string, ean?: string) {
  if (!limpar(termo)) return [] as Candidato[];
  const [catalogo, html] = await Promise.all([buscarCatalogoVtex(site, termo), buscarHtml(site, termo)]);
  return removerDuplicados([...catalogo, ...html])
    .map((c) => ({ ...c, ean: (c as any).ean ?? ean }))
    .slice(0, LIMITE_POR_SITE);
}

async function buscarTodosOsSites(termo: string, ean?: string) {
  // Aguarda as três fontes; nenhuma fonte encerra a pesquisa das outras.
  const grupos = await Promise.all(SITES.map((site) => buscarNoSite(site, termo, ean)));
  // Intercala as fontes para evitar que Pague Menos ocupe todos os primeiros resultados.
  const resultado: Candidato[] = [];
  for (let i = 0; resultado.length < LIMITE_TOTAL; i++) {
    let adicionou = false;
    for (const grupo of grupos) {
      if (grupo[i]) {
        resultado.push(grupo[i]);
        adicionou = true;
      }
      if (resultado.length >= LIMITE_TOTAL) break;
    }
    if (!adicionou) break;
  }
  return removerDuplicados(resultado);
}

function termosUnicos(xs: string[]) {
  return [...new Set(xs.map(limpar).filter((x) => x.length >= 3))];
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

export async function buscarAte50Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
): Promise<Candidato[]> {
  const termos: Array<{ termo: string; ean?: string }> = [];
  const ean = normalizarEan(produto.codigo_barras);
  if (ean) termos.push({ termo: ean, ean });

  const nome = limpar(produto.nome);
  const fabricante = limpar(produto.fabricante);
  const descricao = limpar(produto.descricao);
  for (const termo of termosUnicos([
    nome,
    fabricante ? `${nome} ${fabricante}` : "",
    descricao,
    descricao && fabricante ? `${descricao} ${fabricante}` : "",
  ]))
    termos.push({ termo });

  const acumulado: Candidato[] = [];
  for (let i = 0; i < termos.length && acumulado.length < LIMITE_TOTAL; i++) {
    const etapa = termos[i];
    const encontrados = await buscarTodosOsSites(etapa.termo, etapa.ean);
    acumulado.push(...encontrados);
    if (i < termos.length - 1) await sleep(PAUSA_ENTRE_ETAPAS_MS);
  }
  return removerDuplicados(acumulado).slice(0, LIMITE_TOTAL);
}
