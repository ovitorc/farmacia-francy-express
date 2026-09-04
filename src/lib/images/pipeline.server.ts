/**
 * ============================================================
 * DOWNLOAD, VALIDAÇÃO E ARMAZENAMENTO DE IMAGENS
 * ============================================================
 *
 * RESPONSABILIDADES:
 *
 * - Baixar imagens encontradas nas fontes.
 * - Validar se o arquivo realmente é uma imagem.
 * - Impedir HTML ou arquivos falsos salvos como JPG.
 * - Validar tamanho do arquivo.
 * - Identificar JPEG, PNG, WEBP e GIF.
 * - Identificar dimensões quando possível.
 * - Gerar hash SHA-256.
 * - Evitar imagens muito pequenas.
 * - Salvar a imagem no Supabase Storage.
 *
 * ============================================================
 */

const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TAMANHO_MINIMO = 1024;

const DIMENSAO_MINIMA = 120;

const TIMEOUT_DOWNLOAD = 20_000;

/* ============================================================
   TIPOS
   ============================================================ */

export type ImagemBaixada = {
  bytes: Uint8Array;

  mime: string;

  extensao: string;

  largura: number | null;

  altura: number | null;

  hash: string;
};

/* ============================================================
   FORMATOS ACEITOS
   ============================================================ */

const MIMES: Record<
  string,
  string
> = {
  "image/jpeg": "jpg",

  "image/jpg": "jpg",

  "image/png": "png",

  "image/webp": "webp",

  "image/gif": "gif",
};

/* ============================================================
   DOWNLOAD
   ============================================================ */

export async function baixarImagem(
  url: string,
): Promise<ImagemBaixada> {
  if (
    !url ||
    !/^https?:\/\//i.test(
      url,
    )
  ) {
    throw new Error(
      "URL da imagem inválida",
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      TIMEOUT_DOWNLOAD,
    );

  try {
    const resposta =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          redirect:
            "follow",

          headers: {
            "user-agent":
              "FarmaciasFrancy/1.0",

            accept:
              "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        },
      );

    if (
      !resposta.ok
    ) {
      throw new Error(
        `Download falhou (HTTP ${resposta.status})`,
      );
    }

    const contentLength =
      Number(
        resposta.headers.get(
          "content-length",
        ) ??
          0,
      );

    if (
      contentLength >
      TAMANHO_MAXIMO
    ) {
      throw new Error(
        "Arquivo muito grande",
      );
    }

    const buffer =
      new Uint8Array(
        await resposta.arrayBuffer(),
      );

    if (
      buffer.byteLength <
      TAMANHO_MINIMO
    ) {
      throw new Error(
        "Arquivo muito pequeno",
      );
    }

    if (
      buffer.byteLength >
      TAMANHO_MAXIMO
    ) {
      throw new Error(
        "Arquivo muito grande",
      );
    }

    /**
     * Não confiamos apenas no Content-Type do servidor.
     *
     * Fazemos a detecção real utilizando os magic bytes.
     */
    const detectado =
      detectarFormato(
        buffer,
      );

    if (
      !detectado
    ) {
      throw new Error(
        "Arquivo não é uma imagem válida",
      );
    }

    const mime =
      detectado.mime;

    const extensao =
      MIMES[mime];

    if (
      !extensao
    ) {
      throw new Error(
        `Formato não suportado: ${mime}`,
      );
    }

    const dim =
      dimensoes(
        buffer,
        extensao,
      );

    /**
     * Se conseguimos descobrir as dimensões,
     * impedimos imagens pequenas demais.
     */
    if (
      dim &&
      (
        dim.largura <
          DIMENSAO_MINIMA ||
        dim.altura <
          DIMENSAO_MINIMA
      )
    ) {
      throw new Error(
        `Imagem pequena demais (${dim.largura}x${dim.altura})`,
      );
    }

    const hash =
      await sha256(
        buffer,
      );

    return {
      bytes:
        buffer,

      mime,

      extensao,

      largura:
        dim?.largura ??
        null,

      altura:
        dim?.altura ??
        null,

      hash,
    };
  } catch (
    erro,
  ) {
    if (
      erro instanceof Error &&
      erro.name ===
        "AbortError"
    ) {
      throw new Error(
        "Tempo limite ao baixar a imagem",
      );
    }

    throw erro;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}

/* ============================================================
   DETECÇÃO DE FORMATO
   ============================================================
 *
 * Magic bytes.
 *
 * Isso impede, por exemplo:
 *
 * Uma página HTML sendo salva como:
 *
 * produto.jpg
 *
 * ============================================================
 */

function detectarFormato(
  b: Uint8Array,
): {
  mime: string;
} | null {
  /**
   * JPEG
   */
  if (
    b.length >= 3 &&
    b[0] === 0xff &&
    b[1] === 0xd8 &&
    b[2] === 0xff
  ) {
    return {
      mime:
        "image/jpeg",
    };
  }

  /**
   * PNG
   */
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return {
      mime:
        "image/png",
    };
  }

  /**
   * GIF
   */
  if (
    b.length >= 6
  ) {
    const gif =
      String.fromCharCode(
        b[0]!,
        b[1]!,
        b[2]!,
        b[3]!,
        b[4]!,
        b[5]!,
      );

    if (
      gif === "GIF87a" ||
      gif === "GIF89a"
    ) {
      return {
        mime:
          "image/gif",
      };
    }
  }

  /**
   * WEBP
   */
  if (
    b.length >= 12
  ) {
    const riff =
      String.fromCharCode(
        b[0]!,
        b[1]!,
        b[2]!,
        b[3]!,
      );

    const webp =
      String.fromCharCode(
        b[8]!,
        b[9]!,
        b[10]!,
        b[11]!,
      );

    if (
      riff === "RIFF" &&
      webp === "WEBP"
    ) {
      return {
        mime:
          "image/webp",
      };
    }
  }

  return null;
}

