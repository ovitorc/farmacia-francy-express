/**
 * ============================================================
 * COMPARAÇÃO E PONTUAÇÃO DE CONFIANÇA
 * ============================================================
 *
 * Funções puras utilizadas para comparar o produto do banco
 * com os candidatos encontrados nas buscas.
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
  nome: 25,
  fabricante: 10,
  apresentacao: 5,
};

export const LIMITES = {
  aprovarAutomatico: 75,
  revisaoManual: 45,
};

const ACENTOS = /[\u0300-\u036f]/g;

export function normalizar(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((token) => token.length > 2);
}

export function similaridadeNome(primeiro: string, segundo: string): number {
  const tokensPrimeiro = tokens(primeiro);
  const tokensSegundo = tokens(segundo);

  if (!tokensPrimeiro.length || !tokensSegundo.length) {
    return 0;
  }

  const conjuntoSegundo = new Set(tokensSegundo);

  const iguais = tokensPrimeiro.filter((token) => conjuntoSegundo.has(token)).length;

  /**
   * Calcula a cobertura dos dois lados.
   *
   * Isso melhora a comparação quando o título encontrado
   * contém informações extras.
   */
  const coberturaPrimeiro = iguais / tokensPrimeiro.length;

  const conjuntoPrimeiro = new Set(tokensPrimeiro);

  const iguaisSegundo = tokensSegundo.filter((token) => conjuntoPrimeiro.has(token)).length;

  const coberturaSegundo = iguaisSegundo / tokensSegundo.length;

  return Math.max(coberturaPrimeiro, coberturaSegundo);
}

/**
 * Extrai informações da apresentação do produto.
 */
export function apresentacao(texto: string): {
  quantidade?: number;
  dose?: string;
  volume?: string;
} {
  const valor = normalizar(texto);

  const doseMatch = valor.match(/(\d+[.,]?\d*)\s*(mg|mcg|g|ui|%)\b/);

  const volumeMatch = valor.match(/(\d+[.,]?\d*)\s*(ml|l)\b/);

  const quantidadeMatch = valor.match(
    /(\d+)\s*(cp|cps|comp|comprimidos?|capsulas?|caps|drageas?|envelopes?|unidades?|un|saches?)\b/,
  );

  return {
    quantidade: quantidadeMatch ? Number(quantidadeMatch[1]) : undefined,

    dose: doseMatch ? `${doseMatch[1].replace(",", ".")}${doseMatch[2]}` : undefined,

    volume: volumeMatch ? `${volumeMatch[1].replace(",", ".")}${volumeMatch[2]}` : undefined,
  };
}

export type Avaliacao = {
  confianca: number;
  conflito: boolean;
  motivos: string[];
};

function compararEan(produto: string, candidato: string): boolean {
  if (!produto || !candidato) {
    return false;
  }

  if (produto === candidato) {
    return true;
  }

  return produto.replace(/^0+/, "") === candidato.replace(/^0+/, "");
}

export function avaliarCandidato(produto: ProdutoRef, candidato: Candidato): Avaliacao {
  const motivos: string[] = [];

  let pontos = 0;

  let conflito = false;

  const eanProduto = (produto.codigo_barras ?? "").replace(/\D/g, "");

  const eanCandidato = (candidato.ean ?? "").replace(/\D/g, "");

  /**
   * EAN
   */
  if (eanProduto && eanCandidato) {
    if (compararEan(eanProduto, eanCandidato)) {
      pontos += PESOS.ean;

      motivos.push("EAN idêntico");
    } else {
      conflito = true;

      motivos.push("EAN diferente");
    }
  } else {
    motivos.push("Fonte não informou EAN");
  }

  /**
   * NOME
   */
  if (candidato.nome) {
    const similaridade = similaridadeNome(produto.nome, candidato.nome);

    const pontosNome = Math.round(PESOS.nome * similaridade);

    pontos += pontosNome;

    motivos.push(`Nome ${Math.round(similaridade * 100)}% compatível`);

    /**
     * Se o nome é muito incompatível,
     * marcamos conflito somente quando temos
     * informação suficiente para isso.
     */
    if (similaridade < 0.2 && tokens(produto.nome).length >= 2 && tokens(candidato.nome).length >= 2) {
      conflito = true;

      motivos.push("Nome muito diferente");
    }

    /**
     * APRESENTAÇÃO
     */
    const apresentacaoProduto = apresentacao(produto.nome);

    const apresentacaoCandidato = apresentacao(candidato.nome);

    const doseConflita =
      Boolean(apresentacaoProduto.dose) &&
      Boolean(apresentacaoCandidato.dose) &&
      apresentacaoProduto.dose !== apresentacaoCandidato.dose;

    const volumeConflita =
      Boolean(apresentacaoProduto.volume) &&
      Boolean(apresentacaoCandidato.volume) &&
      apresentacaoProduto.volume !== apresentacaoCandidato.volume;

    const quantidadeConflita =
      Boolean(apresentacaoProduto.quantidade) &&
      Boolean(apresentacaoCandidato.quantidade) &&
      apresentacaoProduto.quantidade !== apresentacaoCandidato.quantidade;

    if (doseConflita || volumeConflita || quantidadeConflita) {
      conflito = true;

      motivos.push("Apresentação diferente");
    } else if (
      (apresentacaoProduto.dose && apresentacaoCandidato.dose) ||
      (apresentacaoProduto.volume && apresentacaoCandidato.volume) ||
      (apresentacaoProduto.quantidade && apresentacaoCandidato.quantidade)
    ) {
      pontos += PESOS.apresentacao;

      motivos.push("Apresentação compatível");
    }
  } else {
    /**
     * Não penalizamos candidatos que possuem uma página
     * válida, mas cujo título não foi encontrado.
     */
    motivos.push("Fonte não informou título");
  }

  /**
   * FABRICANTE
   */
  const fabricanteProduto = normalizar(produto.fabricante ?? "");

  const fabricanteCandidato = normalizar(candidato.fabricante ?? "");

  if (fabricanteProduto && fabricanteCandidato) {
    const palavrasProduto = fabricanteProduto.split(" ");

    const palavrasCandidato = fabricanteCandidato.split(" ");

    const existePalavraIgual = palavrasProduto.some(
      (palavra) => palavra.length > 2 && palavrasCandidato.includes(palavra),
    );

    if (existePalavraIgual) {
      pontos += PESOS.fabricante;

      motivos.push("Fabricante compatível");
    } else {
      motivos.push("Fabricante não confirmado");
    }
  }

  /**
   * Quando encontramos uma página de produto mas não temos
   * EAN nem título confiável, mantém uma confiança mínima
   * para permitir revisão manual.
   */
  if (pontos === 0 && candidato.sourceUrl && candidato.imageUrl) {
    pontos = 30;

    motivos.push("Imagem encontrada em página de produto");
  }

  return {
    confianca: Math.max(0, Math.min(100, pontos)),

    conflito,

    motivos,
  };
}

export function classificar(avaliacao: Avaliacao): "approved" | "manual_review" | "rejeitado" {
  if (avaliacao.conflito) {
    return "manual_review";
  }

  if (avaliacao.confianca >= LIMITES.aprovarAutomatico) {
    return "approved";
  }

  if (avaliacao.confianca >= LIMITES.revisaoManual) {
    return "manual_review";
  }

  return "rejeitado";
}
