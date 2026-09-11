import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avaliarCandidato, classificar, type Candidato } from "@/lib/images/matching";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (error || !data) {
    throw new Error("Acesso restrito a administradores.");
  }
}

const CAMPOS =
  "id, codigo, nome, fabricante, codigo_barras, categoria_slug, subcategoria_slug, descricao, imagem, image_status, image_source, image_source_url, image_confidence, image_last_synced_at, image_width, image_height, image_format, image_error, image_candidato_url, image_license";

const TAMANHO_PADRAO_LOTE = 20;
const TAMANHO_MAXIMO_LOTE = 10000;
const MAX_CANDIDATOS_POR_PRODUTO = 50;

export const estatisticasImagens = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const contar = async (aplicar: (q: any) => any) => {
      const { count } = await aplicar(
        context.supabase.from("produtos").select("id", {
          count: "exact",
          head: true,
        }),
      );

      return count ?? 0;
    };

    const [total, comImagem, revisao, naoEncontrados, erros, comEan] = await Promise.all([
      contar((q: any) => q),

      contar((q: any) => q.not("imagem", "is", null)),

      contar((q: any) => q.eq("image_status", "manual_review")),

      contar((q: any) => q.eq("image_status", "not_found")),

      contar((q: any) => q.eq("image_status", "error")),

      contar((q: any) => q.not("codigo_barras", "is", null).neq("codigo_barras", "")),
    ]);

    const { data: ultima } = await context.supabase
      .from("produtos")
      .select("image_last_synced_at")
      .not("image_last_synced_at", "is", null)
      .order("image_last_synced_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    return {
      total,
      comImagem,
      semImagem: total - comImagem,
      revisao,
      naoEncontrados,
      erros,
      comEan,
      cobertura: total ? (comImagem / total) * 100 : 0,
      ultimaSincronizacao: ultima?.image_last_synced_at ?? null,
    };
  });

const filtroSchema = z.object({
  filtro: z
    .enum(["todos", "sem_imagem", "com_imagem", "manual_review", "not_found", "error", "approved"])
    .default("sem_imagem"),

  busca: z.string().default(""),

  comEan: z.enum(["qualquer", "sim", "nao"]).default("qualquer"),

  fabricante: z.string().default(""),

  categoria: z.string().default(""),

  subcategoria: z.string().default(""),

  categorias: z.array(z.string()).default([]),

  subcategorias: z.array(z.string()).default([]),

  pagina: z.number().int().min(1).default(1),

  porPagina: z.number().int().min(1).max(100).default(24),
});

function aplicarFiltros(query: any, f: z.infer<typeof filtroSchema>) {
  if (f.filtro === "sem_imagem") {
    query = query.is("imagem", null);
  } else if (f.filtro === "com_imagem") {
    query = query.not("imagem", "is", null);
  } else if (f.filtro !== "todos") {
    query = query.eq("image_status", f.filtro);
  }

  if (f.comEan === "sim") {
    query = query.not("codigo_barras", "is", null).neq("codigo_barras", "");
  }

  if (f.comEan === "nao") {
    query = query.or("codigo_barras.is.null,codigo_barras.eq.");
  }

  if (f.fabricante.trim()) {
    query = query.ilike("fabricante", `%${f.fabricante.trim()}%`);
  }

  const categorias = (f.categorias ?? []).map((c) => c.trim()).filter(Boolean);
  const subcategorias = (f.subcategorias ?? []).map((c) => c.trim()).filter(Boolean);

  if (subcategorias.length > 0) {
    query = query.in("subcategoria_slug", subcategorias);
  } else if (categorias.length > 0) {
    query = query.in("categoria_slug", categorias);
  }

  if (categorias.length === 0 && f.categoria.trim()) {
    query = query.eq("categoria_slug", f.categoria.trim());
  }

  if (subcategorias.length === 0 && f.subcategoria.trim()) {
    query = query.eq("subcategoria_slug", f.subcategoria.trim());
  }

  if (f.busca.trim()) {
    const termo = f.busca.replace(/[%,]/g, " ").trim();

    if (termo) {
      query = query.or(
        `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,codigo_barras.ilike.%${termo}%,fabricante.ilike.%${termo}%`,
      );
    }
  }

  return query;
}

export const listarFiltrosImagens = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const [categoriasResult, subcategoriasResult] = await Promise.all([
      context.supabase.from("categorias").select("slug, nome, ordem").order("ordem", {
        ascending: true,
      }),

      context.supabase.from("subcategorias").select("slug, nome, categoria_slug, ordem").order("ordem", {
        ascending: true,
      }),
    ]);

    if (categoriasResult.error) {
      throw new Error(categoriasResult.error.message);
    }

    if (subcategoriasResult.error) {
      throw new Error(subcategoriasResult.error.message);
    }

    return {
      categorias: categoriasResult.data ?? [],
      subcategorias: subcategoriasResult.data ?? [],
    };
  });

export const listarProdutosImagens = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtroSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const inicio = (data.pagina - 1) * data.porPagina;

    let query = context.supabase.from("produtos").select(CAMPOS, {
      count: "exact",
    });

    query = aplicarFiltros(query, data);

    const {
      data: linhas,
      count,
      error,
    } = await query
      .order("nome", {
        ascending: true,
      })
      .range(inicio, inicio + data.porPagina - 1);

    if (error) {
      throw new Error(error.message);
    }

    return {
      itens: linhas ?? [],
      total: count ?? 0,
    };
  });

function removerCandidatosDuplicados<T extends Candidato>(candidatos: T[]): T[] {
  const urls = new Set<string>();

  const resultado: T[] = [];

  for (const candidato of candidatos) {
    const url = candidato.imageUrl?.trim();

    if (!url) {
      continue;
    }

    const chave = url.toLowerCase().split("?")[0] ?? url.toLowerCase();

    if (urls.has(chave)) {
      continue;
    }

    urls.add(chave);

    resultado.push(candidato);
  }

  return resultado;
}

function ordenarCandidatos<
  T extends Candidato & {
    confianca: number;
    conflito: boolean;
    motivos: string[];
  },
>(candidatos: T[]): T[] {
  return [...candidatos].sort((a, b) => {
    if (b.confianca !== a.confianca) {
      return b.confianca - a.confianca;
    }

    if (a.conflito !== b.conflito) {
      return a.conflito ? 1 : -1;
    }

    const aTemEan = Boolean(a.ean);
    const bTemEan = Boolean(b.ean);

    if (aTemEan !== bTemEan) {
      return aTemEan ? -1 : 1;
    }

    return 0;
  });
}

/** Carrega as fontes ativas do banco (opcionalmente só as escolhidas na pesquisa). */
async function carregarFontes(context: any, fonteIds?: string[]) {
  const { FONTES_PADRAO } = await import("@/lib/images/providers.server");

  try {
    let consulta = context.supabase
      .from("image_sources")
      .select("id, nome, url, ativo, prioridade")
      .eq("ativo", true)
      .order("prioridade", { ascending: true });

    if (fonteIds && fonteIds.length) {
      consulta = consulta.in("id", fonteIds);
    }

    const { data, error } = await consulta;

    if (error || !data || data.length === 0) {
      return FONTES_PADRAO;
    }

    return data.map((f: any) => ({ id: f.id as string, nome: f.nome as string, url: f.url as string }));
  } catch {
    return FONTES_PADRAO;
  }
}

async function candidatosPara(produto: any, termoManual?: string, fontes?: Array<{ id: string; nome: string; url: string }>) {
  const { buscarAte50Imagens } = await import("@/lib/images/providers.server");

  const produtoBusca = termoManual?.trim()
    ? {
        ...produto,
        nome: termoManual.trim(),
      }
    : produto;

  const brutos = await buscarAte50Imagens(
    {
      nome: produtoBusca.nome,
      fabricante: produtoBusca.fabricante,
      codigo_barras: produtoBusca.codigo_barras,
      descricao: produtoBusca.descricao ?? produtoBusca.descricao_produto ?? null,
    },
    fontes,
  );

  const encontrados: Array<
    Candidato & {
      confianca: number;
      conflito: boolean;
      motivos: string[];
    }
  > = [];

  for (const candidato of brutos) {
    try {
      const av = avaliarCandidato(produto, candidato);

      encontrados.push({
        ...candidato,
        confianca: av.confianca,
        conflito: av.conflito,
        motivos: av.motivos,
      });
    } catch {}
  }

  return ordenarCandidatos(removerCandidatosDuplicados(encontrados)).slice(0, MAX_CANDIDATOS_POR_PRODUTO);
}

