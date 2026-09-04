import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  avaliarCandidato,
  classificar,
  type Candidato,
} from "@/lib/images/matching";

async function assertAdmin(context: {
  supabase: any;
  userId: string;
}) {
  const { data, error } = await context.supabase.rpc(
    "has_role",
    {
      _user_id: context.userId,
      _role: "admin",
    },
  );

  if (error || !data) {
    throw new Error(
      "Acesso restrito a administradores.",
    );
  }
}

const CAMPOS =
  "id, codigo, nome, fabricante, codigo_barras, categoria_slug, imagem, image_status, image_source, image_source_url, image_confidence, image_last_synced_at, image_width, image_height, image_format, image_error, image_candidato_url, image_license";

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

const MAX_CANDIDATOS_POR_PRODUTO = 20;

const TAMANHO_PADRAO_LOTE = 20;

/* ============================================================
   ESTATÍSTICAS
   ============================================================ */

export const estatisticasImagens = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const contar = async (
      aplicar: (q: any) => any,
    ) => {
      const { count } = await aplicar(
        context.supabase
          .from("produtos")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          ),
      );

      return count ?? 0;
    };

    const [
      total,
      comImagem,
      revisao,
      naoEncontrados,
      erros,
      comEan,
    ] = await Promise.all([
      contar((q: any) => q),

      contar((q: any) =>
        q.not(
          "imagem",
          "is",
          null,
        ),
      ),

      contar((q: any) =>
        q.eq(
          "image_status",
          "manual_review",
        ),
      ),

      contar((q: any) =>
        q.eq(
          "image_status",
          "not_found",
        ),
      ),

      contar((q: any) =>
        q.eq(
          "image_status",
          "error",
        ),
      ),

      contar((q: any) =>
        q
          .not(
            "codigo_barras",
            "is",
            null,
          )
          .neq(
            "codigo_barras",
            "",
          ),
      ),
    ]);

    const { data: ultima } =
      await context.supabase
        .from("produtos")
        .select(
          "image_last_synced_at",
        )
        .not(
          "image_last_synced_at",
          "is",
          null,
        )
        .order(
          "image_last_synced_at",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

    return {
      total,

      comImagem,

      semImagem:
        total -
        comImagem,

      revisao,

      naoEncontrados,

      erros,

      comEan,

      cobertura:
        total
          ? (
              comImagem /
              total
            ) *
            100
          : 0,

      ultimaSincronizacao:
        ultima?.image_last_synced_at ??
        null,
    };
  });

/* ============================================================
   FILTROS
   ============================================================ */

const filtroSchema =
  z.object({
    filtro: z
      .enum([
        "todos",
        "sem_imagem",
        "com_imagem",
        "manual_review",
        "not_found",
        "error",
        "approved",
      ])
      .default(
        "sem_imagem",
      ),

    busca:
      z.string().default(
        "",
      ),

    comEan: z
      .enum([
        "qualquer",
        "sim",
        "nao",
      ])
      .default(
        "qualquer",
      ),

    fabricante:
      z.string().default(
        "",
      ),

    categoria:
      z.string().default(
        "",
      ),

    pagina: z
      .number()
      .int()
      .min(1)
      .default(1),

    porPagina: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(24),
  });

function aplicarFiltros(
  query: any,
  f: z.infer<
    typeof filtroSchema
  >,
) {
  if (
    f.filtro ===
    "sem_imagem"
  ) {
    query = query.is(
      "imagem",
      null,
    );
  } else if (
    f.filtro ===
    "com_imagem"
  ) {
    query = query.not(
      "imagem",
      "is",
      null,
    );
  } else if (
    f.filtro !==
    "todos"
  ) {
    query = query.eq(
      "image_status",
      f.filtro,
    );
  }

  if (
    f.comEan ===
    "sim"
  ) {
    query = query
      .not(
        "codigo_barras",
        "is",
        null,
      )
      .neq(
        "codigo_barras",
        "",
      );
  }

  if (
    f.comEan ===
    "nao"
  ) {
    query = query.or(
      "codigo_barras.is.null,codigo_barras.eq.",
    );
  }

  if (
    f.fabricante
  ) {
    query = query.ilike(
      "fabricante",
      `%${f.fabricante}%`,
    );
  }

  if (
    f.categoria
  ) {
    query = query.eq(
      "categoria_slug",
      f.categoria,
    );
  }

  if (
    f.busca
  ) {
    const termo =
      f.busca
        .replace(
          /[%,]/g,
          " ",
        )
        .trim();

    if (
      termo
    ) {
      query = query.or(
        `nome.ilike.%${termo}%,codigo.ilike.%${termo}%,codigo_barras.ilike.%${termo}%`,
      );
    }
  }

  return query;
}

