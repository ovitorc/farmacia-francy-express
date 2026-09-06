/* ============================================================
   FARMÁCIA POPULAR — REGRAS DE INTERVALO
   ============================================================

   Uso exclusivamente informativo: calcula a previsão da
   próxima retirada a partir da data informada pelo cliente.
   ============================================================ */

export const INTERVALO_PADRAO_MEDICAMENTO = 30;

export const INTERVALO_FRALDAS = 10;

export const LIMITE_FRALDAS = "40 tiras a cada 10 dias";

export type ItemFarmaciaPopular = {
  id: string;
  nome: string;
  principioAtivo: string;
  intervalo: number;
};

/* ============================================================
   CLASSIFICAÇÃO
   ============================================================ */

const normalizar = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function ehFralda(nome: string): boolean {
  return normalizar(nome).includes("fralda");
}

export function ehAbsorvente(nome: string): boolean {
  const t = normalizar(nome);
  return t.includes("absorvente") || /(^|\s)abs(\s|$)/.test(t);
}

/* ============================================================
   INTERVALO DO MEDICAMENTO
   ============================================================ */

export function intervaloDoMedicamento(nome: string, principioAtivo = ""): number {
  const t = normalizar(`${nome} ${principioAtivo}`);

  /* Colírio para glaucoma */
  if (t.includes("timolol")) {
    return 25;
  }

  /* Anticoncepcionais */
  if (t.includes("medroxiprogesterona")) {
    return 90;
  }

  if (t.includes("noretisterona") && (t.includes("estradiol") || t.includes("enantato"))) {
    return 25;
  }

  if (t.includes("noretisterona")) {
    return 30;
  }

  if (t.includes("levonorgestrel") && t.includes("etinilestradiol")) {
    /* Embalagem múltipla (3 cartelas ou 63 comprimidos) */
    const multipla = /c\/?\s*6[0-9]|63\s*(cpr|comp)|3\s*(cartelas|cx)|x\s*3/.test(t);
    return multipla ? 80 : 25;
  }

  /* Demais tratamentos contínuos */
  return INTERVALO_PADRAO_MEDICAMENTO;
}

/* ============================================================
   CÁLCULO DE DATAS
   ============================================================ */

/** Soma dias a uma data no formato AAAA-MM-DD, respeitando meses e anos bissextos. */
export function somarDias(dataIso: string, dias: number): Date | null {
  const partes = dataIso.split("-").map(Number);

  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) {
    return null;
  }

  const [ano, mes, dia] = partes as [number, number, number];

  const base = new Date(Date.UTC(ano, mes - 1, dia));

  if (base.getUTCMonth() !== mes - 1 || base.getUTCDate() !== dia) {
    return null;
  }

  base.setUTCDate(base.getUTCDate() + dias);

  return base;
}

export function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatarDataIso(dataIso: string): string {
  const d = somarDias(dataIso, 0);
  return d ? formatarData(d) : "";
}

/** Dias restantes (0 quando a retirada já está liberada). */
export function diasRestantes(proxima: Date): number {
  const hoje = new Date();

  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const diff = Math.ceil((proxima.getTime() - hojeUtc) / 86_400_000);

  return diff > 0 ? diff : 0;
}