export const buscarCandidatos = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),

        termo: z.string().optional(),

        fonteIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS)
      .eq("id", data.produtoId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const produto = produtoRaw as any;

    return {
      produto,
      candidatos: await candidatosPara(produto, data.termo, await carregarFontes(context, data.fonteIds)),
    };
  });

async function aplicar(
  context: any,
  produto: any,
  candidato: any,
  confianca: number,
  status: "approved" | "manual_review",
) {
  const { baixarImagem, guardarImagem } = await import("@/lib/images/pipeline.server");

  const imagem = await baixarImagem(candidato.imageUrl);

  const chave = (produto.codigo_barras || "").replace(/\D/g, "") || produto.id;

  if (produto.image_hash === imagem.hash && produto.imagem) {
    return produto.imagem as string;
  }

  const { url } = await guardarImagem(chave, imagem);

  const { error } = await context.supabase
    .from("produtos")
    .update({
      imagem: url,

      image_status: status,

      image_source: candidato.source ?? null,

      image_source_url: candidato.sourceUrl ?? candidato.imageUrl ?? null,

      image_confidence: confianca,

      image_last_synced_at: new Date().toISOString(),

      image_hash: imagem.hash,

      image_width: imagem.largura,

      image_height: imagem.altura,

      image_format: imagem.extensao,

      image_error: null,

      image_candidato_url: null,

      image_license: candidato.licenca ?? null,
    })
    .eq("id", produto.id);

  if (error) {
    throw new Error(error.message);
  }

  return url;
}

async function aplicarPrimeiroCandidatoValido(
  context: any,
  produto: any,
  candidatos: any[],
  status: "approved" | "manual_review" = "approved",
) {
  const erros: string[] = [];

  for (const candidato of candidatos) {
    try {
      const url = await aplicar(context, produto, candidato, candidato.confianca ?? 100, status);
      return { candidato, url, erros };
    } catch (erro) {
      erros.push(erro instanceof Error ? erro.message : "Falha ao validar a imagem");
    }
  }

  return { candidato: null, url: null, erros };
}

async function validarCandidatoImagem(candidato: any) {
  const { baixarImagem } = await import("@/lib/images/pipeline.server");

  try {
    await baixarImagem(candidato.imageUrl);
    return true;
  } catch {
    return false;
  }
}

async function registrarLog(context: any, log: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin.from("imagem_sync_logs").insert(log as any);
}

export const aplicarCandidato = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),

        imageUrl: z.string().url(),

        source: z.string().default("manual"),

        sourceUrl: z.string().optional(),

        licenca: z.string().optional(),

        confianca: z.number().min(0).max(100).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS + ", image_hash")
      .eq("id", data.produtoId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const produto = produtoRaw as any;

    const url = await aplicar(context, produto, data, data.confianca, "approved");

    await registrarLog(context, {
      produto_id: produto.id,
      ean: produto.codigo_barras,
      status: "approved",
      source: data.source,
      image_url: url,
      confidence: data.confianca,
    });

    return { url };
  });