/* ============================================================
   LISTAGEM DE PRODUTOS
   ============================================================ */

export const listarProdutosImagens =
  createServerFn({
    method: "GET",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        filtroSchema.parse(
          input,
        ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const inicio =
          (
            data.pagina -
            1
          ) *
          data.porPagina;

        let query =
          context.supabase
            .from(
              "produtos",
            )
            .select(
              CAMPOS,
              {
                count:
                  "exact",
              },
            );

        query =
          aplicarFiltros(
            query,
            data,
          );

        const {
          data: linhas,
          count,
          error,
        } =
          await query
            .order(
              "imagem",
              {
                ascending: false,
                nullsFirst: false,
              },
            )
            .order(
              "image_confidence",
              {
                ascending: false,
                nullsFirst: false,
              },
            )
            .order(
              "image_last_synced_at",
              {
                ascending: false,
                nullsFirst: false,
              },
            )
            .order(
              "nome",
              {
                ascending: true,
              },
            )
            .range(
              inicio,
              inicio +
                data.porPagina -
                1,
            );

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        return {
          itens:
            linhas ??
            [],

          total:
            count ??
            0,
        };
      },
    );

/* ============================================================
   REMOVER DUPLICADOS
   ============================================================ */

function chaveDaImagem(
  url: string,
): string {
  try {
    const parsed =
      new URL(
        url,
      );

    return `${parsed.origin}${parsed.pathname}`
      .toLowerCase()
      .trim();
  } catch {
    return url
      .toLowerCase()
      .trim()
      .split("?")[0]
      .split("#")[0];
  }
}

function removerCandidatosDuplicados<
  T extends Candidato,
>(
  candidatos: T[],
): T[] {
  const urls =
    new Set<string>();

  const resultado:
    T[] =
    [];

  for (
    const candidato
    of candidatos
  ) {
    const url =
      candidato.imageUrl?.trim();

    if (
      !url
    ) {
      continue;
    }

    const chave =
      chaveDaImagem(
        url,
      );

    if (
      !chave ||
      urls.has(
        chave,
      )
    ) {
      continue;
    }

    urls.add(
      chave,
    );

    resultado.push(
      candidato,
    );
  }

  return resultado;
}

/* ============================================================
   PRIORIDADE DAS FONTES
   ============================================================ */

function prioridadeFonte(
  source:
    | string
    | undefined,
): number {
  const fonte =
    (
      source ??
      ""
    )
      .toLowerCase()
      .trim();

  const prioridades:
    Record<
      string,
      number
    > = {
    google_images: 100,

    pague_menos: 95,

    farmacia_permanente: 90,

    drogasil: 85,

    droga_raia: 80,

    cosmos: 70,

    open_beauty_facts: 60,

    open_products_facts: 55,

    open_food_facts: 50,

    manual: 100,
  };

  return (
    prioridades[
      fonte
    ] ??
    10
  );
}

/* ============================================================
   ORDENAÇÃO DOS CANDIDATOS
   ============================================================ */

type CandidatoAvaliado =
  Candidato & {
    confianca: number;

    conflito: boolean;

    motivos: string[];

    eanConfirmado?: boolean;
  };

function ordenarCandidatos(
  candidatos: CandidatoAvaliado[],
): CandidatoAvaliado[] {
  return [
    ...candidatos,
  ].sort(
    (
      a,
      b,
    ) => {
      const aEan =
        Boolean(
          a.eanConfirmado,
        );

      const bEan =
        Boolean(
          b.eanConfirmado,
        );

      if (
        aEan !==
        bEan
      ) {
        return aEan
          ? -1
          : 1;
      }

      const prioridadeA =
        prioridadeFonte(
          a.source,
        );

      const prioridadeB =
        prioridadeFonte(
          b.source,
        );

      if (
        prioridadeB !==
        prioridadeA
      ) {
        return (
          prioridadeB -
          prioridadeA
        );
      }

      if (
        b.confianca !==
        a.confianca
      ) {
        return (
          b.confianca -
          a.confianca
        );
      }

      if (
        a.conflito !==
        b.conflito
      ) {
        return a.conflito
          ? 1
          : -1;
      }

      const aTemEan =
        Boolean(
          a.ean,
        );

      const bTemEan =
        Boolean(
          b.ean,
        );

      if (
        aTemEan !==
        bTemEan
      ) {
        return aTemEan
          ? -1
          : 1;
      }

      return 0;
    },
  );
}

/* ============================================================
   BUSCA CENTRALIZADA DE CANDIDATOS
   ============================================================ */

async function candidatosPara(
  produto: any,
  termoManual?: string,
): Promise<
  CandidatoAvaliado[]
> {
  const {
    buscarAte20Imagens,
  } =
    await import(
      "@/lib/images/providers.server"
    );

  const produtoParaBusca = {
    ...produto,

    nome:
      termoManual?.trim() ||
      produto.nome,

    fabricante:
      produto.fabricante ??
      "",

    codigo_barras:
      produto.codigo_barras ??
      "",
  };

  const brutos =
    await buscarAte20Imagens(
      produtoParaBusca,
    );

  const encontrados:
    CandidatoAvaliado[] =
    [];

  for (
    const candidato
    of brutos
  ) {
    try {
      const avaliacao =
        avaliarCandidato(
          produto,
          candidato,
        );

      encontrados.push({
        ...candidato,

        confianca:
          avaliacao.confianca,

        conflito:
          avaliacao.conflito,

        motivos:
          avaliacao.motivos,

        eanConfirmado:
          avaliacao.eanConfirmado,
      });
    } catch {
      continue;
    }
  }

  const semDuplicados =
    removerCandidatosDuplicados(
      encontrados,
    );

  const ordenados =
    ordenarCandidatos(
      semDuplicados,
    );

  return ordenados.slice(
    0,
    MAX_CANDIDATOS_POR_PRODUTO,
  );
}

/* ============================================================
   BUSCAR CANDIDATOS
   ============================================================ */

export const buscarCandidatos =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            produtoId:
              z
                .string()
                .uuid(),

            termo:
              z
                .string()
                .optional(),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const {
          data: produtoRaw,
          error,
        } =
          await context.supabase
            .from(
              "produtos",
            )
            .select(
              CAMPOS,
            )
            .eq(
              "id",
              data.produtoId,
            )
            .single();

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        const produto =
          produtoRaw as any;

        const candidatos =
          await candidatosPara(
            produto,
            data.termo,
          );

        return {
          produto,

          candidatos,

          total:
            candidatos.length,
        };
      },
    );

