/**
 * ============================================================
 * COMPARAÇÃO E PONTUAÇÃO DE CONFIANÇA
 * ============================================================
 *
 * Este arquivo é responsável por decidir qual imagem encontrada
 * possui maior probabilidade de pertencer ao produto correto.
 *
 * PRIORIDADE DE RELEVÂNCIA:
 *
 * 1. EAN / Código de barras idêntico
 * 2. Nome do produto
 * 3. Apresentação
 *    Exemplo:
 *    - 500mg
 *    - 20 comprimidos
 *    - 200ml
 * 4. Fabricante
 *
 * Uma imagem encontrada através do código de barras correto deve
 * possuir prioridade muito superior a uma imagem encontrada apenas
 * pelo nome.
 *
 * ============================================================
 */

/**
 * Informações de uma imagem candidata.
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

/**
 * Informações básicas do produto que estamos procurando.
 */
export type ProdutoRef = {
  nome: string;

  fabricante?: string | null;

  codigo_barras?: string | null;
};

/* ============================================================
   PESOS DE CONFIANÇA
   ============================================================ */

/**
 * O EAN possui prioridade máxima.
 *
 * Se o código de barras for idêntico:
 *
 * 80 pontos.
 *
 * Isso significa que uma imagem encontrada pelo código de barras
 * correto poderá ser aprovada automaticamente mesmo quando a fonte
 * não informar perfeitamente o nome ou fabricante.
 */
export const PESOS = {
  /**
   * Código de barras idêntico.
   */
  ean: 80,

  /**
   * Compatibilidade entre o nome do produto.
   */
  nome: 12,

  /**
   * Fabricante compatível.
   */
  fabricante: 3,

  /**
   * Apresentação compatível.
   *
   * Exemplos:
   *
   * 500mg
   * 20 comprimidos
   * 200ml
   */
  apresentacao: 5,
};

/* ============================================================
   LIMITES DE DECISÃO
   ============================================================ */

export const LIMITES = {
  /**
   * A partir dessa pontuação a imagem pode ser aprovada
   * automaticamente.
   *
   * Um EAN idêntico + qualquer confirmação adicional normalmente
   * ultrapassa esse valor.
   */
  aprovarAutomatico: 80,

  /**
   * A partir dessa pontuação a imagem fica disponível
   * para revisão manual.
   */
  revisaoManual: 45,
};

/* ============================================================
   NORMALIZAÇÃO
   ============================================================ */

const ACENTOS = /[\u0300-\u036f]/g;

/**
 * Remove acentos, caracteres especiais e diferenças de maiúsculas.
 *
 * Exemplo:
 *
 * "Dipirona 500 MG"
 *
 * vira:
 *
 * "dipirona 500 mg"
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normaliza um código de barras.
 *
 * Mantém apenas números.
 */
export function normalizarEan(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Remove zeros à esquerda para permitir comparação entre fontes
 * que eventualmente armazenam o GTIN com formatação diferente.
 */
function eanSemZeros(valor: string): string {
  const resultado = valor.replace(/^0+/, "");

  return resultado || valor;
}

/**
 * Verifica se dois EANs representam o mesmo produto.
 */
export function eanIgual(
  a: string | null | undefined,

  b: string | null | undefined,
): boolean {
  const primeiro = normalizarEan(a);

  const segundo = normalizarEan(b);

  if (!primeiro || !segundo) {
    return false;
  }

  if (primeiro === segundo) {
    return true;
  }

  return eanSemZeros(primeiro) === eanSemZeros(segundo);
}

/* ============================================================
   TOKENS
   ============================================================ */

/**
 * Transforma o nome em palavras importantes.
 *
 * Palavras muito pequenas são ignoradas.
 */
function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((token) => token.length > 2);
}

/* ============================================================
   SIMILARIDADE DE NOME
   ============================================================ */

/**
 * Compara dois nomes.
 *
 * Retorna um valor entre:
 *
 * 0 = completamente diferente
 *
 * 1 = completamente compatível
 */
export function similaridadeNome(a: string, b: string): number {
  const ta = tokens(a);

  const tb = tokens(b);

  if (!ta.length || !tb.length) {
    return 0;
  }

  const setB = new Set(tb);

  const iguais = ta.filter((token) => setB.has(token)).length;

  return iguais / Math.max(ta.length, tb.length);
}

/* ============================================================
   APRESENTAÇÃO DO PRODUTO
   ============================================================ */

export type Apresentacao = {
  quantidade?: number | undefined;

  dose?: string | undefined;
};