export const sincronizarLote = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        escopo: z.enum(["sem_imagem", "todos", "revisao"]).default("sem_imagem"),

        tamanho: z.number().int().min(1).max(TAMANHO_MAXIMO_LOTE).default(TAMANHO_PADRAO_LOTE),

        forcar: z.boolean().default(false),

        categoria: z.string().default(""),

        subcategoria: z.string().default(""),

        busca: z.string().default(""),

        fabricante: z.string().default(""),

        comEan: z.enum(["qualquer", "sim", "nao"]).default("qualquer"),

        fonteIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let query = context.supabase.from("produtos").select(CAMPOS + ", image_hash");

    if (data.escopo === "sem_imagem") {
      query = query.is("imagem", null);
    }

    if (data.escopo === "revisao") {
      query = query.eq("image_status", "manual_review");
    }

    if (!data.forcar) {
      query = query.neq("image_status", "not_found").neq("image_status", "error");
    }

    if (data.categoria.trim()) {
      query = query.eq("categoria_slug", data.categoria.trim());
    }

    if (data.subcategoria.trim()) {
      query = query.eq("subcategoria_slug", data.subcategoria.trim());
    }

    if (data.fabricante.trim()) {
      query = query.ilike("fabricante", `%${data.fabricante.trim()}%`);
    }

    if (data.comEan === "sim") {
      query = query.not("codigo_barras", "is", null).neq("codigo_barras", "");
    }

    if (data.comEan === "nao") {
      query = query.or("codigo_barras.is.null,codigo_barras.eq.");
    }

    if (data.busca.trim()) {
      const termo = data.busca.replace(/[%,]/g, " ").trim();

      if (termo) {
        query = query.or(
          `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,codigo_barras.ilike.%${termo}%,fabricante.ilike.%${termo}%`,
        );
      }
    }

    const { data: produtosRaw, error } = await query
      .order("image_last_synced_at", {
        ascending: true,
        nullsFirst: true,
      })
      .limit(data.tamanho);

    if (error) {
      throw new Error(error.message);
    }

    const resultado = {
      solicitados: data.tamanho,

      processados: 0,

      aprovados: 0,

      revisao: 0,

      naoEncontrados: 0,

      erros: 0,

      detalhes: [] as Array<{
        nome: string;
        status: string;
        fonte?: string;
        confianca?: number;
      }>,
    };

    const produtos = (produtosRaw ?? []) as any[];

    const CONCORRENCIA = 2;

    const processarProduto = async (produto: any) => {
      const contagem = { aprovados: 0, revisao: 0, naoEncontrados: 0, erros: 0 };
      const detalhes: Array<{ nome: string; status: string; fonte?: string; confianca?: number }> = [];
      const inicio = new Date().toISOString();

      try {
        const candidatos = await candidatosPara(produto, undefined, await carregarFontes(context, data.fonteIds));

        // Busca em todas as fontes e nunca aplica automaticamente no lote.
        // Todo candidato válido vai para revisão manual.
        const aprovaveis: any[] = [];
        const aplicado = { candidato: null, url: null, erros: [] as string[] };

        /*
         * Candidatos para revisão também são testados antes de a URL ser
         * exibida no painel. Isso impede que a prévia receba uma URL 404.
         */
        const pendentes = candidatos;

        let melhorPendente: any = null;

        for (const candidato of pendentes) {
          if (await validarCandidatoImagem(candidato)) {
            melhorPendente = candidato;
            break;
          }
        }

        if (melhorPendente) {
          await context.supabase
            .from("produtos")
            .update({
              imagem: null,
              image_status: "manual_review",
              image_candidato_url: melhorPendente.imageUrl,
              image_source: melhorPendente.source,
              image_source_url: melhorPendente.sourceUrl ?? melhorPendente.imageUrl,
              image_confidence: melhorPendente.confianca,
              image_license: melhorPendente.licenca ?? null,
              image_last_synced_at: new Date().toISOString(),
              image_error: null,
            })
            .eq("id", produto.id);

          contagem.revisao++;

          detalhes.push({
            nome: produto.nome,
            status: "revisão manual",
            fonte: melhorPendente.source,
            confianca: melhorPendente.confianca,
          });

          await registrarLog(context, {
            produto_id: produto.id,
            ean: produto.codigo_barras,
            status: "manual_review",
            source: melhorPendente.source,
            confidence: melhorPendente.confianca,
            started_at: inicio,
          });

          return { contagem, detalhes };
        }

        await context.supabase
          .from("produtos")
          .update({
            imagem: null,
            image_status: "not_found",
            image_candidato_url: null,
            image_last_synced_at: new Date().toISOString(),
            image_error: aplicado.erros.length ? (aplicado.erros[aplicado.erros.length - 1] ?? null) : null,
          })
          .eq("id", produto.id);

        contagem.naoEncontrados++;

        detalhes.push({
          nome: produto.nome,
          status: "não encontrada nos três sites",
        });

        await registrarLog(context, {
          produto_id: produto.id,
          ean: produto.codigo_barras,
          status: "not_found",
          error: aplicado.erros.slice(-1)[0],
          started_at: inicio,
        });

        return { contagem, detalhes };
      } catch (e) {
        const mensagem = e instanceof Error ? e.message : "Erro desconhecido";

        await context.supabase
          .from("produtos")
          .update({
            image_status: "error",

            image_error: mensagem,

            image_last_synced_at: new Date().toISOString(),
          })
          .eq("id", produto.id);

        contagem.erros++;

        detalhes.push({
          nome: produto.nome,

          status: `erro: ${mensagem}`,
        });

        await registrarLog(context, {
          produto_id: produto.id,

          ean: produto.codigo_barras,

          status: "error",

          error: mensagem,

          started_at: inicio,
        });
      }

      return { contagem, detalhes };
    };

    for (let i = 0; i < produtos.length; i += CONCORRENCIA) {
      const grupo = produtos.slice(i, i + CONCORRENCIA);
      const resultadosGrupo = await Promise.all(grupo.map(processarProduto));
      for (const item of resultadosGrupo) {
        resultado.processados++;
        resultado.aprovados += item.contagem.aprovados;
        resultado.revisao += item.contagem.revisao;
        resultado.naoEncontrados += item.contagem.naoEncontrados;
        resultado.erros += item.contagem.erros;
        resultado.detalhes.push(...item.detalhes);
      }
    }
    return {
      ...resultado,

      fim: produtos.length < data.tamanho,
    };
  });