/* ============================================================
   APLICAR IMAGEM
   ============================================================ */

async function aplicar(
  context: any,
  produto: any,
  candidato: any,
  confianca: number,
  status:
    | "approved"
    | "manual_review",
) {
  const {
    baixarImagem,
    guardarImagem,
  } =
    await import(
      "@/lib/images/pipeline.server"
    );

  const imagem =
    await baixarImagem(
      candidato.imageUrl,
    );

  const chave =
    (
      produto.codigo_barras ||
      ""
    ).replace(
      /\D/g,
      "",
    ) ||
    produto.id;

  if (
    produto.image_hash ===
      imagem.hash &&
    produto.imagem
  ) {
    return produto.imagem as string;
  }

  const { url } =
    await guardarImagem(
      chave,
      imagem,
    );

  const { error } =
    await context.supabase
      .from(
        "produtos",
      )
      .update({
        imagem:
          url,

        image_status:
          status,

        image_source:
          candidato.source,

        image_source_url:
          candidato.sourceUrl ??
          candidato.imageUrl,

        image_confidence:
          confianca,

        image_last_synced_at:
          new Date().toISOString(),

        image_hash:
          imagem.hash,

        image_width:
          imagem.largura,

        image_height:
          imagem.altura,

        image_format:
          imagem.extensao,

        image_error:
          null,

        image_candidato_url:
          null,

        image_license:
          candidato.licenca ??
          null,
      })
      .eq(
        "id",
        produto.id,
      );

  if (
    error
  ) {
    throw new Error(
      error.message,
    );
  }

  return url;
}

/* ============================================================
   LOG
   ============================================================ */

async function registrarLog(
  context: any,
  log: Record<
    string,
    unknown
  >,
) {
  const {
    supabaseAdmin,
  } =
    await import(
      "@/integrations/supabase/client.server"
    );

  await supabaseAdmin
    .from(
      "imagem_sync_logs",
    )
    .insert(
      log as any,
    );
}