/* ============================================================
   DIMENSÕES DA IMAGEM
   ============================================================ */

function dimensoes(
  b: Uint8Array,
  ext: string,
): {
  largura: number;
  altura: number;
} | null {
  if (
    b.byteLength <
    10
  ) {
    return null;
  }

  const view =
    new DataView(
      b.buffer,
      b.byteOffset,
      b.byteLength,
    );

  try {
    /* ========================================================
       PNG
       ======================================================== */

    if (
      ext === "png"
    ) {
      if (
        b.byteLength < 24
      ) {
        return null;
      }

      return {
        largura:
          view.getUint32(
            16,
          ),

        altura:
          view.getUint32(
            20,
          ),
      };
    }

    /* ========================================================
       GIF
       ======================================================== */

    if (
      ext === "gif"
    ) {
      if (
        b.byteLength < 10
      ) {
        return null;
      }

      return {
        largura:
          view.getUint16(
            6,
            true,
          ),

        altura:
          view.getUint16(
            8,
            true,
          ),
      };
    }

    /* ========================================================
       WEBP
       ======================================================== */

    if (
      ext === "webp"
    ) {
      return dimensoesWebp(
        b,
        view,
      );
    }

    /* ========================================================
       JPEG
       ======================================================== */

    if (
      ext === "jpg"
    ) {
      return dimensoesJpeg(
        b,
        view,
      );
    }
  } catch {
    return null;
  }

  return null;
}

/* ============================================================
   WEBP
   ============================================================ */

function dimensoesWebp(
  b: Uint8Array,
  view: DataView,
): {
  largura: number;
  altura: number;
} | null {
  if (
    b.byteLength < 30
  ) {
    return null;
  }

  const formato =
    String.fromCharCode(
      b[12]!,
      b[13]!,
      b[14]!,
      b[15]!,
    );

  /**
   * WEBP VP8X
   */
  if (
    formato === "VP8X"
  ) {
    if (
      b.byteLength < 30
    ) {
      return null;
    }

    const largura =
      1 +
      (
        b[24]! |
        (b[25]! << 8) |
        (b[26]! << 16)
      );

    const altura =
      1 +
      (
        b[27]! |
        (b[28]! << 8) |
        (b[29]! << 16)
      );

    return {
      largura,
      altura,
    };
  }

  /**
   * WEBP VP8L
   */
  if (
    formato === "VP8L"
  ) {
    if (
      b.byteLength < 25
    ) {
      return null;
    }

    const bits =
      b[21]! |
      (b[22]! << 8) |
      (b[23]! << 16) |
      (b[24]! << 24);

    return {
      largura:
        (bits & 0x3fff) +
        1,

      altura:
        (
          (
            bits >>
            14
          ) &
          0x3fff
        ) +
        1,
    };
  }

  /**
   * WEBP VP8
   */
  if (
    formato === "VP8 "
  ) {
    if (
      b.byteLength < 30
    ) {
      return null;
    }

    return {
      largura:
        view.getUint16(
          26,
          true,
        ) &
        0x3fff,

      altura:
        view.getUint16(
          28,
          true,
        ) &
        0x3fff,
    };
  }

  return null;
}