export const aprovarCandidatoPendente = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS + ", image_hash")
      .eq("id", data.produtoId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const produto = produtoRaw as any;

    if (!produto.image_candidato_url) {
      throw new Error("Não há imagem candidata para este produto.");
    }

    const url = await aplicar(
      context,
      produto,
      {
        imageUrl: produto.image_candidato_url,

        source: produto.image_source ?? "manual",

        sourceUrl: produto.image_source_url ?? undefined,

        licenca: produto.image_license ?? undefined,
      },

      produto.image_confidence ?? 100,

      "approved",
    );

    return { url };
  });

export const rejeitarImagem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),

        removerAtual: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const campos: Record<string, unknown> = {
      image_candidato_url: null,

      image_status: "not_found",

      image_last_synced_at: new Date().toISOString(),
    };

    if (data.removerAtual) {
      campos["imagem"] = null;

      campos["image_hash"] = null;

      campos["image_source"] = null;

      campos["image_source_url"] = null;

      campos["image_confidence"] = null;
    }

    const { error } = await context.supabase
      .from("produtos")
      .update(campos as any)
      .eq("id", data.produtoId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      ok: true,
    };
  });

export const excluirImagemProduto = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produto, error: produtoError } = await context.supabase
      .from("produtos")
      .select("id, imagem")
      .eq("id", data.produtoId)
      .single();

    if (produtoError || !produto) {
      throw new Error(produtoError?.message ?? "Produto não encontrado.");
    }

    const imagemAtual = typeof produto.imagem === "string" ? produto.imagem.trim() : "";

    /*
     * Se a imagem foi salva pelo pipeline atual, remove também o arquivo
     * do bucket para não deixar objetos órfãos no Storage.
     */
    const prefixo = "/api/public/img/";

    if (imagemAtual.startsWith(prefixo)) {
      const caminho = imagemAtual.slice(prefixo.length).split("?")[0];

      if (caminho && !caminho.includes("..")) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: erroStorage } = await supabaseAdmin.storage.from("produtos").remove([caminho]);

        if (erroStorage) {
          throw new Error(erroStorage.message);
        }
      }
    }

    const { error } = await context.supabase
      .from("produtos")
      .update({
        imagem: null,
        image_status: "pending",
        image_source: null,
        image_source_url: null,
        image_confidence: null,
        image_hash: null,
        image_width: null,
        image_height: null,
        image_format: null,
        image_error: null,
        image_candidato_url: null,
        image_license: null,
        image_last_synced_at: new Date().toISOString(),
      })
      .eq("id", data.produtoId);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });

export const excluirImagensProdutos = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ produtoIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: produtos, error: leituraError } = await context.supabase
      .from("produtos")
      .select("id, imagem")
      .in("id", data.produtoIds);
    if (leituraError) throw new Error(leituraError.message);
    const caminhos = (produtos ?? [])
      .map((p: any) =>
        typeof p.imagem === "string" && p.imagem.startsWith("/api/public/img/")
          ? p.imagem.slice("/api/public/img/".length).split("?")[0]
          : null,
      )
      .filter((x): x is string => !!x && !x.includes(".."));
    if (caminhos.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: storageError } = await supabaseAdmin.storage.from("produtos").remove(caminhos);
      if (storageError) throw new Error(storageError.message);
    }
    const { error } = await context.supabase
      .from("produtos")
      .update({
        imagem: null,
        image_status: "pending",
        image_source: null,
        image_source_url: null,
        image_confidence: null,
        image_hash: null,
        image_width: null,
        image_height: null,
        image_format: null,
        image_error: null,
        image_candidato_url: null,
        image_license: null,
        image_last_synced_at: new Date().toISOString(),
      })
      .in("id", data.produtoIds);
    if (error) throw new Error(error.message);
    return { ok: true, excluidas: (produtos ?? []).length };
  });

