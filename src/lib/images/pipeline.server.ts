/**
 * ============================================================
 * DOWNLOAD, VALIDAÇÃO E ARMAZENAMENTO DE IMAGENS
 * ============================================================
 */

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

const TAMANHO_MINIMO = 500;

const DIMENSAO_MINIMA = 80;

export type ImagemBaixada = {
  bytes: Uint8Array;
  mime: string;
  extensao: string;
  largura: number | null;
  altura: number | null;
  hash: string;
};

const MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function criarHeadersImagem(): HeadersInit {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

    Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",

    Referer: "https://www.google.com/",
  };
}

async function fetchImagem(url: string): Promise<Response> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 20000);

  try {
    return await fetch(url, {
      headers: criarHeadersImagem(),

      signal: controller.signal,

      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function baixarImagem(url: string): Promise<ImagemBaixada> {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("URL de imagem inválida");
  }

  const resposta = await fetchImagem(url);

  if (!resposta.ok) {
    throw new Error(`Download falhou (HTTP ${resposta.status})`);
  }

  const buffer = new Uint8Array(await resposta.arrayBuffer());

  if (buffer.byteLength < TAMANHO_MINIMO) {
    throw new Error("Arquivo muito pequeno");
  }

  if (buffer.byteLength > TAMANHO_MAXIMO) {
    throw new Error("Arquivo muito grande");
  }

  const detectado = detectarFormato(buffer);

  if (!detectado) {
    throw new Error("Arquivo não é uma imagem válida");
  }

  const mime = detectado.mime;

  const extensao = MIMES[mime];

  if (!extensao) {
    throw new Error("Formato de imagem não suportado");
  }

  const dimensoesImagem = dimensoes(buffer, extensao);

  if (dimensoesImagem && (dimensoesImagem.largura < DIMENSAO_MINIMA || dimensoesImagem.altura < DIMENSAO_MINIMA)) {
    throw new Error(`Imagem pequena demais (${dimensoesImagem.largura}x${dimensoesImagem.altura})`);
  }

  return {
    bytes: buffer,

    mime,

    extensao,

    largura: dimensoesImagem?.largura ?? null,

    altura: dimensoesImagem?.altura ?? null,

    hash: await sha256(buffer),
  };
}

/**
 * ============================================================
 * DETECÇÃO PELOS MAGIC BYTES
 * ============================================================
 */

function detectarFormato(bytes: Uint8Array): {
  mime: string;
} | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      mime: "image/jpeg",
    };
  }

  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return {
      mime: "image/png",
    };
  }

  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return {
      mime: "image/gif",
    };
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);

    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);

    if (riff === "RIFF" && webp === "WEBP") {
      return {
        mime: "image/webp",
      };
    }
  }

  return null;
}

/**
 * ============================================================
 * DIMENSÕES
 * ============================================================
 */

function dimensoes(
  bytes: Uint8Array,
  extensao: string,
): {
  largura: number;
  altura: number;
} | null {
  if (bytes.byteLength < 10) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    /**
     * PNG
     */
    if (extensao === "png" && bytes.byteLength >= 24) {
      return {
        largura: view.getUint32(16),

        altura: view.getUint32(20),
      };
    }

    /**
     * GIF
     */
    if (extensao === "gif" && bytes.byteLength >= 10) {
      return {
        largura: view.getUint16(6, true),

        altura: view.getUint16(8, true),
      };
    }

    /**
     * WEBP
     */
    if (extensao === "webp" && bytes.byteLength >= 30) {
      const formato = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

      if (formato === "VP8X" && bytes.byteLength >= 30) {
        const largura = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));

        const altura = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));

        return {
          largura,
          altura,
        };
      }

      if (formato === "VP8L" && bytes.byteLength >= 25) {
        const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);

        return {
          largura: (bits & 0x3fff) + 1,

          altura: ((bits >> 14) & 0x3fff) + 1,
        };
      }

      if (formato === "VP8 " && bytes.byteLength >= 30) {
        return {
          largura: view.getUint16(26, true) & 0x3fff,

          altura: view.getUint16(28, true) & 0x3fff,
        };
      }
    }

    /**
     * JPEG
     */
    if (extensao === "jpg" && bytes.byteLength >= 4) {
      let posicao = 2;

      while (posicao < bytes.byteLength - 9) {
        if (bytes[posicao] !== 0xff) {
          posicao++;

          continue;
        }

        while (bytes[posicao] === 0xff) {
          posicao++;
        }

        const marcador = bytes[posicao];

        posicao++;

        /**
         * Marcadores sem tamanho.
         */
        if (marcador === 0xd8 || marcador === 0xd9) {
          continue;
        }

        if (posicao + 1 >= bytes.byteLength) {
          break;
        }

        const tamanho = (bytes[posicao] << 8) | bytes[posicao + 1];

        if (tamanho < 2) {
          break;
        }

        const inicio = posicao + 2;

        if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
          if (inicio + 4 < bytes.byteLength) {
            const altura = (bytes[inicio + 1] << 8) | bytes[inicio + 2];

            const largura = (bytes[inicio + 3] << 8) | bytes[inicio + 4];

            return {
              largura,
              altura,
            };
          }
        }

        posicao += tamanho;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * ============================================================
 * HASH
 * ============================================================
 */

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * ============================================================
 * STORAGE
 * ============================================================
 */

export async function guardarImagem(
  chave: string,
  imagem: ImagemBaixada,
): Promise<{
  url: string;
  caminho: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const chaveLimpa =
    String(chave)
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 100) || "produto";

  const caminho = `catalogo/${chaveLimpa}/main.${imagem.extensao}`;

  const { error } = await supabaseAdmin.storage
    .from("produtos")
    .upload(caminho, imagem.bytes as unknown as ArrayBuffer, {
      contentType: imagem.mime,

      upsert: true,

      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(`Erro ao salvar imagem: ${error.message}`);
  }

  return {
    url: `/api/public/img/${caminho}`,

    caminho,
  };
}
