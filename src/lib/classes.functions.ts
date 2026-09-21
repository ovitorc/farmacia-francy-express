import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/catalog";

const filtrosSchema = z.object({
  pagina: z.number().int().min(1).default(1),
  porPagina: z.number().int().min(1).max(100).default(20),
  busca: z.string().max(120).default(""),
  categoriaId: z.string().uuid().nullable().default(null),
  subcategoriaId: z.string().uuid().nullable().default(null),
  status: z.enum(["todos", "sem_categoria", "sem_subcategoria", "completa"]).default("todos"),
});

type ContextoAdmin = { supabase: any; userId: string };
type Filtros = z.infer<typeof filtrosSchema>;

async function assertAdmin(context: ContextoAdmin) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito a administradores.");
}

function buscaSegura(valor: string) {
  return valor.replace(/[%,()]/g, " ").replace(/\s+/g, " ").trim();
}

function aplicarFiltros(query: any, filtros: Filtros) {
  const busca = buscaSegura(filtros.busca);
  if (busca) {
    query = query.or(
      `codigo.ilike.%${busca}%,codigo_original.ilike.%${busca}%,codigo_barras.ilike.%${busca}%,nome.ilike.%${busca}%,descricao.ilike.%${busca}%,fabricante.ilike.%${busca}%,categoria_slug.ilike.%${busca}%,subcategoria_slug.ilike.%${busca}%`,
    );
  }
  if (filtros.categoriaId) query = query.eq("categoria_id", filtros.categoriaId);
  if (filtros.subcategoriaId) query = query.eq("subcategoria_id", filtros.subcategoriaId);
  if (filtros.status === "sem_categoria") query = query.is("categoria_id", null);
  if (filtros.status === "sem_subcategoria") query = query.not("categoria_id", "is", null).is("subcategoria_id", null);
  if (filtros.status === "completa") {
    query = query.not("categoria_id", "is", null).not("subcategoria_id", "is", null);
  }
  return query;
}

async function validarClassificacao(context: ContextoAdmin, categoriaId: string | null, subcategoriaId: string | null) {
  if (!categoriaId && subcategoriaId) throw new Error("Escolha uma categoria antes da subcategoria.");
  if (!categoriaId) return;
  const { data: categoria, error: erroCategoria } = await context.supabase
    .from("categorias")
    .select("id")
    .eq("id", categoriaId)
    .maybeSingle();
  if (erroCategoria || !categoria) throw new Error("Categoria inválida.");
  if (!subcategoriaId) return;
  const { data: subcategoria, error } = await context.supabase
    .from("subcategorias")
    .select("id")
    .eq("id", subcategoriaId)
    .eq("categoria_id", categoriaId)
    .maybeSingle();
  if (error || !subcategoria) throw new Error("A subcategoria não pertence à categoria selecionada.");
}

export const listarClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtrosSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const inicio = (data.pagina - 1) * data.porPagina;
    let query = context.supabase.from("produtos").select(
      "id,codigo,codigo_original,nome,descricao,fabricante,preco,disponivel,imagem,categoria_id,subcategoria_id,categoria_slug,subcategoria_slug",
      { count: "exact" },
    );
    query = aplicarFiltros(query, data);
    const { data: itens, count, error } = await query
      .order("nome", { ascending: true })
      .range(inicio, inicio + data.porPagina - 1);
    if (error) throw new Error(error.message);
    return { itens: itens ?? [], total: count ?? 0 };
  });

export const listarEstruturaClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [categoriasResult, subcategoriasResult, semCategoria, semSubcategoria, completa] = await Promise.all([
      context.supabase
        .from("categorias")
        .select("id,nome,slug,icone,ordem,produtos!produtos_categoria_id_fkey(count)")
        .order("ordem")
        .order("nome"),
      context.supabase
        .from("subcategorias")
        .select("id,categoria_id,nome,slug,ordem,produtos!produtos_subcategoria_id_fkey(count)")
        .order("ordem")
        .order("nome"),
      context.supabase.from("produtos").select("id", { count: "exact", head: true }).is("categoria_id", null),
      context.supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .not("categoria_id", "is", null)
        .is("subcategoria_id", null),
      context.supabase
        .from("produtos")
        .select("id", { count: "exact", head: true })
        .not("categoria_id", "is", null)
        .not("subcategoria_id", "is", null),
    ]);
    if (categoriasResult.error) throw new Error(categoriasResult.error.message);
    if (subcategoriasResult.error) throw new Error(subcategoriasResult.error.message);

    const categorias = (categoriasResult.data ?? []).map(({ produtos, ...categoria }: any) => ({
      ...categoria,
      quantidade: produtos?.[0]?.count ?? 0,
    }));
    const subcategorias = (subcategoriasResult.data ?? []).map(({ produtos, ...subcategoria }: any) => ({
      ...subcategoria,
      quantidade: produtos?.[0]?.count ?? 0,
    }));
    return {
      categorias,
      subcategorias,
      contadores: {
        semCategoria: semCategoria.count ?? 0,
        semSubcategoria: semSubcategoria.count ?? 0,
        completa: completa.count ?? 0,
      },
    };
  });