/**
 * Procura informações importantes no nome do produto.
 *
 * Exemplos reconhecidos:
 *
 * 500mg
 * 1g
 * 200ml
 * 30 comprimidos
 * 20 cápsulas
 * 60 unidades
 */
export function apresentacao(texto: string): Apresentacao {
  const textoNormalizado = normalizar(texto);

  const dose = textoNormalizado.match(/(\d+[.,]?\d*)\s*(mg|g|ml|l|mcg|ui|%)/);

  const quantidade = textoNormalizado.match(
    /(\d+)\s*(cp|cps|comp|comprimidos?|capsulas?|caps|drageas?|envelopes?|unidades?|un|tabletes?|saches?|ampolas?|frascos?)\b/,
  );

  return {
    quantidade: quantidade ? Number(quantidade[1]) : undefined,

    dose: dose ? `${dose[1]!.replace(",", ".")}${dose[2]}` : undefined,
  };
}

/* ============================================================
   RESULTADO DA AVALIAÇÃO
   ============================================================ */

export type Avaliacao = {
  /**
   * Pontuação entre 0 e 100.
   */
  confianca: number;

  /**
   * Indica se existem informações incompatíveis.
   */
  conflito: boolean;

  /**
   * Explicação utilizada pelo painel administrativo.
   */
  motivos: string[];

  /**
   * Verdadeiro quando o EAN foi confirmado.
   */
  eanConfirmado: boolean;
};

/* ============================================================
   AVALIAÇÃO DO CANDIDATO
   ============================================================ */

/**
 * Avalia uma imagem candidata.
 *
 * REGRAS IMPORTANTES:
 *
 * ------------------------------------------------------------
 * EAN IDÊNTICO
 * ------------------------------------------------------------
 *
 * Possui prioridade máxima.
 *
 * ------------------------------------------------------------
 * EAN DIFERENTE
 * ------------------------------------------------------------
 *
 * Nunca aprova automaticamente.
 *
 * Vai para revisão manual.
 *
 * ------------------------------------------------------------
 * SEM EAN
 * ------------------------------------------------------------
 *
 * A decisão é feita utilizando:
 *
 * - nome
 * - apresentação
 * - fabricante
 */
export function avaliarCandidato(produto: ProdutoRef, candidato: Candidato): Avaliacao {
  const motivos: string[] = [];

  let pontos = 0;

  let conflito = false;

  let eanConfirmado = false;

  const eanProduto = normalizarEan(produto.codigo_barras);

  const eanCandidato = normalizarEan(candidato.ean);

  /* ==========================================================
     EAN / CÓDIGO DE BARRAS
     ========================================================== */

  if (eanProduto && eanCandidato) {
    if (eanIgual(eanProduto, eanCandidato)) {
      /**
       * PRIORIDADE MÁXIMA.
       */
      pontos += PESOS.ean;

      eanConfirmado = true;

      motivos.push("EAN / código de barras idêntico");
    } else {
      /**
       * EAN diferente é um conflito grave.
       *
       * Mesmo que o nome seja parecido,
       * não podemos aprovar automaticamente.
       */
      conflito = true;

      motivos.push("EAN / código de barras diferente");
    }
  } else if (eanProduto && !eanCandidato) {
    motivos.push("Fonte não informou o EAN");
  } else if (!eanProduto) {
    motivos.push("Produto não possui EAN cadastrado");
  }

  /* ==========================================================
     NOME
     ========================================================== */

  if (candidato.nome) {
    const similaridade = similaridadeNome(produto.nome, candidato.nome);

    const pontosNome = Math.round(PESOS.nome * similaridade);

    pontos += pontosNome;

    motivos.push(`Nome ${Math.round(similaridade * 100)}% compatível`);
  } else {
    motivos.push("Fonte não informou o nome do produto");
  }

  /* ==========================================================
     APRESENTAÇÃO
     ========================================================== */

  if (candidato.nome) {
    const apresentacaoProduto = apresentacao(produto.nome);

    const apresentacaoCandidato = apresentacao(candidato.nome);

    const doseProduto = apresentacaoProduto.dose;

    const doseCandidato = apresentacaoCandidato.dose;

    const quantidadeProduto = apresentacaoProduto.quantidade;

    const quantidadeCandidato = apresentacaoCandidato.quantidade;

    const doseConflita = Boolean(doseProduto && doseCandidato && doseProduto !== doseCandidato);

    const quantidadeConflita = Boolean(
      quantidadeProduto && quantidadeCandidato && quantidadeProduto !== quantidadeCandidato,
    );

    if (doseConflita || quantidadeConflita) {
      /**
       * Exemplo:
       *
       * Produto:
       * Dipirona 500mg
       *
       * Candidato:
       * Dipirona 1g
       *
       * Mesmo nome, apresentação diferente.
       */
      conflito = true;

      motivos.push("Apresentação diferente");
    } else {
      const doseCompativel = Boolean(doseProduto && doseCandidato && doseProduto === doseCandidato);

      const quantidadeCompativel = Boolean(
        quantidadeProduto && quantidadeCandidato && quantidadeProduto === quantidadeCandidato,
      );

      if (doseCompativel || quantidadeCompativel) {
        pontos += PESOS.apresentacao;

        motivos.push("Apresentação compatível");
      }
    }
  }

  /* ==========================================================
     FABRICANTE
     ========================================================== */

  const fabricanteProduto = normalizar(produto.fabricante ?? "");

  const fabricanteCandidato = normalizar(candidato.fabricante ?? "");

  if (fabricanteProduto && fabricanteCandidato) {
    const primeiroProduto = fabricanteProduto.split(" ").filter(Boolean)[0];

    const primeiroCandidato = fabricanteCandidato.split(" ").filter(Boolean)[0];

    const compativel = Boolean(
      primeiroProduto &&
      primeiroCandidato &&
      (fabricanteProduto.includes(primeiroCandidato) || fabricanteCandidato.includes(primeiroProduto)),
    );

    if (compativel) {
      pontos += PESOS.fabricante;

      motivos.push("Fabricante compatível");
    } else {
      /**
       * Fabricante diferente não necessariamente significa
       * que a imagem está errada.
       *
       * Algumas fontes possuem fabricante incompleto,
       * distribuidor ou grupo empresarial.
       *
       * Portanto, reduzimos a confiança indiretamente
       * sem criar conflito automático.
       */
      motivos.push("Fabricante não confirmado");
    }
  } else if (fabricanteProduto) {
    motivos.push("Fonte não informou fabricante");
  }

  /* ==========================================================
     EAN CONFIRMADO
     ==========================================================
     *
     * Quando o EAN é confirmado, evitamos que pequenas diferenças
     * no nome reduzam a prioridade do resultado.
     */

  if (eanConfirmado && !conflito) {
    motivos.push("Resultado priorizado por código de barras");
  }

  /* ==========================================================
     LIMITA A PONTUAÇÃO ENTRE 0 E 100
     ========================================================== */

  const confianca = Math.max(0, Math.min(100, pontos));

  return {
    confianca,

    conflito,

    motivos,

    eanConfirmado,
  };
}

