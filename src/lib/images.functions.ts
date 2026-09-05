// ============================================================
// SUBSTITUA APENAS ESTA FUNÇÃO NO ARQUIVO:
//
// src/lib/images.functions.ts
//
// PROCURE POR:
//
// export const sincronizarLote = createServerFn({
//
// E SUBSTITUA A FUNÇÃO INTEIRA POR ESTA.
//
// ESTA NOVA VERSÃO PROCESSA 10 PRODUTOS AO MESMO TEMPO.
// ============================================================

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

    const produtos = (produtosRaw ?? []) as any[];

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

    /**
     * Quantos produtos
     * serão processados
     * simultaneamente.
     *
     * AUMENTE PARA 15 OU 20
     * SE O SERVIDOR SUPORTAR.
     */
    const CONCORRENCIA = 10;

    /**
     * Processa um produto.
     */
    const processarProduto = async (produto: any) => {
      const inicio = new Date().toISOString();

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

          return {
            nome: produto.nome,
            tipo: "naoEncontrado",
            detalhe: {
              nome: produto.nome,
              status: "não encontrada",
            },
          };
        }

        const decisao = classificar({
          confianca: melhor.confianca,

          conflito: melhor.conflito,

          motivos: melhor.motivos,
        });

        if (decisao === "approved") {
          await aplicar(context, produto, melhor, melhor.confianca, "approved");

          await registrarLog(context, {
            produto_id: produto.id,

            ean: produto.codigo_barras,

            status: "approved",

            source: melhor.source,

            confidence: melhor.confianca,

            started_at: inicio,
          });

          return {
            nome: produto.nome,

            tipo: "aprovado",

            detalhe: {
              nome: produto.nome,

              status: "aprovada",

              fonte: melhor.source,

              confianca: melhor.confianca,
            },
          };
        }

        if (decisao === "manual_review") {
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

          await registrarLog(context, {
            produto_id: produto.id,

            ean: produto.codigo_barras,

            status: "manual_review",

            source: melhor.source,

            confidence: melhor.confianca,

            started_at: inicio,
          });

          return {
            nome: produto.nome,

            tipo: "revisao",

            detalhe: {
              nome: produto.nome,

              status: "revisão manual",

              fonte: melhor.source,

              confianca: melhor.confianca,
            },
          };
        }

        await context.supabase
          .from("produtos")
          .update({
            image_status: "not_found",

            image_last_synced_at: new Date().toISOString(),
          })
          .eq("id", produto.id);

        return {
          nome: produto.nome,

          tipo: "naoEncontrado",

          detalhe: {
            nome: produto.nome,

            status: "descartada (baixa confiança)",
          },
        };
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido";

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

        return {
          nome: produto.nome,

          tipo: "erro",

          detalhe: {
            nome: produto.nome,

            status: `erro: ${mensagem}`,
          },
        };
      }
    };

    /**
     * Processamento em grupos.
     *
     * Exemplo:
     *
     * Produtos 1 até 10
     *      ↓
     * TODOS PROCESSADOS
     * AO MESMO TEMPO
     *
     * Depois:
     *
     * Produtos 11 até 20
     */
    for (let inicio = 0; inicio < produtos.length; inicio += CONCORRENCIA) {
      const grupo = produtos.slice(inicio, inicio + CONCORRENCIA);

      const resultadosGrupo = await Promise.all(grupo.map(processarProduto));

      for (const item of resultadosGrupo) {
        resultado.processados++;

        resultado.detalhes.push(item.detalhe);

        if (item.tipo === "aprovado") {
          resultado.aprovados++;
        }

        if (item.tipo === "revisao") {
          resultado.revisao++;
        }

        if (item.tipo === "naoEncontrado") {
          resultado.naoEncontrados++;
        }

        if (item.tipo === "erro") {
          resultado.erros++;
        }
      }
    }

    return {
      ...resultado,

      fim: produtos.length < data.tamanho,
    };
  });