const classificacaoSchema = z.object({
  categoriaId: z.string().uuid().nullable(),
  subcategoriaId: z.string().uuid().nullable(),
});

export const salvarClassificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => classificacaoSchema.extend({ produtoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await validarClassificacao(context, data.categoriaId, data.subcategoriaId);
    const { error } = await context.supabase
      .from("produtos")
      .update({ categoria_id: data.categoriaId, subcategoria_id: data.subcategoriaId })
      .eq("id", data.produtoId);
    if (error) throw new Error(error.message);
    return { atualizados: 1 };
  });

export const classificarSelecionados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    classificacaoSchema.extend({ produtoIds: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await validarClassificacao(context, data.categoriaId, data.subcategoriaId);
    const { data: atualizados, error } = await context.supabase
      .from("produtos")
      .update({ categoria_id: data.categoriaId, subcategoria_id: data.subcategoriaId })
      .in("id", data.produtoIds)
      .select("id");
    if (error) throw new Error(error.message);
    return { atualizados: atualizados?.length ?? 0 };
  });

export const classificarResultados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ filtros: filtrosSchema.omit({ pagina: true, porPagina: true }), classificacao: classificacaoSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await validarClassificacao(context, data.classificacao.categoriaId, data.classificacao.subcategoriaId);
    let query = context.supabase
      .from("produtos")
      .update({
        categoria_id: data.classificacao.categoriaId,
        subcategoria_id: data.classificacao.subcategoriaId,
      });
    query = aplicarFiltros(query, { ...data.filtros, pagina: 1, porPagina: 20 });
    const { data: atualizados, error } = await query.select("id");
    if (error) throw new Error(error.message);
    return { atualizados: atualizados?.length ?? 0 };
  });

const nomeSchema = z.string().trim().min(2).max(80);

export const salvarCategoriaClasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().optional(), nome: nomeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase.from("categorias").update({ nome: data.nome }).eq("id", data.id);
      if (error) throw new Error(error.code === "23505" ? "Já existe uma categoria com esse nome." : error.message);
      return { id: data.id };
    }
    const slugBase = slugify(data.nome);
    const { data: existente } = await context.supabase.from("categorias").select("id").eq("slug", slugBase).maybeSingle();
    if (existente) throw new Error("Já existe uma categoria com esse nome.");
    const { data: criada, error } = await context.supabase
      .from("categorias")
      .insert({ nome: data.nome, slug: slugBase, icone: "ETIQUETA" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: criada.id as string };
  });

export const salvarSubcategoriaClasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), categoriaId: z.string().uuid(), nome: nomeSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { data: atual } = await context.supabase.from("subcategorias").select("categoria_id").eq("id", data.id).single();
      if (!atual || atual.categoria_id !== data.categoriaId) throw new Error("Subcategoria inválida.");
      const { error } = await context.supabase.from("subcategorias").update({ nome: data.nome }).eq("id", data.id);
      if (error) throw new Error(error.code === "23505" ? "Já existe uma subcategoria com esse nome." : error.message);
      return { id: data.id };
    }
    const { data: categoria } = await context.supabase
      .from("categorias")
      .select("slug")
      .eq("id", data.categoriaId)
      .single();
    if (!categoria) throw new Error("Categoria inválida.");
    const slug = slugify(data.nome);
    const { data: existente } = await context.supabase
      .from("subcategorias")
      .select("id")
      .eq("categoria_id", data.categoriaId)
      .eq("slug", slug)
      .maybeSingle();
    if (existente) throw new Error("Já existe uma subcategoria com esse nome nessa categoria.");
    const { data: criada, error } = await context.supabase
      .from("subcategorias")
      .insert({ categoria_id: data.categoriaId, categoria_slug: categoria.slug, nome: data.nome, slug })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: criada.id as string };
  });

export const excluirClasse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tipo: z.enum(["categoria", "subcategoria"]), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const coluna = data.tipo === "categoria" ? "categoria_id" : "subcategoria_id";
    const tabela = data.tipo === "categoria" ? "categorias" : "subcategorias";
    const { count } = await context.supabase
      .from("produtos")
      .select("id", { count: "exact", head: true })
      .eq(coluna, data.id);
    if ((count ?? 0) > 0) throw new Error(`Não é possível excluir: há ${count} produto(s) vinculado(s).`);
    if (data.tipo === "categoria") {
      const { count: subs } = await context.supabase
        .from("subcategorias")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", data.id);
      if ((subs ?? 0) > 0) throw new Error(`Não é possível excluir: há ${subs} subcategoria(s) vinculada(s).`);
    }
    const { error } = await context.supabase.from(tabela).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });