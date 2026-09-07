/**
 * ============================================================
 * COMPARAÇÃO E PONTUAÇÃO DE CONFIANÇA
 * ============================================================
 *
 * Funções puras (sem rede) usadas tanto no servidor
 * quanto na interface do painel.
 */

export type Candidato = {
  imageUrl: string;
  source: string;
  sourceUrl?: string;
  ean?: string;
  nome?: string;
  fabricante?: string;
  licenca?: string;
};

export type ProdutoRef = {
  nome: string;
  fabricante?: string | null;
  codigo_barras?: string | null;
};

export const PESOS = {
  ean: 60,
  nome: 20,
  fabricante: 10,
  apresentacao: 10,
};

export const LIMITES = {
  aprovarAutomatico: 75,
  revisaoManual: 50,
};

const ACENTOS = /[\u0300-\u036f]/g;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((t) => t.length > 2);
}

export function similaridadeNome(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);

  if (!ta.length || !tb.length) return 0;

  const setB = new Set(tb);
  const iguais = ta.filter((t) => setB.has(t)).length;

  return iguais / Math.max(ta.length, tb.length);
}

/**
 * Extrai a "apresentação" do produto:
 * quantidade (10 comprimidos) e concentração (500mg, 1g, 200ml).
 */
export function apresentacao(texto: string): { quantidade?: number | undefined; dose?: string | undefined } {
  const t = normalizar(texto);

  const dose = t.match(/(\d+[.,]?\d*)\s*(mg|g|ml|l|mcg|ui|%)/);
  const qtd = t.match(/(\d+)\s*(cp|cps|comp|comprimidos?|caps(ulas)?|drageas?|envelopes?|unidades?)\b/);

  return {
    quantidade: qtd ? Number(qtd[1]) : undefined,
    dose: dose ? `${dose[1]!.replace(",", ".")}${dose[2]}` : undefined,
  };
}

export type Avaliacao = {
  confianca: number;
  conflito: boolean;
  motivos: string[];
};

export function avaliarCandidato(produto: ProdutoRef, candidato: Candidato): Avaliacao {
  const motivos: string[] = [];
  let pontos = 0;
  let conflito = false;

  const ean = (produto.codigo_barras ?? "").replace(/\D/g, "");
  const eanCand = (candidato.ean ?? "").replace(/\D/g, "");

  if (ean && eanCand) {
    if (ean === eanCand || ean.replace(/^0+/, "") === eanCand.replace(/^0+/, "")) {
      pontos += PESOS.ean;
      motivos.push("EAN idêntico");
    } else {
      conflito = true;
      motivos.push("EAN diferente");
    }
  } else if (!eanCand) {
    motivos.push("Fonte não informou EAN");
  }

  if (candidato.nome) {
    const sim = similaridadeNome(produto.nome, candidato.nome);
    pontos += Math.round(PESOS.nome * sim);
    motivos.push(`Nome ${Math.round(sim * 100)}% compatível`);

    const a = apresentacao(produto.nome);
    const b = apresentacao(candidato.nome);

    const doseConflita = a.dose && b.dose && a.dose !== b.dose;
    const qtdConflita = a.quantidade && b.quantidade && a.quantidade !== b.quantidade;

    if (doseConflita || qtdConflita) {
      conflito = true;
      motivos.push("Apresentação diferente");
    } else if ((a.dose && b.dose) || (a.quantidade && b.quantidade)) {
      pontos += PESOS.apresentacao;
      motivos.push("Apresentação compatível");
    }
  }

  const fab = normalizar(produto.fabricante ?? "");
  const fabCand = normalizar(candidato.fabricante ?? "");

  if (fab && fabCand) {
    if (fab.includes(fabCand.split(" ")[0]!) || fabCand.includes(fab.split(" ")[0]!)) {
      pontos += PESOS.fabricante;
      motivos.push("Fabricante compatível");
    } else {
      motivos.push("Fabricante divergente");
    }
  }

  return {
    confianca: Math.max(0, Math.min(100, pontos)),
    conflito,
    motivos,
  };
}

export function classificar(av: Avaliacao): "approved" | "manual_review" | "rejeitado" {
  if (av.conflito) return "manual_review";
  if (av.confianca >= LIMITES.aprovarAutomatico) return "approved";
  if (av.confianca >= LIMITES.revisaoManual) return "manual_review";
  return "rejeitado";
}
