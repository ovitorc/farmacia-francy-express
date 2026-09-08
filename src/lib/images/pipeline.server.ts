/**
 * ============================================================
 * DOWNLOAD, VALIDAÇÃO E ARMAZENAMENTO DE IMAGENS
 * ============================================================
 */

const TAMANHO_MAXIMO = 6 * 1024 * 1024;
const TAMANHO_MINIMO = 1024;
const DIMENSAO_MINIMA = 120;

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

export async function baixarImagem(url: string): Promise<ImagemBaixada> {
  const resposta = await fetch(url, {
    headers: { "user-agent": "FarmaciasFrancy/1.0", accept: "image/*" },
  });

  if (!resposta.ok) {
    throw new Error(`Download falhou (HTTP ${resposta.status})`);
  }

  const buffer = new Uint8Array(await resposta.arrayBuffer());

  if (buffer.byteLength < TAMANHO_MINIMO) throw new Error("Arquivo muito pequeno");
  if (buffer.byteLength > TAMANHO_MAXIMO) throw new Error("Arquivo muito grande");

  const detectado = detectarFormato(buffer);
  if (!detectado) throw new Error("Arquivo não é uma imagem válida");

  const mime = detectado.mime;
  const extensao = MIMES[mime]!;

  const dim = dimensoes(buffer, extensao);

  if (dim && (dim.largura < DIMENSAO_MINIMA || dim.altura < DIMENSAO_MINIMA)) {
    throw new Error(`Imagem pequena demais (${dim.largura}x${dim.altura})`);
  }

  return {
    bytes: buffer,
    mime,
    extensao,
    largura: dim?.largura ?? null,
    altura: dim?.altura ?? null,
    hash: await sha256(buffer),
  };
}

/** Detecção pelos "magic bytes" — impede HTML salvo como .jpg. */
function detectarFormato(b: Uint8Array): { mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg" };

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png" };

  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: "image/gif" };

  const riff = String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!);
  const webp = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
  if (riff === "RIFF" && webp === "WEBP") return { mime: "image/webp" };

  return null;
}

function dimensoes(b: Uint8Array, ext: string): { largura: number; altura: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

  try {
    if (ext === "png") {
      return { largura: view.getUint32(16), altura: view.getUint32(20) };
    }

    if (ext === "gif") {
      return { largura: view.getUint16(6, true), altura: view.getUint16(8, true) };
    }

    if (ext === "webp") {
      const formato = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);

      if (formato === "VP8X") {
        const l = 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16));
        const a = 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16));
        return { largura: l, altura: a };
      }

      if (formato === "VP8L") {
        const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
        return { largura: (bits & 0x3fff) + 1, altura: ((bits >> 14) & 0x3fff) + 1 };
      }

      if (formato === "VP8 ") {
        return { largura: view.getUint16(26, true) & 0x3fff, altura: view.getUint16(28, true) & 0x3fff };
      }

      return null;
    }

    if (ext === "jpg") {
      let i = 2;

      while (i < b.byteLength) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }

        const marcador = b[i + 1]!;

        if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
          return { altura: view.getUint16(i + 5), largura: view.getUint16(i + 7) };
        }

        i += 2 + view.getUint16(i + 2);
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Envia ao Storage (bucket "produtos") em caminho previsível
 * e devolve a URL pública servida pelo proxy do site.
 */
export async function guardarImagem(
  chave: string,
  imagem: ImagemBaixada,
): Promise<{ url: string; caminho: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const caminho = `catalogo/${chave}/main.${imagem.extensao}`;

  const { error } = await supabaseAdmin.storage
    .from("produtos")
    .upload(caminho, imagem.bytes as unknown as ArrayBuffer, {
      contentType: imagem.mime,
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) throw new Error(error.message);

  return { url: `/api/public/img/${caminho}`, caminho };
}