/* ============================================================
   CLASSIFICAÇÃO FINAL
   ============================================================ */

/**
 * Decide o destino da imagem.
 *
 * ------------------------------------------------------------
 * CONFLITO
 * ------------------------------------------------------------
 *
 * Sempre revisão manual.
 *
 * ------------------------------------------------------------
 * 80 OU MAIS
 * ------------------------------------------------------------
 *
 * Aprovada automaticamente.
 *
 * ------------------------------------------------------------
 * 45 A 79
 * ------------------------------------------------------------
 *
 * Revisão manual.
 *
 * ------------------------------------------------------------
 * MENOS DE 45
 * ------------------------------------------------------------
 *
 * Rejeitada.
 */
export function classificar(avaliacao: Avaliacao): "approved" | "manual_review" | "rejeitado" {
  if (avaliacao.conflito) {
    return "manual_review";
  }

  /**
   * EAN confirmado possui prioridade.
   */
  if (avaliacao.eanConfirmado && avaliacao.confianca >= PESOS.ean) {
    return "approved";
  }

  if (avaliacao.confianca >= LIMITES.aprovarAutomatico) {
    return "approved";
  }

  if (avaliacao.confianca >= LIMITES.revisaoManual) {
    return "manual_review";
  }

  return "rejeitado";
}

/* ============================================================
   ORDENAÇÃO DE CANDIDATOS
   ============================================================
 *
 * Esta função pode ser utilizada no painel administrativo.
 *
 * A ordem será:
 *
 * 1. EAN confirmado
 * 2. Maior confiança
 * 3. Sem conflito
 */
export function ordenarPorRelevancia<T extends Avaliacao>(candidatos: T[]): T[] {
  return [...candidatos].sort((a, b) => {
    /**
     * EAN confirmado primeiro.
     */
    if (a.eanConfirmado !== b.eanConfirmado) {
      return a.eanConfirmado ? -1 : 1;
    }

    /**
     * Depois maior confiança.
     */
    if (b.confianca !== a.confianca) {
      return b.confianca - a.confianca;
    }

    /**
     * Sem conflito antes.
     */
    if (a.conflito !== b.conflito) {
      return a.conflito ? 1 : -1;
    }

    return 0;
  });
}