/* ============================================================
   APLICAR CANDIDATO MANUALMENTE
   ============================================================ */

export const aplicarCandidato =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            produtoId:
              z
                .string()
                .uuid(),

            imageUrl:
              z
                .string()
                .url(),

            source:
              z
                .string()
                .default(
                  "manual",
                ),

            sourceUrl:
              z
                .string()
                .optional(),

            licenca:
              z
                .string()
                .optional(),

            confianca:
              z
                .number()
                .min(0)
                .max(100)
                .default(100),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const {
          data: produtoRaw,
          error,
        } =
          await context.supabase
            .from(
              "produtos",
            )
            .select(
              CAMPOS +
                ", image_hash",
            )
            .eq(
              "id",
              data.produtoId,
            )
            .single();

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        const produto =
          produtoRaw as any;

        const url =
          await aplicar(
            context,
            produto,
            data,
            data.confianca,
            "approved",
          );

        await registrarLog(
          context,
          {
            produto_id:
              produto.id,

            ean:
              produto.codigo_barras,

            status:
              "approved",

            source:
              data.source,

            image_url:
              url,

            confidence:
              data.confianca,
          },
        );

        return {
          url,
        };
      },
    );

/* ============================================================
   SINCRONIZAÇÃO EM LOTE
   ============================================================ */

export const sincronizarLote =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            escopo: z
              .enum([
                "sem_imagem",
                "todos",
                "revisao",
              ])
              .default(
                "sem_imagem",
              ),

            tamanho: z
              .number()
              .int()
              .min(1)
              .max(100)
              .default(
                TAMANHO_PADRAO_LOTE,
              ),

            forcar:
              z
                .boolean()
                .default(
                  false,
                ),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        let query =
          context.supabase
            .from(
              "produtos",
            )
            .select(
              CAMPOS +
                ", image_hash",
            );

        if (
          data.escopo ===
          "sem_imagem"
        ) {
          query =
            query.is(
              "imagem",
              null,
            );
        }

        if (
          data.escopo ===
          "revisao"
        ) {
          query =
            query.eq(
              "image_status",
              "manual_review",
            );
        }

        if (
          !data.forcar
        ) {
          query =
            query
              .neq(
                "image_status",
                "not_found",
              )
              .neq(
                "image_status",
                "error",
              );
        }

        const {
          data: produtosRaw,
          error,
        } =
          await query
            .order(
              "codigo_barras",
              {
                ascending: false,
                nullsFirst: false,
              },
            )
            .order(
              "image_last_synced_at",
              {
                ascending: true,
                nullsFirst: true,
              },
            )
            .limit(
              data.tamanho,
            );

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        const resultado = {
          processados:
            0,

          aprovados:
            0,

          revisao:
            0,

          naoEncontrados:
            0,

          erros:
            0,

          detalhes:
            [] as Array<{
              nome: string;

              status: string;

              fonte?: string;

              confianca?: number;
            }>,
        };

        const produtos =
          (
            produtosRaw ??
            []
          ) as any[];

        for (
          const produto
          of produtos
        ) {
          const inicio =
            new Date().toISOString();

          resultado.processados++;

          try {
            const candidatos =
              await candidatosPara(
                produto,
              );

            const melhor =
              candidatos[0];

            if (
              !melhor
            ) {
              await context.supabase
                .from(
                  "produtos",
                )
                .update({
                  image_status:
                    "not_found",

                  image_last_synced_at:
                    new Date().toISOString(),

                  image_error:
                    null,
                })
                .eq(
                  "id",
                  produto.id,
                );

              resultado.naoEncontrados++;

              resultado.detalhes.push(
                {
                  nome:
                    produto.nome,

                  status:
                    "não encontrada",
                },
              );

              await registrarLog(
                context,
                {
                  produto_id:
                    produto.id,

                  ean:
                    produto.codigo_barras,

                  status:
                    "not_found",

                  started_at:
                    inicio,
                },
              );

              continue;
            }

            const decisao =
              classificar({
                confianca:
                  melhor.confianca,

                conflito:
                  melhor.conflito,

                motivos:
                  melhor.motivos,

                eanConfirmado:
                  melhor.eanConfirmado ??
                  false,
              });

            if (
              decisao ===
              "approved"
            ) {
              await aplicar(
                context,
                produto,
                melhor,
                melhor.confianca,
                "approved",
              );

              resultado.aprovados++;

              resultado.detalhes.push(
                {
                  nome:
                    produto.nome,

                  status:
                    "aprovada",

                  fonte:
                    melhor.source,

                  confianca:
                    melhor.confianca,
                },
              );

              await registrarLog(
                context,
                {
                  produto_id:
                    produto.id,

                  ean:
                    produto.codigo_barras,

                  status:
                    "approved",

                  source:
                    melhor.source,

                  confidence:
                    melhor.confianca,

                  started_at:
                    inicio,
                },
              );
            } else if (
              decisao ===
              "manual_review"
            ) {
              await context.supabase
                .from(
                  "produtos",
                )
                .update({
                  image_status:
                    "manual_review",

                  image_candidato_url:
                    melhor.imageUrl,

                  image_source:
                    melhor.source,

                  image_source_url:
                    melhor.sourceUrl ??
                    melhor.imageUrl,

                  image_confidence:
                    melhor.confianca,

                  image_license:
                    melhor.licenca ??
                    null,

                  image_last_synced_at:
                    new Date().toISOString(),
                })
                .eq(
                  "id",
                  produto.id,
                );

              resultado.revisao++;

              resultado.detalhes.push(
                {
                  nome:
                    produto.nome,

                  status:
                    "revisão manual",

                  fonte:
                    melhor.source,

                  confianca:
                    melhor.confianca,
                },
              );

              await registrarLog(
                context,
                {
                  produto_id:
                    produto.id,

                  ean:
                    produto.codigo_barras,

                  status:
                    "manual_review",

                  source:
                    melhor.source,

                  confidence:
                    melhor.confianca,

                  started_at:
                    inicio,
                },
              );
            } else {
              await context.supabase
                .from(
                  "produtos",
                )
                .update({
                  image_status:
                    "not_found",

                  image_last_synced_at:
                    new Date().toISOString(),
                })
                .eq(
                  "id",
                  produto.id,
                );

              resultado.naoEncontrados++;

              resultado.detalhes.push(
                {
                  nome:
                    produto.nome,

                  status:
                    "descartada (baixa confiança)",
                },
              );
            }
          } catch (
            erro,
          ) {
            const mensagem =
              erro instanceof Error
                ? erro.message
                : "Erro desconhecido";

            await context.supabase
              .from(
                "produtos",
              )
              .update({
                image_status:
                  "error",

                image_error:
                  mensagem,

                image_last_synced_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                produto.id,
              );

            resultado.erros++;

            resultado.detalhes.push(
              {
                nome:
                  produto.nome,

                status:
                  `erro: ${mensagem}`,
              },
            );

            await registrarLog(
              context,
              {
                produto_id:
                  produto.id,

                ean:
                  produto.codigo_barras,

                status:
                  "error",

                error:
                  mensagem,

                started_at:
                  inicio,
              },
            );
          }
        }

        return {
          ...resultado,

          fim:
            produtos.length <
            data.tamanho,
        };
      },
    );

/* ============================================================
   APROVAR CANDIDATO PENDENTE
   ============================================================ */

export const aprovarCandidatoPendente =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            produtoId:
              z
                .string()
                .uuid(),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const {
          data: produtoRaw,
          error,
        } =
          await context.supabase
            .from(
              "produtos",
            )
            .select(
              CAMPOS +
                ", image_hash",
            )
            .eq(
              "id",
              data.produtoId,
            )
            .single();

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        const produto =
          produtoRaw as any;

        if (
          !produto.image_candidato_url
        ) {
          throw new Error(
            "Não há imagem candidata para este produto.",
          );
        }

        const url =
          await aplicar(
            context,
            produto,
            {
              imageUrl:
                produto.image_candidato_url,

              source:
                produto.image_source ??
                "manual",

              sourceUrl:
                produto.image_source_url ??
                undefined,

              licenca:
                produto.image_license ??
                undefined,
            },

            produto.image_confidence ??
              100,

            "approved",
          );

        return {
          url,
        };
      },
    );

/* ============================================================
   REJEITAR IMAGEM
   ============================================================ */

export const rejeitarImagem =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            produtoId:
              z
                .string()
                .uuid(),

            removerAtual:
              z
                .boolean()
                .default(
                  false,
                ),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const campos:
          Record<
            string,
            unknown
          > = {
          image_candidato_url:
            null,

          image_status:
            "not_found",

          image_last_synced_at:
            new Date().toISOString(),
        };

        if (
          data.removerAtual
        ) {
          campos.imagem =
            null;

          campos.image_hash =
            null;

          campos.image_source =
            null;

          campos.image_source_url =
            null;

          campos.image_confidence =
            null;
        }

        const { error } =
          await context.supabase
            .from(
              "produtos",
            )
            .update(
              campos as any,
            )
            .eq(
              "id",
              data.produtoId,
            );

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        return {
          ok: true,
        };
      },
    );

/* ============================================================
   UPLOAD MANUAL
   ============================================================ */

export const enviarImagemProduto =
  createServerFn({
    method: "POST",
  })
    .middleware([
      requireSupabaseAuth,
    ])
    .inputValidator(
      (
        input: unknown,
      ) =>
        z
          .object({
            produtoId:
              z
                .string()
                .uuid()
                .optional(),

            nomeArquivo:
              z
                .string()
                .min(1),

            tipo:
              z
                .string()
                .min(1),

            conteudoBase64:
              z
                .string()
                .min(1),
          })
          .parse(
            input,
          ),
    )
    .handler(
      async ({
        data,
        context,
      }) => {
        await assertAdmin(
          context,
        );

        const {
          guardarImagem,
        } =
          await import(
            "@/lib/images/pipeline.server"
          );

        const bytes =
          Uint8Array.from(
            atob(
              data.conteudoBase64,
            ),
            (
              caractere,
            ) =>
              caractere.charCodeAt(
                0,
              ),
          );

        let produtoId =
          data.produtoId;

        const eanArquivo =
          data.nomeArquivo
            .replace(
              /\.[^.]+$/,
              "",
            )
            .replace(
              /\D/g,
              "",
            );

        if (
          !produtoId
        ) {
          if (
            eanArquivo.length <
            8
          ) {
            throw new Error(
              "Nome do arquivo não contém um EAN válido.",
            );
          }

          const {
            data: achados,
            error,
          } =
            await context.supabase
              .from(
                "produtos",
              )
              .select(
                "id",
              )
              .eq(
                "codigo_barras",
                eanArquivo,
              )
              .limit(2);

          if (
            error
          ) {
            throw new Error(
              error.message,
            );
          }

          if (
            !achados?.length
          ) {
            throw new Error(
              `Nenhum produto com o EAN ${eanArquivo}.`,
            );
          }

          if (
            achados.length >
            1
          ) {
            throw new Error(
              `Mais de um produto com o EAN ${eanArquivo}.`,
            );
          }

          produtoId =
            achados[0]!.id as string;
        }

        const {
          data: produtoRaw,
          error: erroProduto,
        } =
          await context.supabase
            .from(
              "produtos",
            )
            .select(
              "id, codigo_barras",
            )
            .eq(
              "id",
              produtoId,
            )
            .single();

        if (
          erroProduto
        ) {
          throw new Error(
            erroProduto.message,
          );
        }

        const produto =
          produtoRaw as any;

        const extensao =
          (
            data.nomeArquivo
              .split(
                ".",
              )
              .pop() ??
            "jpg"
          ).toLowerCase();

        const hashBuffer =
          await crypto.subtle.digest(
            "SHA-256",
            bytes as unknown as ArrayBuffer,
          );

        const hash =
          Array.from(
            new Uint8Array(
              hashBuffer,
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

        const chave =
          (
            produto.codigo_barras ||
            ""
          ).replace(
            /\D/g,
            "",
          ) ||
          produto.id;

        const { url } =
          await guardarImagem(
            chave,
            {
              bytes,

              mime:
                data.tipo,

              extensao,

              largura:
                null,

              altura:
                null,

              hash,
            },
          );

        const { error } =
          await context.supabase
            .from(
              "produtos",
            )
            .update({
              imagem:
                url,

              image_status:
                "approved",

              image_source:
                "manual",

              image_source_url:
                null,

              image_confidence:
                100,

              image_hash:
                hash,

              image_format:
                extensao,

              image_error:
                null,

              image_candidato_url:
                null,

              image_last_synced_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              produto.id,
            );

        if (
          error
        ) {
          throw new Error(
            error.message,
          );
        }

        return {
          url,

          produtoId:
            produto.id as string,
        };
      },
    );