export const enviarImagemProduto = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid().optional(),

        nomeArquivo: z.string().min(1),

        tipo: z.string().min(1),

        conteudoBase64: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { guardarImagem } = await import("@/lib/images/pipeline.server");

    const bytes = Uint8Array.from(atob(data.conteudoBase64), (c) => c.charCodeAt(0));

    let produtoId = data.produtoId;

    const eanArquivo = data.nomeArquivo.replace(/\.[^.]+$/, "").replace(/\D/g, "");

    if (!produtoId) {
      if (eanArquivo.length < 8) {
        throw new Error("Nome do arquivo não contém um EAN válido.");
      }

      const { data: achados, error } = await context.supabase
        .from("produtos")
        .select("id")
        .eq("codigo_barras", eanArquivo)
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      produtoId = achados?.[0]?.id;
    }

    if (!produtoId) {
      throw new Error("Produto não encontrado para esta imagem.");
    }

    const extensao =
      data.tipo === "image/png"
        ? "png"
        : data.tipo === "image/webp"
          ? "webp"
          : data.tipo === "image/gif"
            ? "gif"
            : "jpg";

    const imagem = {
      bytes,

      mime: data.tipo || "image/jpeg",

      extensao,

      largura: null,

      altura: null,

      hash: "",
    };

    const { data: produto, error: produtoError } = await context.supabase
      .from("produtos")
      .select("id, codigo_barras")
      .eq("id", produtoId)
      .single();

    if (produtoError || !produto) {
      throw new Error(produtoError?.message ?? "Produto não encontrado.");
    }

    const chave = (produto.codigo_barras || "").replace(/\D/g, "") || produto.id;

    const { url } = await guardarImagem(chave, imagem as any);

    const { error } = await context.supabase
      .from("produtos")
      .update({
        imagem: url,

        image_status: "approved",

        image_source: "upload_manual",

        image_source_url: null,

        image_confidence: 100,

        image_last_synced_at: new Date().toISOString(),

        image_error: null,

        image_candidato_url: null,
      })
      .eq("id", produtoId);

    if (error) {
      throw new Error(error.message);
    }

    return { url };
  });

/** Processa a busca de imagem de UM produto (usado pela busca em lote com progresso). */
export const processarProdutoImagem = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),

        fonteIds: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS + ", image_hash")
      .eq("id", data.produtoId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const produto = produtoRaw as any;
    const inicio = new Date().toISOString();

    try {
      const candidatos = await candidatosPara(produto, undefined, await carregarFontes(context, data.fonteIds));
      let melhorPendente: any = null;
      for (const candidato of candidatos) {
        if (await validarCandidatoImagem(candidato)) {
          melhorPendente = candidato;
          break;
        }
      }

      if (!melhorPendente) {
        await context.supabase
          .from("produtos")
          .update({
            imagem: null,
            image_status: "not_found",
            image_candidato_url: null,
            image_last_synced_at: new Date().toISOString(),
            image_error: null,
          })
          .eq("id", produto.id);

        await registrarLog(context, {
          produto_id: produto.id,
          ean: produto.codigo_barras,
          status: "not_found",
          started_at: inicio,
        });
        return { produtoId: produto.id, nome: produto.nome, status: "not_found" as const, fonte: null };
      }

      await context.supabase
        .from("produtos")
        .update({
          imagem: null,
          image_status: "manual_review",
          image_candidato_url: melhorPendente.imageUrl,
          image_source: melhorPendente.source,
          image_source_url: melhorPendente.sourceUrl ?? melhorPendente.imageUrl,
          image_confidence: melhorPendente.confianca ?? 0,
          image_license: melhorPendente.licenca ?? null,
          image_last_synced_at: new Date().toISOString(),
          image_error: null,
        })
        .eq("id", produto.id);

      await registrarLog(context, {
        produto_id: produto.id,
        ean: produto.codigo_barras,
        status: "manual_review",
        source: melhorPendente.source,
        image_url: melhorPendente.imageUrl,
        confidence: melhorPendente.confianca ?? 0,
        started_at: inicio,
      });

      return {
        produtoId: produto.id,
        nome: produto.nome,
        status: "manual_review" as const,
        fonte: melhorPendente.source ?? null,
        confianca: melhorPendente.confianca ?? 0,
      };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "Erro desconhecido";

      await context.supabase
        .from("produtos")
        .update({
          image_status: "error",
          image_error: mensagem,
          image_last_synced_at: new Date().toISOString(),
        })
        .eq("id", produto.id);

      await registrarLog(context, {
        produto_id: produto.id,
        ean: produto.codigo_barras,
        status: "error",
        error: mensagem,
        started_at: inicio,
      });

      return { produtoId: produto.id, nome: produto.nome, status: "error" as const, fonte: null, erro: mensagem };
    }
  });

