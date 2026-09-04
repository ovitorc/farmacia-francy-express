/**
 * ============================================================
 * COMPARAÇÃO, PONTUAÇÃO E ORDENAÇÃO DE IMAGENS
 * ============================================================
 *
 * PRIORIDADE:
 *
 * 1. EAN / código de barras idêntico
 * 2. Nome do produto
 * 3. Apresentação
 * 4. Fabricante
 * 5. Fonte da imagem
 *
 * O objetivo é garantir que imagens encontradas utilizando o
 * código de barras correto tenham prioridade máxima.
 *
 * ============================================================
 */

/* ============================================================
   TIPOS
   ============================================================ */

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

export type Avaliacao = {
  confianca: number;
  conflito: boolean;
  motivos: string[];
  eanConfirmado: boolean;
};

export type CandidatoAvaliado = Candidato &
  Avaliacao & {
    relevancia?: number;
  };

/* ============================================================
   PESOS
   ============================================================ */

export const PESOS = {
  ean: 80,
  nome: 12,
  fabricante: 3,
  apresentacao: 5,
};

/* ============================================================
   LIMITES
   ============================================================ */

export const LIMITES = {
  aprovarAutomatico: 80,
  revisaoManual: 45,
};

/* ============================================================
   NORMALIZAÇÃO
   ============================================================ */

const ACENTOS = /[\u0300-\u036f]/g;

export function normalizar(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(ACENTOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizarEan(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "");
}

function eanSemZeros(valor: string): string {
  const resultado = valor.replace(/^0+/, "");

  return resultado || valor;
}

export function eanIgual(a: string | null | undefined, b: string | null | undefined): boolean {
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

function tokens(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((token) => token.length > 2);
}

/* ============================================================
   SIMILARIDADE DO NOME
   ============================================================ */

export function similaridadeNome(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);

  if (!ta.length || !tb.length) {
    return 0;
  }

  const setA = new Set(ta);
  const setB = new Set(tb);

  let iguais = 0;

  for (const token of setA) {
    if (setB.has(token)) {
      iguais++;
    }
  }

  /*
   * Utilizamos uma relação baseada no maior conjunto.
   *
   * Isso evita que produtos com nomes muito diferentes
   * recebam pontuação alta apenas por possuírem uma palavra
   * em comum.
   */
  return iguais / Math.max(setA.size, setB.size);
}

/* ============================================================
   APRESENTAÇÃO
   ============================================================ */

export type Apresentacao = {
  quantidade?: number;
  dose?: string;
};

export function apresentacao(texto: string): Apresentacao {
  const textoNormalizado = normalizar(texto);

  const dose = textoNormalizado.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|ml|l|mcg|ui|%)/);

  const quantidade = textoNormalizado.match(
    /(\d+)\s*(cp|cps|comp|comprimidos?|capsulas?|caps|drageas?|envelopes?|unidades?|un|tabletes?|saches?|ampolas?|frascos?)\b/,
  );

  return {
    quantidade: quantidade ? Number(quantidade[1]) : undefined,

    dose: dose ? `${dose[1].replace(",", ".")}${dose[2]}` : undefined,
  };
}

/* ============================================================
   PRIORIDADE DAS FONTES
   ============================================================ */

/*
 * Esta prioridade é usada somente como desempate.
 *
 * A IMAGEM CORRETA NÃO DEVE PERDER PARA UMA FONTE DE MAIOR
 * PRIORIDADE.
 *
 * Portanto:
 *
 * EAN confirmado > confiança > ausência de conflito > fonte.
 */

export function prioridadeFonte(source: string | undefined): number {
  const fonte = normalizar(source ?? "");

  const prioridades: Record<string, number> = {
    google: 100,
    google_images: 100,

    pague_menos: 95,
    pague: 95,
    pague_menos_com_br: 95,

    farmacia_permanente: 90,
    permanente: 90,

    drogasil: 85,

    droga_raia: 80,
    drogaraia: 80,

    cosmos: 75,
    bluesoft: 75,

    manual: 70,

    open_beauty_facts: 60,
    open_products_facts: 55,
    open_food_facts: 50,
  };

  if (prioridades[fonte] !== undefined) {
    return prioridades[fonte];
  }

  /*
   * Permite reconhecer variações enviadas pelos providers.
   */

  if (fonte.includes("google")) {
    return 100;
  }

  if (fonte.includes("pague") || fonte.includes("menos")) {
    return 95;
  }

  if (fonte.includes("permanente")) {
    return 90;
  }

  if (fonte.includes("drogasil")) {
    return 85;
  }

  if (fonte.includes("raia")) {
    return 80;
  }

  if (fonte.includes("cosmos") || fonte.includes("bluesoft")) {
    return 75;
  }

  if (fonte.includes("manual")) {
    return 70;
  }

  return 10;
}

/* ============================================================
   AVALIAÇÃO DO CANDIDATO
   ============================================================ */

export function avaliarCandidato(produto: ProdutoRef, candidato: Candidato): Avaliacao {
  const motivos: string[] = [];

  let pontos = 0;

  let conflito = false;

  let eanConfirmado = false;

  const eanProduto = normalizarEan(produto.codigo_barras);

  const eanCandidato = normalizarEan(candidato.ean);

  /* ==========================================================
     EAN
     ========================================================== */

  if (eanProduto && eanCandidato) {
    if (eanIgual(eanProduto, eanCandidato)) {
      pontos += PESOS.ean;

      eanConfirmado = true;

      motivos.push("EAN / código de barras idêntico");
    } else {
      /*
       * EAN diferente é um conflito grave.
       *
       * Mesmo que o nome seja parecido, esta imagem
       * não pode ser aprovada automaticamente.
       */

      conflito = true;

      motivos.push("EAN / código de barras diferente");
    }
  } else if (eanProduto && !eanCandidato) {
    motivos.push("Fonte não informou o EAN");
  } else {
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

    /*
     * Se os nomes forem extremamente diferentes e existir
     * EAN confirmado, NÃO criamos conflito.
     *
     * O EAN correto possui prioridade máxima.
     */
    if (similaridade < 0.15 && !eanConfirmado) {
      motivos.push("Nome possui baixa compatibilidade");
    }
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

    /*
     * Uma apresentação diferente somente gera conflito
     * se NÃO houver confirmação pelo EAN.
     *
     * Isso evita rejeitar um produto correto quando uma fonte
     * descreve a embalagem de maneira incompleta.
     */

    if ((doseConflita || quantidadeConflita) && !eanConfirmado) {
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
      } else if (doseConflita || quantidadeConflita) {
        motivos.push("Apresentação diferente, porém EAN confirmado");
      }
    }
  }

  /* ==========================================================
     FABRICANTE
     ========================================================== */

  const fabricanteProduto = normalizar(produto.fabricante ?? "");

  const fabricanteCandidato = normalizar(candidato.fabricante ?? "");

  if (fabricanteProduto && fabricanteCandidato) {
    const palavrasProduto = new Set(fabricanteProduto.split(" ").filter((palavra) => palavra.length > 2));

    const palavrasCandidato = new Set(fabricanteCandidato.split(" ").filter((palavra) => palavra.length > 2));

    const possuiPalavraIgual = [...palavrasProduto].some((palavra) => palavrasCandidato.has(palavra));

    const compativel =
      possuiPalavraIgual ||
      fabricanteProduto.includes(fabricanteCandidato) ||
      fabricanteCandidato.includes(fabricanteProduto);

    if (compativel) {
      pontos += PESOS.fabricante;

      motivos.push("Fabricante compatível");
    } else {
      motivos.push("Fabricante não confirmado");
    }
  } else if (fabricanteProduto) {
    motivos.push("Fonte não informou fabricante");
  }

  /* ==========================================================
     RESULTADO PRIORITÁRIO PELO EAN
     ========================================================== */

  if (eanConfirmado && !conflito) {
    motivos.push("Resultado priorizado por código de barras");
  }

  const confianca = Math.max(0, Math.min(100, pontos));

  return {
    confianca,
    conflito,
    motivos,
    eanConfirmado,
  };
}

/* ============================================================
   CLASSIFICAÇÃO
   ============================================================ */

export function classificar(avaliacao: Avaliacao): "approved" | "manual_review" | "rejeitado" {
  /*
   * Conflitos sempre exigem revisão.
   */

  if (avaliacao.conflito) {
    return "manual_review";
  }

  /*
   * EAN confirmado tem aprovação prioritária.
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
   ============================================================ */

/**
 * Ordenação final:
 *
 * 1. EAN confirmado
 * 2. Sem conflito
 * 3. Maior confiança
 * 4. Prioridade da fonte
 *
 * Isso impede que uma imagem do Google, por exemplo,
 * fique acima de uma imagem com EAN confirmado apenas
 * porque o Google possui maior prioridade como fonte.
 */

export function ordenarPorRelevancia<
  T extends Avaliacao & {
    source?: string;
  },
>(candidatos: T[]): T[] {
  return [...candidatos].sort((a, b) => {
    /* ================================================
         1. EAN CONFIRMADO
         ================================================ */

    if (a.eanConfirmado !== b.eanConfirmado) {
      return a.eanConfirmado ? -1 : 1;
    }

    /* ================================================
         2. SEM CONFLITO
         ================================================ */

    if (a.conflito !== b.conflito) {
      return a.conflito ? 1 : -1;
    }

    /* ================================================
         3. CONFIANÇA
         ================================================ */

    if (b.confianca !== a.confianca) {
      return b.confianca - a.confianca;
    }

    /* ================================================
         4. FONTE
         ================================================ */

    const prioridadeA = prioridadeFonte(a.source);

    const prioridadeB = prioridadeFonte(b.source);

    if (prioridadeB !== prioridadeA) {
      return prioridadeB - prioridadeA;
    }

    return 0;
  });
}

/* ============================================================
   AVALIAR E ORDENAR
   ============================================================ */

/**
 * Função auxiliar para os providers.
 *
 * Avalia todos os candidatos e devolve os resultados
 * já organizados pela relevância.
 */

export function avaliarEOrdenarCandidatos(produto: ProdutoRef, candidatos: Candidato[]): CandidatoAvaliado[] {
  const avaliados: CandidatoAvaliado[] = candidatos.map((candidato) => {
    const avaliacao = avaliarCandidato(produto, candidato);

    return {
      ...candidato,
      ...avaliacao,

      /*
       * Relevância auxiliar utilizada para depuração
       * e futuras ordenações.
       */
      relevancia:
        avaliacao.confianca +
        (avaliacao.eanConfirmado ? 1000 : 0) +
        (!avaliacao.conflito ? 100 : 0) +
        prioridadeFonte(candidato.source) / 100,
    };
  });

  return ordenarPorRelevancia(avaliados);
}
