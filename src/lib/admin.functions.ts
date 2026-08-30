import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   SCHEMAS
   ============================================================ */

const produtoSchema = z.object({
  id: z.string().uuid().optional(),

  codigo: z.string().min(1),
  codigo_barras: z.string().nullable().default(null),

  nome: z.string().min(1),
  descricao: z.string().default(""),

  categoria_slug: z.string().min(1),
  subcategoria_slug: z.string().default(""),

  fabricante: z.string().default(""),
  unidade: z.string().default(""),

  preco: z.number().min(0),
  preco_promocional: z.number().min(0).nullable().default(null),

  estoque: z.number().int().min(0).default(0),

  principio_ativo: z.string().default(""),
  registro_ms: z.string().default(""),

  farmacia_popular: z.boolean().default(false),
  preco_farmacia_popular: z.number().min(0).nullable().default(null),

  imagem: z.string().nullable().default(null),

  disponivel: z.boolean().default(true),
  oferta: z.boolean().default(false),
  rasga_preco: z.boolean().default(false),

  informacoes: z.array(z.string()).default([]),
});

const bannerSchema = z.object({
  id: z.string().uuid().optional(),

  titulo: z.string().default(""),

  imagem: z.string().min(1),

  ativo: z.boolean().default(true),

  ordem: z.number().int().default(0),
});

/* ============================================================
   VERIFICAÇÃO DE ADMIN
   ============================================================ */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (error || !data) {
    throw new Error("Acesso restrito a administradores.");
  }
}

/* ============================================================
   ADMIN
   ============================================================ */

export const souAdmin = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (error) {
      return {
        admin: false,
      };
    }

    return {
      admin: Boolean(data),
    };
  });

/* ============================================================
   PRODUTOS
   ============================================================ */

export const salvarProduto = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => produtoSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { id, ...campos } = data;

    /* ========================================================
       ATUALIZAR PRODUTO EXISTENTE
       ======================================================== */

    if (id) {
      const { error } = await context.supabase
        .from("produtos")
        .update({
          codigo: campos.codigo,
          codigo_barras: campos.codigo_barras,
          nome: campos.nome,
          descricao: campos.descricao,

          categoria_slug: campos.categoria_slug,
          subcategoria_slug: campos.subcategoria_slug,

          fabricante: campos.fabricante,
          unidade: campos.unidade,

          preco: campos.preco,
          preco_promocional: campos.preco_promocional,

          estoque: campos.estoque,

          principio_ativo: campos.principio_ativo,
          registro_ms: campos.registro_ms,

          farmacia_popular: campos.farmacia_popular,
          preco_farmacia_popular: campos.preco_farmacia_popular,

          imagem: campos.imagem,

          disponivel: campos.disponivel,
          oferta: campos.oferta,
          rasga_preco: campos.rasga_preco,

          informacoes: campos.informacoes,
        })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      return {
        id,
      };
    }

    /* ========================================================
       CRIAR NOVO PRODUTO
       ======================================================== */

    const { data: criado, error } = await context.supabase
      .from("produtos")
      .insert({
        codigo: campos.codigo,
        codigo_barras: campos.codigo_barras,

        nome: campos.nome,
        descricao: campos.descricao,

        categoria_slug: campos.categoria_slug,
        subcategoria_slug: campos.subcategoria_slug,

        fabricante: campos.fabricante,
        unidade: campos.unidade,

        preco: campos.preco,
        preco_promocional: campos.preco_promocional,

        estoque: campos.estoque,

        principio_ativo: campos.principio_ativo,
        registro_ms: campos.registro_ms,

        farmacia_popular: campos.farmacia_popular,
        preco_farmacia_popular: campos.preco_farmacia_popular,

        imagem: campos.imagem,

        disponivel: campos.disponivel,
        oferta: campos.oferta,
        rasga_preco: campos.rasga_preco,

        informacoes: campos.informacoes,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: criado.id as string,
    };
  });

/* ============================================================
   OFERTA / RASGA PREÇO
   ============================================================ */

export const marcarDestaque = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),

        campo: z.enum(["oferta", "rasga_preco"]),

        valor: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const campos =
      data.campo === "oferta"
        ? {
            oferta: data.valor,
          }
        : {
            rasga_preco: data.valor,
          };

    const { error } = await context.supabase.from("produtos").update(campos).eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });

/* ============================================================
   EXCLUIR PRODUTO
   ============================================================ */

export const excluirProduto = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase.from("produtos").delete().eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });

/* ============================================================
   UPLOAD DE IMAGENS
   ============================================================ */

export const enviarImagem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        nomeArquivo: z.string().min(1),
        tipo: z.string().min(1),
        conteudoBase64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const bytes = Uint8Array.from(atob(data.conteudoBase64), (c) => c.charCodeAt(0));

    const extensao = (data.nomeArquivo.split(".").pop() ?? "jpg").toLowerCase();

    const caminho = `${crypto.randomUUID()}.${extensao}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.storage.from("produtos").upload(caminho, bytes, {
      contentType: data.tipo,
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      url: `/api/public/img/${caminho}`,
    };
  });

/* ============================================================
   BANNERS — ADMIN
   ============================================================ */

export const listarBannersAdmin = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data, error } = await context.supabase
      .from("banners")
      .select("*")
      .order("ordem", {
        ascending: true,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
  });

/* ============================================================
   BANNERS — PÚBLICOS
   ============================================================ */

export const listarBannersPublicos = createServerFn({
  method: "GET",
}).handler(async ({ context }) => {
  const { data, error } = await context.supabase
    .from("banners")
    .select("id, titulo, imagem, ativo, ordem")
    .eq("ativo", true)
    .order("ordem", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
});

/* ============================================================
   SALVAR BANNER
   ============================================================ */

export const salvarBanner = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bannerSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { id, ...campos } = data;

    /* ========================================================
       ATUALIZAR
       ======================================================== */

    if (id) {
      const { error } = await context.supabase
        .from("banners")
        .update({
          titulo: campos.titulo,
          imagem: campos.imagem,
          ativo: campos.ativo,
          ordem: campos.ordem,
        })
        .eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      return {
        id,
      };
    }

    /* ========================================================
       CRIAR
       ======================================================== */

    const { data: criado, error } = await context.supabase
      .from("banners")
      .insert({
        titulo: campos.titulo,
        imagem: campos.imagem,
        ativo: campos.ativo,
        ordem: campos.ordem,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: criado.id as string,
    };
  });

/* ============================================================
   EXCLUIR BANNER
   ============================================================ */

export const excluirBanner = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase.from("banners").delete().eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });

/* ============================================================
   ATIVAR / DESATIVAR BANNER
   ============================================================ */

export const alternarBanner = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        ativo: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("banners")
      .update({
        ativo: data.ativo,
      })
      .eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });

/* ============================================================
   ALTERAR ORDEM DO BANNER
   ============================================================ */

export const alterarOrdemBanner = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        ordem: z.number().int(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("banners")
      .update({
        ordem: data.ordem,
      })
      .eq("id", data.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });
