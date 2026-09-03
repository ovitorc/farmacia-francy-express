import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   IMPORTAÇÃO DE ESTOQUE POR PLANILHA
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

const linhaSchema = z.object({
  codigo: z.string(),
  nome: z.string().nullable().default(null),
  preco: z.number().nullable().default(null),
  estoque: z.number().int().nullable().default(null),
  codigo_barras: z.string().nullable().default(null),
  fabricante: z.string().nullable().default(null),
  unidade: z.string().nullable().default(null),
});

export type LinhaImportacao = z.infer<typeof linhaSchema>;

/* ------------------------------------------------------------
   ENVIAR LOTE PARA A ÁREA TEMPORÁRIA
   ------------------------------------------------------------ */

export const enviarLoteImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        linhas: z.array(linhaSchema).min(1).max(3000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("import_estoque_stage")
      .insert(data.linhas.map((l) => ({ ...l, batch_id: data.batchId })));

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true, enviadas: data.linhas.length };
  });

/* ------------------------------------------------------------
   RESUMO (NÃO ALTERA NADA)
   ------------------------------------------------------------ */

export const resumoImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: resumo, error } = await (context.supabase as any).rpc("import_estoque_resumo", {
      _batch: data.batchId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return resumo as {
      linhas: number;
      encontrados: number;
      atualizar: number;
      novos: number;
      excluir: number;
      erros: number;
      duplicados: number;
      total_banco: number;
    };
  });

/* ------------------------------------------------------------
   APLICAR SINCRONIZAÇÃO
   ------------------------------------------------------------ */

export const aplicarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: resultado, error } = await (context.supabase as any).rpc("import_estoque_aplicar", {
      _batch: data.batchId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return resultado as {
      atualizados: number;
      inseridos: number;
      excluidos: number;
      erros: number;
    };
  });

/* ------------------------------------------------------------
   CANCELAR / LIMPAR
   ------------------------------------------------------------ */

export const cancelarImportacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("import_estoque_stage")
      .delete()
      .eq("batch_id", data.batchId);

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