export const listarHistoricoImagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().default("todos"),
        fonte: z.string().default("todas"),
        busca: z.string().default(""),
        pagina: z.number().int().min(1).default(1),
        porPagina: z.number().int().min(1).max(100).default(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const inicio = (data.pagina - 1) * data.porPagina;
    const fim = inicio + data.porPagina - 1;
    let query = context.supabase
      .from("imagem_sync_logs")
      .select("id, produto_id, ean, status, source, image_url, confidence, error, started_at, finished_at", {
        count: "exact",
      });

    if (data.status !== "todos") query = query.eq("status", data.status);
    if (data.fonte !== "todas") query = query.eq("source", data.fonte);

    const busca = data.busca.replace(/[%,]/g, " ").trim();
    if (busca) query = query.or(`ean.ilike.%${busca}%,source.ilike.%${busca}%,status.ilike.%${busca}%`);

    const { data: logs, error, count } = await query
      .order("started_at", { ascending: false })
      .range(inicio, fim);

    if (error) throw new Error(error.message);

    const produtoIds = [...new Set((logs ?? []).map((log) => log.produto_id).filter((id): id is string => !!id))];
    const nomes = new Map<string, { nome: string; codigo: string }>();

    if (produtoIds.length > 0) {
      const { data: produtos, error: produtosError } = await context.supabase
        .from("produtos")
        .select("id, nome, codigo")
        .in("id", produtoIds);

      if (produtosError) throw new Error(produtosError.message);
      for (const produto of produtos ?? []) nomes.set(produto.id, { nome: produto.nome, codigo: produto.codigo });
    }

    const itens = (logs ?? []).map((log) => ({
      ...log,
      produto_nome: log.produto_id ? nomes.get(log.produto_id)?.nome ?? "Produto removido" : "Produto não informado",
      produto_codigo: log.produto_id ? nomes.get(log.produto_id)?.codigo ?? null : null,
    }));

    return { itens, total: count ?? 0 };
  });

/* ==========================================================
 * FONTES PERSONALIZADAS DE PESQUISA
 * ========================================================== */

export const listarFontesImagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const { data, error } = await context.supabase
      .from("image_sources")
      .select("id, nome, url, tipo, ativo, prioridade")
      .order("prioridade", { ascending: true })
      .order("nome", { ascending: true });

    if (error) throw new Error(error.message);

    return { fontes: (data ?? []) as any[] };
  });

function normalizarUrlFonte(valor: string) {
  const bruto = valor.trim();
  const u = new URL(bruto.startsWith("http") ? bruto : `https://${bruto}`);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Endereço inválido.");
  return u.origin;
}

export const salvarFonteImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().trim().min(2).max(80),
        url: z.string().trim().min(4).max(200),
        ativo: z.boolean().default(true),
        prioridade: z.number().int().min(0).max(9999).default(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let url: string;
    try {
      url = normalizarUrlFonte(data.url);
    } catch {
      throw new Error("Endereço do site inválido. Use algo como https://www.exemplo.com.br");
    }

    if (data.id) {
      const { error } = await context.supabase
        .from("image_sources")
        .update({ nome: data.nome, url, ativo: data.ativo, prioridade: data.prioridade })
        .eq("id", data.id);

      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: criada, error } = await context.supabase
      .from("image_sources")
      .insert({ nome: data.nome, url, tipo: "personalizada", ativo: data.ativo, prioridade: data.prioridade })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: (criada as any).id as string };
  });

export const alternarFonteImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase.from("image_sources").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirFonteImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: fonte, error: erroLeitura } = await context.supabase
      .from("image_sources")
      .select("id, tipo")
      .eq("id", data.id)
      .single();

    if (erroLeitura || !fonte) throw new Error(erroLeitura?.message ?? "Fonte não encontrada.");
    if ((fonte as any).tipo !== "personalizada") {
      throw new Error("As fontes padrão não podem ser excluídas. Você pode apenas desativá-las.");
    }

    const { error } = await context.supabase.from("image_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ==========================================================
 * GALERIA DE IMAGENS POR PRODUTO
 * ========================================================== */

export const listarImagensProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ produtoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: imagens, error } = await context.supabase
      .from("produto_imagens")
      .select("id, image_url, source_type, source_name, source_url, is_primary, created_at")
      .eq("produto_id", data.produtoId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { imagens: (imagens ?? []) as any[] };
  });