/* ============================================================
   JPEG
   ============================================================ */

function dimensoesJpeg(
  b: Uint8Array,
  view: DataView,
): {
  largura: number;
  altura: number;
} | null {
  let i = 2;

  while (
    i <
    b.byteLength -
      9
  ) {
    if (
      b[i] !==
      0xff
    ) {
      i++;
      continue;
    }

    /**
     * Ignora múltiplos FF.
     */
    while (
      b[i] === 0xff &&
      i <
        b.byteLength -
          1
    ) {
      i++;
    }

    const marcador =
      b[i];

    if (
      marcador ===
        undefined
    ) {
      return null;
    }

    /**
     * Marcadores sem tamanho.
     */
    if (
      marcador === 0xd8 ||
      marcador === 0xd9
    ) {
      i++;
      continue;
    }

    if (
      i + 2 >=
      b.byteLength
    ) {
      return null;
    }

    const tamanho =
      view.getUint16(
        i + 1,
      );

    if (
      tamanho < 2 ||
      i +
        tamanho +
        1 >=
        b.byteLength
    ) {
      return null;
    }

    /**
     * Start Of Frame.
     *
     * Onde ficam largura e altura.
     */
    if (
      marcador >= 0xc0 &&
      marcador <= 0xcf &&
      ![
        0xc4,
        0xc8,
        0xcc,
      ].includes(
        marcador,
      )
    ) {
      if (
        i + 8 >=
        b.byteLength
      ) {
        return null;
      }

      return {
        altura:
          view.getUint16(
            i + 4,
          ),

        largura:
          view.getUint16(
            i + 6,
          ),
      };
    }

    i +=
      tamanho +
      1;
  }

  return null;
}

/* ============================================================
   SHA-256
   ============================================================ */

async function sha256(
  bytes: Uint8Array,
): Promise<string> {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes as unknown as ArrayBuffer,
    );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (
        byte,
      ) =>
        byte
          .toString(
            16,
          )
          .padStart(
            2,
            "0",
          ),
    )
    .join(
      "",
    );
}

/* ============================================================
   SALVAR IMAGEM
   ============================================================
 *
 * Bucket:
 *
 * produtos
 *
 * Estrutura:
 *
 * catalogo/
 *   CODIGO-DE-BARRAS/
 *     main.jpg
 *
 * ============================================================
 */

export async function guardarImagem(
  chave: string,
  imagem: ImagemBaixada,
): Promise<{
  url: string;
  caminho: string;
}> {
  const {
    supabaseAdmin,
  } = await import(
    "@/integrations/supabase/client.server"
  );

  /**
   * Evita caracteres perigosos no caminho.
   */
  const chaveSegura =
    String(
      chave,
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "",
      ) ||
    "sem-codigo";

  const caminho =
    `catalogo/${chaveSegura}/main.${imagem.extensao}`;

  /**
   * Antes do upload,
   * remove possíveis versões antigas do mesmo produto.
   *
   * Isso evita:
   *
   * main.jpg
   * main.png
   * main.webp
   *
   * acumulados no Storage.
   */
  const extensoesAntigas = [
    "jpg",
    "png",
    "webp",
    "gif",
  ];

  const caminhosAntigos =
    extensoesAntigas
      .filter(
        (
          extensao,
        ) =>
          extensao !==
          imagem.extensao,
      )
      .map(
        (
          extensao,
        ) =>
          `catalogo/${chaveSegura}/main.${extensao}`,
      );

  if (
    caminhosAntigos.length >
    0
  ) {
    try {
      await supabaseAdmin.storage
        .from(
          "produtos",
        )
        .remove(
          caminhosAntigos,
        );
    } catch {
      /**
       * Não interrompe o upload caso
       * uma imagem antiga não exista.
       */
    }
  }

  /**
   * Upload da nova imagem.
   */
  const {
    error,
  } =
    await supabaseAdmin.storage
      .from(
        "produtos",
      )
      .upload(
        caminho,
        imagem.bytes as unknown as ArrayBuffer,
        {
          contentType:
            imagem.mime,

          upsert:
            true,

          /**
           * Cache longo porque a URL é estável.
           */
          cacheControl:
            "31536000",
        },
      );

  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }

  /**
   * A aplicação utiliza um proxy interno
   * para servir as imagens públicas.
   */
  return {
    url:
      `/api/public/img/${caminho}`,

    caminho,
  };
}