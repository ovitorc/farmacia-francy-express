/** Busca de imagens exclusivamente em Pague Menos, Farmácia Permanente e Droga Raia. */
import type { Candidato, ProdutoRef } from "./matching";

const LIMITE_IMAGENS = 20;
const LIMITE_GOOGLE_POR_BUSCA = 10;

const SITES = [
  { id: "pague_menos", nome: "Pague Menos", dominio: "paguemenos.com.br" },
  { id: "farmacia_permanente", nome: "Farmácia Permanente", dominio: "farmaciapermanente.com.br" },
  { id: "droga_raia", nome: "Droga Raia", dominio: "drogaraia.com.br" },
] as const;

export type ImageProvider = {
  id: string;
  nome: string;
  dominio: string;
  disponivel: () => boolean;
  licencaSegura: boolean;
  buscarPorEan: (ean: string) => Promise<Candidato[]>;
  buscarPorNome: (produto: ProdutoRef & { descricao?: string | null }) => Promise<Candidato[]>;
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
function googleDisponivel() {
  return Boolean(process.env["GOOGLE_CSE_KEY"] && process.env["GOOGLE_CSE_CX"]);
}

async function buscarGoogle(termo: string, site: (typeof SITES)[number], ean?: string): Promise<Candidato[]> {
  const key = process.env["GOOGLE_CSE_KEY"],
    cx = process.env["GOOGLE_CSE_CX"];
  if (!key || !cx || !limpar(termo)) return [];
  const todos: Candidato[] = [];
  for (const start of [1, 11]) {
    const q = new URLSearchParams({
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
    try {
      const r = await fetch(`https://www.googleapis.com/customsearch/v1?${q}`);
      if (!r.ok) continue;
      const d = await r.json();
      for (const item of Array.isArray(d?.items) ? d.items : []) {
        const imageUrl = item?.link;
        const sourceUrl = item?.image?.contextLink;
        if (typeof imageUrl !== "string" || !/^https?:\/\//i.test(imageUrl)) continue;
        if (sourceUrl && !String(sourceUrl).toLowerCase().includes(site.dominio.replace("www.", ""))) continue;
        todos.push({
          imageUrl,
          source: site.id,
          sourceUrl,
          ean,
          nome: item?.title || undefined,
          fabricante: undefined,
          licenca: `Imagem localizada em ${site.nome}; verificar direitos de uso antes da publicação.`,
        });
      }
    } catch {}
  }
  return removerDuplicados(todos).slice(0, LIMITE_IMAGENS);
}

function consultasEan(ean: string) {
  const c = normalizarEan(ean);
  return c ? [c, `EAN ${c}`, `${c} produto`] : [];
}
function consultasProduto(p: ProdutoRef & { descricao?: string | null }) {
  const nome = limpar(p.nome),
    fab = limpar(p.fabricante),
    desc = limpar(p.descricao);
  const r: string[] = [];
  if (nome) r.push(nome);
  if (nome && fab) r.push(`${nome} ${fab}`);
  if (nome && desc) r.push(`${nome} ${desc.split(" ").slice(0, 12).join(" ")}`);
  if (desc) r.push(desc.split(" ").slice(0, 15).join(" "));
  return [...new Set(r.filter(Boolean))];
}

function criarProvider(site: (typeof SITES)[number]): ImageProvider {
  return {
    ...site,
    disponivel: googleDisponivel,
    licencaSegura: false,
    buscarPorEan: async (ean) => {
      const r: Candidato[] = [];
      for (const q of consultasEan(ean)) {
        r.push(...(await buscarGoogle(q, site, normalizarEan(ean))));
        if (removerDuplicados(r).length >= LIMITE_IMAGENS) break;
      }
      return removerDuplicados(r).slice(0, LIMITE_IMAGENS);
    },
    buscarPorNome: async (produto) => {
      const r: Candidato[] = [];
      for (const q of consultasProduto(produto)) {
        r.push(...(await buscarGoogle(q, site)));
        if (removerDuplicados(r).length >= LIMITE_IMAGENS) break;
      }
      return removerDuplicados(r).slice(0, LIMITE_IMAGENS);
    },
  };
}

export const PROVIDERS: ImageProvider[] = SITES.map(criarProvider);
export function providersAtivos(): ImageProvider[] {
  return PROVIDERS.filter((p) => p.disponivel());
}

export async function buscarAte20Imagens(
  produto: ProdutoRef & { codigo_barras?: string | null; descricao?: string | null },
): Promise<Candidato[]> {
  const resultado: Candidato[] = [];
  const providers = providersAtivos();
  const ean = normalizarEan(produto.codigo_barras);
  if (ean)
    for (const p of providers) {
      try {
        resultado.push(...(await p.buscarPorEan(ean)));
      } catch {}
    }
  if (removerDuplicados(resultado).length === 0)
    for (const p of providers) {
      try {
        resultado.push(...(await p.buscarPorNome(produto)));
      } catch {}
    }
  return removerDuplicados(resultado).slice(0, LIMITE_IMAGENS);
}
