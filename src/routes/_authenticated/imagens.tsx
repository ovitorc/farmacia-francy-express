import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  estatisticasImagens,
  listarProdutosImagens,
  buscarCandidatos,
  aplicarCandidato,
  sincronizarLote,
  aprovarCandidatoPendente,
  rejeitarImagem,
  enviarImagemProduto,
} from "@/lib/images.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ============================================================
   ROTA
   ============================================================ */

export const Route =
  createFileRoute(
    "/_authenticated/imagens",
  )({
    head: () => ({
      meta: [
        {
          title:
            "Imagens dos produtos | Farmácias Francy",
        },
        {
          name:
            "description",

          content:
            "Busca automática e curadoria das imagens do catálogo.",
        },
        {
          name:
            "robots",

          content:
            "noindex",
        },
      ],
    }),

    component:
      ImagensPage,
  });

/* ============================================================
   TIPOS
   ============================================================ */

type Filtro =
  | "todos"
  | "sem_imagem"
  | "com_imagem"
  | "manual_review"
  | "not_found"
  | "error"
  | "approved";

/* ============================================================
   CONFIGURAÇÕES
   ============================================================ */

const PRODUTOS_POR_PAGINA =
  24;

const PRODUTOS_POR_LOTE =
  20;

const MAXIMO_IMAGENS =
  20;

/* ============================================================
   PRIORIDADE DAS FONTES
   ============================================================ */

function nomeDaFonte(
  source?: string,
): string {
  const fontes:
    Record<
      string,
      string
    > = {
    google_images:
      "Google Images",

    pague_menos:
      "Pague Menos",

    farmacia_permanente:
      "Farmácia Permanente",

    drogasil:
      "Drogasil",

    droga_raia:
      "Droga Raia",

    cosmos:
      "Cosmos Bluesoft",

    open_food_facts:
      "Open Food Facts",

    open_beauty_facts:
      "Open Beauty Facts",

    open_products_facts:
      "Open Products Facts",

    manual:
      "Manual",
  };

  return (
    fontes[
      source ??
      ""
    ] ??
    source ??
    "Fonte desconhecida"
  );
}

function prioridadeFonte(
  source?: string,
): number {
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
      source ??
      ""
    ] ??
    0
  );
}

/* ============================================================
   PÁGINA
   ============================================================ */

function ImagensPage() {
  const qc =
    useQueryClient();

  /* ==========================================================
     SERVER FUNCTIONS
     ========================================================== */

  const fnEstatisticas =
    useServerFn(
      estatisticasImagens,
    );

  const fnListar =
    useServerFn(
      listarProdutosImagens,
    );

  const fnCandidatos =
    useServerFn(
      buscarCandidatos,
    );

  const fnAplicar =
    useServerFn(
      aplicarCandidato,
    );

  const fnLote =
    useServerFn(
      sincronizarLote,
    );

  const fnAprovar =
    useServerFn(
      aprovarCandidatoPendente,
    );

  const fnRejeitar =
    useServerFn(
      rejeitarImagem,
    );

  const fnEnviar =
    useServerFn(
      enviarImagemProduto,
    );

  /* ==========================================================
     FILTROS
     ========================================================== */

  const [
    filtro,
    setFiltro,
  ] =
    useState<Filtro>(
      "sem_imagem",
    );

  const [
    busca,
    setBusca,
  ] =
    useState(
      "",
    );

  const [
    termoBusca,
    setTermoBusca,
  ] =
    useState(
      "",
    );

  const [
    pagina,
    setPagina,
  ] =
    useState(
      1,
    );

  /* ==========================================================
     PRODUTO SELECIONADO
     ========================================================== */

  const [
    selecionado,
    setSelecionado,
  ] =
    useState<any | null>(
      null,
    );

  const [
    candidatos,
    setCandidatos,
  ] =
    useState<any[]>(
      [],
    );

  const [
    carregandoCandidatos,
    setCarregandoCandidatos,
  ] =
    useState(
      false,
    );

  const [
    termoManual,
    setTermoManual,
  ] =
    useState(
      "",
    );

  /* ==========================================================
     LOTE
     ========================================================== */

  const [
    lote,
    setLote,
  ] =
    useState<any | null>(
      null,
    );

  const [
    rodandoLote,
    setRodandoLote,
  ] =
    useState(
      false,
    );

  /* ==========================================================
     ESTATÍSTICAS
     ========================================================== */

  const estat =
    useQuery({
      queryKey: [
        "imagens",
        "estatisticas",
      ],

      queryFn:
        () =>
          fnEstatisticas(
            {},
          ),
    });

  /* ==========================================================
     LISTA
     ========================================================== */

  const lista =
    useQuery({
      queryKey: [
        "imagens",
        "lista",
        filtro,
        termoBusca,
        pagina,
      ],

      queryFn:
        () =>
          fnListar({
            data: {
              filtro,

              busca:
                termoBusca,

              comEan:
                "qualquer",

              fabricante:
                "",

              categoria:
                "",

              pagina,

              porPagina:
                PRODUTOS_POR_PAGINA,
            },
          }),
    });

  /* ==========================================================
     ATUALIZAR
     ========================================================== */

  const atualizar =
    () => {
      void qc.invalidateQueries({
        queryKey:
          ["imagens"],
      });
    };

  /* ==========================================================
     ABRIR PRODUTO
     ========================================================== */

  const abrirProduto =
    async (
      produto: any,
    ) => {
      setSelecionado(
        produto,
      );

      setCandidatos(
        [],
      );

      setTermoManual(
        "",
      );

      setCarregandoCandidatos(
        true,
      );

      try {
        const resposta =
          await fnCandidatos({
            data: {
              produtoId:
                produto.id,
            },
          });

        const listaOrdenada =
          [
            ...(
              resposta.candidatos ??
              []
            ),
          ]
            .sort(
              (
                a,
                b,
              ) => {
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

                return (
                  Number(
                    b.confianca ??
                      0,
                  ) -
                  Number(
                    a.confianca ??
                      0,
                  )
                );
              },
            )
            .slice(
              0,
              MAXIMO_IMAGENS,
            );

        setCandidatos(
          listaOrdenada,
        );
      } catch (
        erro,
      ) {
        toast.error(
          erro instanceof Error
            ? erro.message
            : "Falha ao buscar imagens.",
        );
      } finally {
        setCarregandoCandidatos(
          false,
        );
      }
    };

  /* ==========================================================
     BUSCA MANUAL
     ========================================================== */

  const buscarComTermo =
    async () => {
      if (
        !selecionado
      ) {
        return;
      }

      setCarregandoCandidatos(
        true,
      );

      try {
        const resposta =
          await fnCandidatos({
            data: {
              produtoId:
                selecionado.id,

              termo:
                termoManual,
            },
          });

        const listaOrdenada =
          [
            ...(
              resposta.candidatos ??
              []
            ),
          ]
            .sort(
              (
                a,
                b,
              ) => {
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

                return (
                  Number(
                    b.confianca ??
                      0,
                  ) -
                  Number(
                    a.confianca ??
                      0,
                  )
                );
              },
            )
            .slice(
              0,
              MAXIMO_IMAGENS,
            );

        setCandidatos(
          listaOrdenada,
        );
      } catch (
        erro,
      ) {
        toast.error(
          erro instanceof Error
            ? erro.message
            : "Falha na busca.",
        );
      } finally {
        setCarregandoCandidatos(
          false,
        );
      }
    };

  /* ==========================================================
     APLICAR IMAGEM
     ========================================================== */

  const aplicarMutation =
    useMutation({
      mutationFn:
        (candidato: any) => {
          if (
            !selecionado
          ) {
            throw new Error(
              "Nenhum produto selecionado.",
            );
          }

          return fnAplicar({
            data: {
              produtoId:
                selecionado.id,

              imageUrl:
                candidato.imageUrl,

              source:
                candidato.source ??
                "manual",

              sourceUrl:
                candidato.sourceUrl,

              licenca:
                candidato.licenca,

              confianca:
                Math.round(
                  Number(
                    candidato.confianca ??
                      100,
                  ),
                ),
            },
          });
        },

      onSuccess:
        () => {
          toast.success(
            "Imagem aplicada ao produto.",
          );

          setSelecionado(
            null,
          );

          setCandidatos(
            [],
          );

          atualizar();
        },

      onError:
        (
          erro: any,
        ) => {
          toast.error(
            erro?.message ??
              "Falha ao aplicar imagem.",
          );
        },
    });

  /* ==========================================================
     ENVIAR ARQUIVO
     ========================================================== */

  const enviarArquivo =
    async (
      produtoId: string,
      arquivo: File,
    ) => {
      const base64 =
        await new Promise<
          string
        >(
          (
            resolve,
            reject,
          ) => {
            const reader =
              new FileReader();

            reader.onload =
              () => {
                const resultado =
                  String(
                    reader.result ??
                      "",
                  );

                resolve(
                  resultado.split(
                    ",",
                  )[1] ??
                    "",
                );
              };

            reader.onerror =
              reject;

            reader.readAsDataURL(
              arquivo,
            );
          },
        );

      try {
        await fnEnviar({
          data: {
            produtoId,

            nomeArquivo:
              arquivo.name,

            tipo:
              arquivo.type ||
              "image/jpeg",

            conteudoBase64:
              base64,
          },
        });

        toast.success(
          "Imagem enviada com sucesso.",
        );

        setSelecionado(
          null,
        );

        setCandidatos(
          [],
        );

        atualizar();
      } catch (
        erro,
      ) {
        toast.error(
          erro instanceof Error
            ? erro.message
            : "Falha no envio.",
        );
      }
    };

  /* ==========================================================
     RODAR LOTE
     ========================================================== */

  const rodarLote =
    async (
      escopo:
        | "sem_imagem"
        | "revisao"
        | "todos",
    ) => {
      setRodandoLote(
        true,
      );

      setLote(
        null,
      );

      try {
        const resposta =
          await fnLote({
            data: {
              escopo,

              tamanho:
                PRODUTOS_POR_LOTE,

              forcar:
                false,
            },
          });

        setLote(
          resposta,
        );

        atualizar();

        toast.success(
          `${resposta.processados} produtos processados.`,
        );
      } catch (
        erro,
      ) {
        toast.error(
          erro instanceof Error
            ? erro.message
            : "Falha na sincronização.",
        );
      } finally {
        setRodandoLote(
          false,
        );
      }
    };

  /* ==========================================================
     VARIÁVEIS
     ========================================================== */

  const estatisticas =
    estat.data;

  const itens =
    lista.data?.itens ??
    [];

  const total =
    lista.data?.total ??
    0;

  const paginas =
    Math.max(
      1,
      Math.ceil(
        total /
          PRODUTOS_POR_PAGINA,
      ),
    );

  /* ==========================================================
     INTERFACE
     ========================================================== */

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">

      {/* ======================================================
          CABEÇALHO
         ====================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>
          <h1 className="text-2xl font-bold text-primary">
            Imagens dos produtos
          </h1>

          <p className="text-sm text-muted-foreground">
            Busca automática por código de barras, Google Images e sites de farmácia.
          </p>
        </div>

        <Button
          variant="outline"
          asChild
        >
          <Link to="/admin">
            Voltar ao painel
          </Link>
        </Button>

      </div>

      {/* ======================================================
          ESTATÍSTICAS
         ====================================================== */}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">

        {[
          [
            "Produtos",
            estatisticas?.total,
          ],

          [
            "Com imagem",
            estatisticas?.comImagem,
          ],

          [
            "Sem imagem",
            estatisticas?.semImagem,
          ],

          [
            "Em revisão",
            estatisticas?.revisao,
          ],

          [
            "Não encontradas",
            estatisticas?.naoEncontrados,
          ],

          [
            "Cobertura",
            estatisticas
              ? `${estatisticas.cobertura.toFixed(1)}%`
              : undefined,
          ],
        ].map(
          (
            [
              rotulo,
              valor,
            ],
          ) => (
            <div
              key={
                String(
                  rotulo,
                )
              }
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">
                {rotulo}
              </p>

              <p className="text-lg font-semibold text-primary">
                {valor ??
                  "—"}
              </p>
            </div>
          ),
        )}

      </div>

      {/* ======================================================
          SINCRONIZAÇÃO EM LOTE
         ====================================================== */}

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">

        <h2 className="text-lg font-semibold text-primary">
          Sincronização automática
        </h2>

        <p className="text-sm text-muted-foreground">
          Processa {PRODUTOS_POR_LOTE} produtos por vez e busca até {MAXIMO_IMAGENS} imagens para cada produto.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">

          <Button
            disabled={
              rodandoLote
            }
            onClick={() =>
              rodarLote(
                "sem_imagem",
              )
            }
          >
            {rodandoLote
              ? "Processando…"
              : `Buscar imagens para ${PRODUTOS_POR_LOTE} produtos`}
          </Button>

          <Button
            variant="outline"
            disabled={
              rodandoLote
            }
            onClick={() =>
              rodarLote(
                "revisao",
              )
            }
          >
            Reprocessar revisão
          </Button>

          <Button
            variant="outline"
            disabled={
              rodandoLote
            }
            onClick={() =>
              rodarLote(
                "todos",
              )
            }
          >
            Processar todos
          </Button>

        </div>

        {lote ? (
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">

            <p>
              Processados:{" "}
              {lote.processados}
              {" · "}
              Aprovados:{" "}
              {lote.aprovados}
              {" · "}
              Revisão:{" "}
              {lote.revisao}
              {" · "}
              Não encontradas:{" "}
              {lote.naoEncontrados}
              {" · "}
              Erros:{" "}
              {lote.erros}
            </p>

            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">

              {lote.detalhes?.map(
                (
                  detalhe: any,
                  indice: number,
                ) => (
                  <li
                    key={
                      indice
                    }
                  >
                    <strong>
                      {detalhe.nome}
                    </strong>
                    {" — "}
                    {detalhe.status}

                    {detalhe.fonte
                      ? ` (${nomeDaFonte(
                          detalhe.fonte,
                        )}${
                          detalhe.confianca !==
                          undefined
                            ? `, ${detalhe.confianca}%`
                            : ""
                        })`
                      : ""}
                  </li>
                ),
              )}

            </ul>

          </div>
        ) : null}

      </section>

      {/* ======================================================
          FILTROS
         ====================================================== */}

      <section className="mt-6 flex flex-wrap items-end gap-3">

        <div className="w-48">

          <Label className="text-xs">
            Situação
          </Label>

          <Select
            value={
              filtro
            }
            onValueChange={
              (
                valor,
              ) => {
                setFiltro(
                  valor as Filtro,
                );

                setPagina(
                  1,
                );
              }
            }
          >

            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>

            <SelectContent>

              <SelectItem value="sem_imagem">
                Sem imagem
              </SelectItem>

              <SelectItem value="manual_review">
                Em revisão
              </SelectItem>

              <SelectItem value="not_found">
                Não encontradas
              </SelectItem>

              <SelectItem value="error">
                Com erro
              </SelectItem>

              <SelectItem value="com_imagem">
                Com imagem
              </SelectItem>

              <SelectItem value="todos">
                Todos
              </SelectItem>

            </SelectContent>

          </Select>

        </div>

        <div className="min-w-[220px] flex-1">

          <Label className="text-xs">
            Buscar produto
          </Label>

          <Input
            value={
              busca
            }
            placeholder="Nome, código ou código de barras"
            onChange={
              (
                evento,
              ) =>
                setBusca(
                  evento.target.value,
                )
            }
            onKeyDown={
              (
                evento,
              ) => {
                if (
                  evento.key ===
                  "Enter"
                ) {
                  setTermoBusca(
                    busca,
                  );

                  setPagina(
                    1,
                  );
                }
              }
            }
          />

        </div>

        <Button
          variant="outline"
          onClick={() => {
            setTermoBusca(
              busca,
            );

            setPagina(
              1,
            );
          }}
        >
          Filtrar
        </Button>

      </section>

      {/* ======================================================
          LISTA DE PRODUTOS
         ====================================================== */}

      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">

        {lista.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Carregando produtos…
          </p>
        ) : null}

        {!lista.isLoading &&
        itens.length ===
          0 ? (
          <p className="col-span-full text-sm text-muted-foreground">
            Nenhum produto encontrado.
          </p>
        ) : null}

        {itens.map(
          (
            produto: any,
          ) => (
            <div
              key={
                produto.id
              }
              className="flex flex-col rounded-xl border bg-card p-3 shadow-sm"
            >

              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">

                {produto.imagem ||
                produto.image_candidato_url ? (
                  <img
                    src={
                      produto.imagem ??
                      produto.image_candidato_url
                    }
                    alt={
                      produto.nome
                    }
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Sem foto
                  </span>
                )}

              </div>

              <p className="mt-2 line-clamp-2 text-xs font-medium">
                {produto.nome}
              </p>

              <p className="text-[11px] text-muted-foreground">
                {produto.codigo_barras ||
                  produto.codigo}
              </p>

              {produto.image_source ? (
                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                  {nomeDaFonte(
                    produto.image_source,
                  )}
                </p>
              ) : null}

              <div className="mt-2 flex flex-col gap-1">

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    abrirProduto(
                      produto,
                    )
                  }
                >
                  Buscar até 20 imagens
                </Button>

                {produto.image_status ===
                  "manual_review" &&
                produto.image_candidato_url ? (

                  <div className="flex gap-1">

                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={
                        async () => {
                          try {
                            await fnAprovar({
                              data: {
                                produtoId:
                                  produto.id,
                              },
                            });

                            toast.success(
                              "Imagem aprovada.",
                            );

                            atualizar();
                          } catch (
                            erro,
                          ) {
                            toast.error(
                              erro instanceof Error
                                ? erro.message
                                : "Falha ao aprovar.",
                            );
                          }
                        }
                      }
                    >
                      Aprovar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={
                        async () => {
                          try {
                            await fnRejeitar({
                              data: {
                                produtoId:
                                  produto.id,

                                removerAtual:
                                  false,
                              },
                            });

                            toast.success(
                              "Imagem rejeitada.",
                            );

                            atualizar();
                          } catch (
                            erro,
                          ) {
                            toast.error(
                              erro instanceof Error
                                ? erro.message
                                : "Falha ao rejeitar.",
                            );
                          }
                        }
                      }
                    >
                      Rejeitar
                    </Button>

                  </div>

                ) : null}

              </div>

            </div>
          ),
        )}

      </section>

      {/* ======================================================
          PAGINAÇÃO
         ====================================================== */}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">

        <Button
          variant="outline"
          disabled={
            pagina <=
            1
          }
          onClick={() =>
            setPagina(
              (
                atual,
              ) =>
                atual -
                1,
            )
          }
        >
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          Página {pagina} de{" "}
          {paginas}
          {" · "}
          {total} produtos
        </span>

        <Button
          variant="outline"
          disabled={
            pagina >=
            paginas
          }
          onClick={() =>
            setPagina(
              (
                atual,
              ) =>
                atual +
                1,
            )
          }
        >
          Próxima
        </Button>

      </div>

      {/* ======================================================
          DIÁLOGO DE IMAGENS
         ====================================================== */}

      <Dialog
        open={
          !!selecionado
        }
        onOpenChange={
          (
            aberto,
          ) => {
            if (
              !aberto
            ) {
              setSelecionado(
                null,
              );

              setCandidatos(
                [],
              );

              setTermoManual(
                "",
              );
            }
          }
        }
      >

        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">

          <DialogHeader>

            <DialogTitle>
              {selecionado?.nome}
            </DialogTitle>

          </DialogHeader>

          {/* ==================================================
              INFORMAÇÕES DO PRODUTO
             ================================================== */}

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">

            <p>
              <strong>
                Código:
              </strong>
              {" "}
              {selecionado?.codigo ??
                "—"}
            </p>

            <p>
              <strong>
                Código de barras:
              </strong>
              {" "}
              {selecionado?.codigo_barras ??
                "Não informado"}
            </p>

            <p>
              <strong>
                Imagens encontradas:
              </strong>
              {" "}
              {candidatos.length} de{" "}
              {MAXIMO_IMAGENS}
            </p>

          </div>

          {/* ==================================================
              BUSCA MANUAL
             ================================================== */}

          <div className="flex flex-wrap items-end gap-2">

            <div className="min-w-[220px] flex-1">

              <Label className="text-xs">
                Buscar com outro termo
              </Label>

              <Input
                value={
                  termoManual
                }
                placeholder="Ex.: dipirona 500mg comprimidos"
                onChange={
                  (
                    evento,
                  ) =>
                    setTermoManual(
                      evento.target.value,
                    )
                }
                onKeyDown={
                  (
                    evento,
                  ) => {
                    if (
                      evento.key ===
                      "Enter"
                    ) {
                      void buscarComTermo();
                    }
                  }
                }
              />

            </div>

            <Button
              variant="outline"
              onClick={() =>
                void buscarComTermo()
              }
              disabled={
                carregandoCandidatos
              }
            >
              {carregandoCandidatos
                ? "Procurando…"
                : "Buscar"}
            </Button>

          </div>

          {/* ==================================================
              UPLOAD
             ================================================== */}

          <div className="mt-2">

            <Label className="text-xs">
              Ou envie uma foto do computador
            </Label>

            <Input
              type="file"
              accept="image/*"
              onChange={
                (
                  evento,
                ) => {
                  const arquivo =
                    evento.target
                      .files?.[0];

                  if (
                    arquivo &&
                    selecionado
                  ) {
                    void enviarArquivo(
                      selecionado.id,
                      arquivo,
                    );
                  }
                }
              }
            />

          </div>

          {/* ==================================================
              RESULTADOS
             ================================================== */}

          {carregandoCandidatos ? (

            <div className="mt-6 text-center">

              <p className="text-sm text-muted-foreground">
                Procurando até {MAXIMO_IMAGENS} imagens nas fontes disponíveis…
              </p>

            </div>

          ) : candidatos.length ===
            0 ? (

            <div className="mt-6 rounded-lg border border-dashed p-6 text-center">

              <p className="text-sm text-muted-foreground">
                Nenhuma imagem encontrada.
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Tente pesquisar utilizando outro nome ou envie uma imagem manualmente.
              </p>

            </div>

          ) : (

            <div className="mt-4">

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

                <p className="text-sm font-medium">
                  {candidatos.length} imagens encontradas
                </p>

                <p className="text-xs text-muted-foreground">
                  Ordenadas por relevância, fonte e confiança.
                </p>

              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">

                {candidatos.map(
                  (
                    candidato,
                    indice,
                  ) => (

                    <div
                      key={
                        `${candidato.imageUrl}-${indice}`
                      }
                      className="overflow-hidden rounded-xl border bg-card p-2 shadow-sm"
                    >

                      {/* ======================================
                          POSIÇÃO
                         ====================================== */}

                      <div className="mb-2 flex items-center justify-between">

                        <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                          #{indice + 1}
                        </span>

                        {candidato.eanConfirmado ? (
                          <span className="rounded-full border px-2 py-1 text-[10px] font-semibold">
                            EAN confirmado
                          </span>
                        ) : null}

                      </div>

                      {/* ======================================
                          IMAGEM
                         ====================================== */}

                      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">

                        <img
                          src={
                            candidato.imageUrl
                          }
                          alt={
                            candidato.nome ??
                            `Imagem candidata ${indice + 1}`
                          }
                          className="h-full w-full object-contain"
                          loading="lazy"
                          onError={
                            (
                              evento,
                            ) => {
                              const imagem =
                                evento.currentTarget;

                              imagem.style.display =
                                "none";
                            }
                          }
                        />

                      </div>

                      {/* ======================================
                          INFORMAÇÕES
                         ====================================== */}

                      <div className="mt-2 space-y-1">

                        <p className="truncate text-[11px] font-medium">
                          {nomeDaFonte(
                            candidato.source,
                          )}
                        </p>

                        <p className="text-[10px] text-muted-foreground">

                          Confiança:{" "}

                          {Math.round(
                            Number(
                              candidato.confianca ??
                                0,
                            ),
                          )}
                          %

                        </p>

                        {candidato.conflito ? (

                          <p className="text-[10px] text-muted-foreground">
                            Possível conflito de produto
                          </p>

                        ) : null}

                        {candidato.ean ? (

                          <p className="truncate text-[10px] text-muted-foreground">
                            EAN:{" "}
                            {candidato.ean}
                          </p>

                        ) : null}

                      </div>

                      {/* ======================================
                          USAR IMAGEM
                         ====================================== */}

                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        disabled={
                          aplicarMutation.isPending
                        }
                        onClick={() =>
                          aplicarMutation.mutate(
                            candidato,
                          )
                        }
                      >
                        {aplicarMutation.isPending
                          ? "Aplicando…"
                          : "Usar esta imagem"}
                      </Button>

                    </div>

                  ),
                )}

              </div>

            </div>

          )}

        </DialogContent>

      </Dialog>

    </div>
  );
}