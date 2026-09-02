import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avaliarCandidato, classificar, type Candidato } from "@/lib/images/matching";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

const CAMPOS =
  "id, codigo, nome, fabricante, codigo_barras, categoria_slug, imagem, image_status, image_source, image_source_url, image_confidence, image_last_synced_at, image_width, image_height, image_format, image_error, image_candidato_url, image_license";

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */

export const estatisticasImagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const contar = async (aplicar: (q: any) => any) => {
      const { count } = await aplicar(
        context.supabase.from("produtos").select("id", { count: "exact", head: true }),
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
      .order("image_last_synced_at", { ascending: false })
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

/* ============================================================
   LISTAGEM COM FILTROS
   ============================================================ */

const filtroSchema = z.object({
  filtro: z
    .enum(["todos", "sem_imagem", "com_imagem", "manual_review", "not_found", "error", "approved"])
    .default("sem_imagem"),
  busca: z.string().default(""),
  comEan: z.enum(["qualquer", "sim", "nao"]).default("qualquer"),
  fabricante: z.string().default(""),
  categoria: z.string().default(""),
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(24),
});

function aplicarFiltros(query: any, f: z.infer<typeof filtroSchema>) {
  if (f.filtro === "sem_imagem") query = query.is("imagem", null);
  else if (f.filtro === "com_imagem") query = query.not("imagem", "is", null);
  else if (f.filtro !== "todos") query = query.eq("image_status", f.filtro);

  if (f.comEan === "sim") query = query.not("codigo_barras", "is", null).neq("codigo_barras", "");
  if (f.comEan === "nao") query = query.or("codigo_barras.is.null,codigo_barras.eq.");

  if (f.fabricante) query = query.ilike("fabricante", `%${f.fabricante}%`);
  if (f.categoria) query = query.eq("categoria_slug", f.categoria);

  if (f.busca) {
    const termo = f.busca.replace(/[%,]/g, " ").trim();
    query = query.or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%,codigo_barras.ilike.%${termo}%`);
  }

  return query;
}

export const listarProdutosImagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtroSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const inicio = (data.pagina - 1) * data.porPagina;

    let query = context.supabase.from("produtos").select(CAMPOS, { count: "exact" });
    query = aplicarFiltros(query, data);

    const { data: linhas, count, error } = await query
      .order("nome", { ascending: true })
      .range(inicio, inicio + data.porPagina - 1);

    if (error) throw new Error(error.message);

    return { itens: linhas ?? [], total: count ?? 0 };
  });

/* ============================================================
   BUSCA DE CANDIDATOS PARA UM PRODUTO
   ============================================================ */

async function candidatosPara(produto: any, termoManual?: string) {
  const { providersAtivos } = await import("@/lib/images/providers.server");

  const ean = (produto.codigo_barras ?? "").replace(/\D/g, "");
  const encontrados: Array<Candidato & { confianca: number; conflito: boolean; motivos: string[] }> = [];

  for (const provider of providersAtivos()) {
    let brutos: Candidato[] = [];

    try {
      if (ean && provider.buscarPorEan) brutos = await provider.buscarPorEan(ean);

      if (!brutos.length && provider.buscarPorNome) {
        brutos = await provider.buscarPorNome({
          nome: termoManual || produto.nome,
          fabricante: produto.fabricante,
          codigo_barras: produto.codigo_barras,
        });
      }
    } catch {
      brutos = [];
    }

    for (const c of brutos) {
      const av = avaliarCandidato(produto, c);

      encontrados.push({
        ...c,
        confianca: provider.licencaSegura ? av.confianca : Math.min(av.confianca, 70),
        conflito: av.conflito,
        motivos: av.motivos,
      });
    }

    // Para de consultar fontes seguintes quando já há resultado forte.
    if (encontrados.some((c) => c.confianca >= 75 && !c.conflito)) break;
  }

  return encontrados.sort((a, b) => b.confianca - a.confianca);
}

export const buscarCandidatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ produtoId: z.string().uuid(), termo: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS)
      .eq("id", data.produtoId)
      .single();

    if (error) throw new Error(error.message);
    const produto = produtoRaw as any;

    return { produto, candidatos: await candidatosPara(produto, data.termo) };
  });

/* ============================================================
   APLICAR UMA IMAGEM (baixa, valida e guarda)
   ============================================================ */

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

  // Idempotência: mesma imagem (hash) já associada → não reenvia.
  if (produto.image_hash === imagem.hash && produto.imagem) {
    return produto.imagem as string;
  }

  const { url } = await guardarImagem(chave, imagem);

  const { error } = await context.supabase
    .from("produtos")
    .update({
      imagem: url,
      image_status: status,
      image_source: candidato.source,
      image_source_url: candidato.sourceUrl ?? candidato.imageUrl,
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

  if (error) throw new Error(error.message);

  return url;
}

async function registrarLog(context: any, log: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("imagem_sync_logs").insert(log as any);
}

export const aplicarCandidato = createServerFn({ method: "POST" })
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

    if (error) throw new Error(error.message);
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

/* ============================================================
   SINCRONIZAÇÃO EM LOTE
   ============================================================ */

export const sincronizarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        escopo: z.enum(["sem_imagem", "todos", "revisao"]).default("sem_imagem"),
        tamanho: z.number().int().min(1).max(30).default(10),
        forcar: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let query = context.supabase.from("produtos").select(CAMPOS + ", image_hash");

    if (data.escopo === "sem_imagem") query = query.is("imagem", null);
    if (data.escopo === "revisao") query = query.eq("image_status", "manual_review");
    if (!data.forcar) query = query.neq("image_status", "not_found").neq("image_status", "error");

    const { data: produtosRaw, error } = await query
      .order("image_last_synced_at", { ascending: true, nullsFirst: true })
      .limit(data.tamanho);

    if (error) throw new Error(error.message);

    const resultado = {
      processados: 0,
      aprovados: 0,
      revisao: 0,
      naoEncontrados: 0,
      erros: 0,
      detalhes: [] as Array<{ nome: string; status: string; fonte?: string; confianca?: number }>,
    };

    const produtos = (produtosRaw ?? []) as any[];

    for (const produto of produtos) {
      const inicio = new Date().toISOString();
      resultado.processados++;

      try {
        const candidatos = await candidatosPara(produto);
        const melhor = candidatos[0];

        if (!melhor) {
          await context.supabase
            .from("produtos")
            .update({
              image_status: "not_found",
              image_last_synced_at: new Date().toISOString(),
              image_error: null,
            })
            .eq("id", produto.id);

          resultado.naoEncontrados++;
          resultado.detalhes.push({ nome: produto.nome, status: "não encontrada" });

          await registrarLog(context, {
            produto_id: produto.id,
            ean: produto.codigo_barras,
            status: "not_found",
            started_at: inicio,
          });

          continue;
        }

        const decisao = classificar({
          confianca: melhor.confianca,
          conflito: melhor.conflito,
          motivos: melhor.motivos,
        });

        if (decisao === "approved") {
          await aplicar(context, produto, melhor, melhor.confianca, "approved");

          resultado.aprovados++;
          resultado.detalhes.push({
            nome: produto.nome,
            status: "aprovada",
            fonte: melhor.source,
            confianca: melhor.confianca,
          });

          await registrarLog(context, {
            produto_id: produto.id,
            ean: produto.codigo_barras,
            status: "approved",
            source: melhor.source,
            confidence: melhor.confianca,
            started_at: inicio,
          });
        } else if (decisao === "manual_review") {
          await context.supabase
            .from("produtos")
            .update({
              image_status: "manual_review",
              image_candidato_url: melhor.imageUrl,
              image_source: melhor.source,
              image_source_url: melhor.sourceUrl ?? melhor.imageUrl,
              image_confidence: melhor.confianca,
              image_license: melhor.licenca ?? null,
              image_last_synced_at: new Date().toISOString(),
            })
            .eq("id", produto.id);

          resultado.revisao++;
          resultado.detalhes.push({
            nome: produto.nome,
            status: "revisão manual",
            fonte: melhor.source,
            confianca: melhor.confianca,
          });

          await registrarLog(context, {
            produto_id: produto.id,
            ean: produto.codigo_barras,
            status: "manual_review",
            source: melhor.source,
            confidence: melhor.confianca,
            started_at: inicio,
          });
        } else {
          await context.supabase
            .from("produtos")
            .update({
              image_status: "not_found",
              image_last_synced_at: new Date().toISOString(),
            })
            .eq("id", produto.id);

          resultado.naoEncontrados++;
          resultado.detalhes.push({ nome: produto.nome, status: "descartada (baixa confiança)" });
        }
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

        resultado.erros++;
        resultado.detalhes.push({ nome: produto.nome, status: `erro: ${mensagem}` });

        await registrarLog(context, {
          produto_id: produto.id,
          ean: produto.codigo_barras,
          status: "error",
          error: mensagem,
          started_at: inicio,
        });
      }
    }

    return { ...resultado, fim: produtos.length < data.tamanho };
  });

/* ============================================================
   REVISÃO MANUAL
   ============================================================ */

export const aprovarCandidatoPendente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ produtoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: produtoRaw, error } = await context.supabase
      .from("produtos")
      .select(CAMPOS + ", image_hash")
      .eq("id", data.produtoId)
      .single();

    if (error) throw new Error(error.message);
    const produto = produtoRaw as any;
    if (!produto.image_candidato_url) throw new Error("Não há imagem candidata para este produto.");

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

export const rejeitarImagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ produtoId: z.string().uuid(), removerAtual: z.boolean().default(false) }).parse(input),
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

    const { error } = await context.supabase.from("produtos").update(campos as any).eq("id", data.produtoId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

/* ============================================================
   UPLOAD MANUAL / EM MASSA POR EAN
   ============================================================ */

export const enviarImagemProduto = createServerFn({ method: "POST" })
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
      if (eanArquivo.length < 8) throw new Error("Nome do arquivo não contém um EAN válido.");

      const { data: achados, error } = await context.supabase
        .from("produtos")
        .select("id")
        .eq("codigo_barras", eanArquivo)
        .limit(2);

      if (error) throw new Error(error.message);
      if (!achados?.length) throw new Error(`Nenhum produto com o EAN ${eanArquivo}.`);
      if (achados.length > 1) throw new Error(`Mais de um produto com o EAN ${eanArquivo}.`);

      produtoId = achados[0]!.id as string;
    }

    const { data: produtoRaw2, error: erroProduto } = await context.supabase
      .from("produtos")
      .select("id, codigo_barras")
      .eq("id", produtoId)
      .single();

    if (erroProduto) throw new Error(erroProduto.message);
    const produto = produtoRaw2 as any;

    const extensao = (data.nomeArquivo.split(".").pop() ?? "jpg").toLowerCase();

    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);

    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const chave = (produto.codigo_barras || "").replace(/\D/g, "") || produto.id;

    const { url } = await guardarImagem(chave, {
      bytes,
      mime: data.tipo,
      extensao,
      largura: null,
      altura: null,
      hash,
    });

    const { error } = await context.supabase
      .from("produtos")
      .update({
        imagem: url,
        image_status: "approved",
        image_source: "manual",
        image_source_url: null,
        image_confidence: 100,
        image_hash: hash,
        image_format: extensao,
        image_error: null,
        image_candidato_url: null,
        image_last_synced_at: new Date().toISOString(),
      })
      .eq("id", produto.id);

    if (error) throw new Error(error.message);

    return { url, produtoId: produto.id as string };
  });