export const adicionarImagemPorLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        produtoId: z.string().uuid(),
        imageUrl: z.string().url().max(2000),
        fonteNome: z.string().trim().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produto, error: erroProduto } = await context.supabase
      .from("produtos")
      .select("id, codigo_barras")
      .eq("id", data.produtoId)
      .single();

    if (erroProduto || !produto) throw new Error(erroProduto?.message ?? "Produto não encontrado.");

    const { baixarImagem, guardarImagem } = await import("@/lib/images/pipeline.server");

    // Baixa e valida: links quebrados, páginas HTML e formatos não suportados são recusados aqui.
    const imagem = await baixarImagem(data.imageUrl);

    const chave = ((produto as any).codigo_barras || "").replace(/\D/g, "") || (produto as any).id;
    const caminhoChave = `${chave}/gal-${imagem.hash.slice(0, 16)}`;

    const { data: existentes } = await context.supabase
      .from("produto_imagens")
      .select("id, image_url, source_url")
      .eq("produto_id", data.produtoId);

    const jaExiste = (existentes ?? []).some(
      (i: any) =>
        String(i.image_url ?? "").includes(imagem.hash.slice(0, 16)) ||
        String(i.source_url ?? "").split("?")[0] === data.imageUrl.split("?")[0],
    );

    if (jaExiste) {
      return { duplicada: true, url: null as string | null };
    }

    const { url } = await guardarImagem(caminhoChave, imagem);

    const { error } = await context.supabase.from("produto_imagens").insert({
      produto_id: data.produtoId,
      image_url: url,
      source_type: "link",
      source_name: data.fonteNome ?? null,
      source_url: data.imageUrl,
      is_primary: false,
    });

    if (error) throw new Error(error.message);

    return { duplicada: false, url };
  });

export const definirImagemPrincipal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ produtoId: z.string().uuid(), imagemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: imagem, error: erroImagem } = await context.supabase
      .from("produto_imagens")
      .select("id, image_url, source_name, source_url")
      .eq("id", data.imagemId)
      .eq("produto_id", data.produtoId)
      .single();

    if (erroImagem || !imagem) throw new Error(erroImagem?.message ?? "Imagem não encontrada.");

    await context.supabase.from("produto_imagens").update({ is_primary: false }).eq("produto_id", data.produtoId);
    await context.supabase.from("produto_imagens").update({ is_primary: true }).eq("id", data.imagemId);

    const { error } = await context.supabase
      .from("produtos")
      .update({
        imagem: (imagem as any).image_url,
        image_status: "approved",
        image_source: (imagem as any).source_name ?? "link_manual",
        image_source_url: (imagem as any).source_url ?? null,
        image_confidence: 100,
        image_error: null,
        image_candidato_url: null,
        image_last_synced_at: new Date().toISOString(),
      })
      .eq("id", data.produtoId);

    if (error) throw new Error(error.message);
    return { url: (imagem as any).image_url as string };
  });

export const excluirImagemGaleria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ imagemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: imagem, error: erroImagem } = await context.supabase
      .from("produto_imagens")
      .select("id, produto_id, image_url, is_primary")
      .eq("id", data.imagemId)
      .single();

    if (erroImagem || !imagem) throw new Error(erroImagem?.message ?? "Imagem não encontrada.");

    const url = String((imagem as any).image_url ?? "");
    const prefixo = "/api/public/img/";

    if (url.startsWith(prefixo)) {
      const caminho = url.slice(prefixo.length).split("?")[0];

      if (caminho && !caminho.includes("..")) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.from("produtos").remove([caminho]);
      }
    }

    const { error } = await context.supabase.from("produto_imagens").delete().eq("id", data.imagemId);
    if (error) throw new Error(error.message);

    if ((imagem as any).is_primary) {
      await context.supabase
        .from("produtos")
        .update({ imagem: null, image_status: "pending", image_last_synced_at: new Date().toISOString() })
        .eq("id", (imagem as any).produto_id);
    }

    return { ok: true };
  });
