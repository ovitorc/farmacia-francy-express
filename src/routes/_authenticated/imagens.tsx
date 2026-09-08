import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  estatisticasImagens,
  listarFiltrosImagens,
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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/imagens")({
  head: () => ({
    meta: [
      {
        title: "Imagens dos produtos | Farmácias Francy",
      },
      {
        name: "description",
        content: "Busca e curadoria das imagens do catálogo.",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: ImagensPage,
});

type Filtro = "todos" | "sem_imagem" | "com_imagem" | "manual_review" | "not_found" | "error" | "approved";

const QUANTIDADES_RAPIDAS = [5, 10, 15, 20, 25, 30, 50, 100];

function ImagensPage() {
  const qc = useQueryClient();

  const fnEstatisticas = useServerFn(estatisticasImagens);

  const fnFiltros = useServerFn(listarFiltrosImagens);

  const fnListar = useServerFn(listarProdutosImagens);

  const fnCandidatos = useServerFn(buscarCandidatos);

  const fnAplicar = useServerFn(aplicarCandidato);

  const fnLote = useServerFn(sincronizarLote);

  const fnAprovar = useServerFn(aprovarCandidatoPendente);

  const fnRejeitar = useServerFn(rejeitarImagem);

  const fnEnviar = useServerFn(enviarImagemProduto);

  const [filtro, setFiltro] = useState<Filtro>("sem_imagem");

  const [busca, setBusca] = useState("");

  const [termoBusca, setTermoBusca] = useState("");

  const [categoria, setCategoria] = useState("");
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);

  const [subcategoria, setSubcategoria] = useState("");

  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);

  const [pagina, setPagina] = useState(1);

  const porPagina = 24;

  const [quantidadeLote, setQuantidadeLote] = useState(10);

  const [quantidadePersonalizada, setQuantidadePersonalizada] = useState("");

  const [selecionado, setSelecionado] = useState<any | null>(null);

  const [candidatos, setCandidatos] = useState<any[]>([]);

  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);

  const [termoManual, setTermoManual] = useState("");

  const [lote, setLote] = useState<any | null>(null);

  const [rodandoLote, setRodandoLote] = useState(false);

  const estat = useQuery({
    queryKey: ["imagens", "estatisticas"],

    queryFn: () => fnEstatisticas({}),
  });

  const filtrosDisponiveis = useQuery({
    queryKey: ["imagens", "filtros"],

    queryFn: () => fnFiltros({}),
  });

  const categorias = filtrosDisponiveis.data?.categorias ?? [];

  const subcategorias = filtrosDisponiveis.data?.subcategorias ?? [];

  const subcategoriasFiltradas = useMemo(() => {
    if (!categoria) {
      return subcategorias;
    }

    return subcategorias.filter((item: any) => item.categoria_slug === categoria);
  }, [categoria, subcategorias]);

  const lista = useQuery({
    queryKey: ["imagens", "lista", filtro, termoBusca, categoria, subcategoria, pagina],

    queryFn: () =>
      fnListar({
        data: {
          filtro,

          busca: termoBusca,

          comEan: "qualquer",

          fabricante: "",

          categoria,

          categorias: categoriasSelecionadas,

          subcategoria,

          subcategorias: [],

          pagina,

          porPagina,
        },
      }),
  });

  const atualizar = () => {
    void qc.invalidateQueries({
      queryKey: ["imagens"],
    });
  };

  const selecionarQuantidade = (quantidade: number) => {
    setQuantidadeLote(quantidade);

    setQuantidadePersonalizada("");
  };

  const alterarQuantidadePersonalizada = (valor: string) => {
    setQuantidadePersonalizada(valor);

    if (!valor.trim()) {
      return;
    }

    const numero = Number.parseInt(valor, 10);

    if (Number.isFinite(numero) && numero >= 1) {
      setQuantidadeLote(Math.min(numero, 10000));
    }
  };

  const aplicarFiltros = () => {
    setTermoBusca(busca);

    setPagina(1);
  };

  const limparFiltros = () => {
    setBusca("");

    setTermoBusca("");

    setCategoria("");

    setCategoriasSelecionadas([]);

    setProdutosSelecionados([]);

    setSubcategoria("");

    setFiltro("sem_imagem");

    setPagina(1);
  };

  const alternarProdutoSelecionado = (id: string) => {
    setProdutosSelecionados((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
  };

  const selecionarTodosDaPagina = (marcar: boolean) => {
    const idsPagina = itens.map((produto: any) => produto.id);

    setProdutosSelecionados((atual) => {
      const conjunto = new Set(atual);

      for (const id of idsPagina) {
        if (marcar) conjunto.add(id);
        else conjunto.delete(id);
      }

      return Array.from(conjunto);
    });
  };

  const alternarCategoriaSelecionada = (slug: string) => {
    setCategoriasSelecionadas((atual) =>
      atual.includes(slug) ? atual.filter((item) => item !== slug) : [...atual, slug],
    );
  };

  const abrirProduto = async (produto: any) => {
    setSelecionado(produto);

    setCandidatos([]);

    setTermoManual("");

    setCarregandoCandidatos(true);

    try {
      const r = await fnCandidatos({
        data: {
          produtoId: produto.id,
        },
      });

      setCandidatos(r.candidatos ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar imagens.");
    } finally {
      setCarregandoCandidatos(false);
    }
  };

  const buscarComTermo = async () => {
    if (!selecionado) {
      return;
    }

    setCarregandoCandidatos(true);

    try {
      const r = await fnCandidatos({
        data: {
          produtoId: selecionado.id,

          termo: termoManual,
        },
      });

      setCandidatos(r.candidatos ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na busca.");
    } finally {
      setCarregandoCandidatos(false);
    }
  };

  const aplicarMutation = useMutation({
    mutationFn: (candidato: any) =>
      fnAplicar({
        data: {
          produtoId: selecionado.id,

          imageUrl: candidato.imageUrl,

          source: candidato.source ?? "manual",

          sourceUrl: candidato.sourceUrl,

          licenca: candidato.licenca,

          confianca: Math.round(candidato.confianca ?? 100),
        },
      }),

    onSuccess: () => {
      toast.success("Imagem aplicada ao produto.");

      setSelecionado(null);

      atualizar();
    },

    onError: (erro: any) => {
      toast.error(erro?.message ?? "Falha ao aplicar imagem.");
    },
  });

  const enviarArquivo = async (produtoId: string, file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result).split(",")[1] ?? "");
      };

      reader.onerror = reject;

      reader.readAsDataURL(file);
    });

    try {
      await fnEnviar({
        data: {
          produtoId,

          nomeArquivo: file.name,

          tipo: file.type || "image/jpeg",

          conteudoBase64: base64,
        },
      });

      toast.success("Imagem enviada.");

      setSelecionado(null);

      atualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    }
  };

  const rodarLote = async (escopo: "sem_imagem" | "revisao" | "todos") => {
    if (!Number.isFinite(quantidadeLote) || quantidadeLote < 1) {
      toast.error("Escolha uma quantidade válida.");

      return;
    }

    if (quantidadeLote > 10000) {
      toast.error("O máximo permitido é 10.000 produtos por vez.");

      return;
    }

    setRodandoLote(true);

    setLote(null);

    try {
      const r = await fnLote({
        data: {
          escopo,

          tamanho: quantidadeLote,

          forcar: false,

          categoria,

          subcategoria,

          busca: termoBusca,

          fabricante: "",

          comEan: "qualquer",

          ids: produtosSelecionados,
        },
      });

      setLote(r);

      if (r.processados === 0) {
        toast.info("Nenhum produto encontrado com os filtros selecionados.");
      } else {
        toast.success(`${r.processados} produto(s) processado(s).`);
      }

      atualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na sincronização.");
    } finally {
      setRodandoLote(false);
    }
  };

  const e = estat.data;

  const itens = lista.data?.itens ?? [];

  const total = lista.data?.total ?? 0;

  const paginas = Math.max(1, Math.ceil(total / porPagina));

  const categoriaSelecionada = categorias.find((item: any) => item.slug === categoria);

  const subcategoriaSelecionada = subcategorias.find((item: any) => item.slug === subcategoria);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Imagens dos produtos</h1>

          <p className="text-sm text-muted-foreground">
            Escolha os produtos através dos filtros e procure imagens somente para eles.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link to="/admin">Voltar ao painel</Link>
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {[
          ["Produtos", e?.total],
          ["Com imagem", e?.comImagem],
          ["Sem imagem", e?.semImagem],
          ["Em revisão", e?.revisao],
          ["Não encontradas", e?.naoEncontrados],
          ["Cobertura", e ? `${e.cobertura.toFixed(1)}%` : undefined],
        ].map(([rotulo, valor]) => (
          <div key={String(rotulo)} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{rotulo}</p>

            <p className="text-lg font-semibold text-primary">{valor ?? "—"}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Filtros dos produtos</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          A busca automática de imagens utilizará exatamente os filtros escolhidos abaixo.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Categoria</Label>

            <Select
              value={categoria || "todas"}
              onValueChange={(valor) => {
                const novaCategoria = valor === "todas" ? "" : valor;

                setCategoria(novaCategoria);

                setSubcategoria("");

                setPagina(1);
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>

                {categorias.map((item: any) => (
                  <SelectItem key={item.slug} value={item.slug}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subcategoria</Label>

            <Select
              value={subcategoria || "todas"}
              onValueChange={(valor) => {
                setSubcategoria(valor === "todas" ? "" : valor);

                setPagina(1);
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todas as subcategorias" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="todas">Todas as subcategorias</SelectItem>

                {subcategoriasFiltradas.map((item: any) => (
                  <SelectItem key={item.slug} value={item.slug}>
                    {item.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Situação da imagem</Label>

            <Select
              value={filtro}
              onValueChange={(valor) => {
                setFiltro(valor as Filtro);

                setPagina(1);
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="sem_imagem">Sem imagem</SelectItem>

                <SelectItem value="manual_review">Em revisão</SelectItem>

                <SelectItem value="not_found">Não encontradas</SelectItem>

                <SelectItem value="error">Com erro</SelectItem>

                <SelectItem value="com_imagem">Com imagem</SelectItem>

                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Buscar produto</Label>

            <Input
              className="mt-2"
              value={busca}
              placeholder="Nome, código ou código de barras"
              onChange={(ev) => setBusca(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  aplicarFiltros();
                }
              }}
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Label className="font-medium">Selecionar várias categorias</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque quantas categorias quiser. Os produtos podem ser selecionados individualmente depois.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCategoriasSelecionadas(
                  categoriasSelecionadas.length === categorias.length ? [] : categorias.map((item: any) => item.slug),
                )
              }
            >
              {categoriasSelecionadas.length === categorias.length ? "Desmarcar categorias" : "Selecionar todas"}
            </Button>
          </div>

          <div className="mt-3 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {categorias.map((item: any) => (
              <label
                key={item.slug}
                className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={categoriasSelecionadas.includes(item.slug)}
                  onCheckedChange={() => alternarCategoriaSelecionada(item.slug)}
                />
                <span>{item.nome}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={aplicarFiltros}>Aplicar filtros</Button>

          <Button variant="outline" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>

        {(categoria || subcategoria || termoBusca) && (
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-medium text-primary">Filtros que serão usados na busca das imagens:</p>

            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {categoriaSelecionada && (
                <span className="rounded-full bg-background px-3 py-1">Categoria: {categoriaSelecionada.nome}</span>
              )}

              {subcategoriaSelecionada && (
                <span className="rounded-full bg-background px-3 py-1">
                  Subcategoria: {subcategoriaSelecionada.nome}
                </span>
              )}

              {termoBusca && <span className="rounded-full bg-background px-3 py-1">Busca: {termoBusca}</span>}
            </div>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Seleção dos produtos para busca</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Marque os produtos que deseja pesquisar. Você pode selecionar quantos produtos quiser, inclusive em páginas
          diferentes.
        </p>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-base font-medium">
            Produtos selecionados: <span className="text-primary">{produtosSelecionados.length}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={rodandoLote || produtosSelecionados.length === 0} onClick={() => rodarLote("todos")}>
              {rodandoLote
                ? "Pesquisando em todos os sites…"
                : `Buscar imagens dos ${produtosSelecionados.length} produto${produtosSelecionados.length !== 1 ? "s" : ""} selecionado${produtosSelecionados.length !== 1 ? "s" : ""}`}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={produtosSelecionados.length === 0 || rodandoLote}
              onClick={() => setProdutosSelecionados([])}
            >
              Limpar seleção
            </Button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">
          <p className="font-medium">Busca rápida:</p>
          <p className="mt-1 text-muted-foreground">
            Os produtos selecionados serão processados em paralelo e cada produto será pesquisado simultaneamente em
            todas as fontes configuradas.
          </p>
        </div>

        {lote && (
          <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">Resultado da busca</p>
            <p className="mt-2">
              Solicitados: {lote.solicitados} · Processados: {lote.processados} · Aprovados: {lote.aprovados} · Revisão:{" "}
              {lote.revisao} · Não encontradas: {lote.naoEncontrados} · Erros: {lote.erros}
            </p>
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {lote.detalhes?.map((detalhe: any, indice: number) => (
                <li key={indice}>
                  {detalhe.nome} — {detalhe.status}
                  {detalhe.fonte ? ` (${detalhe.fonte}${detalhe.confianca ? `, ${detalhe.confianca}%` : ""})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Produtos encontrados</h2>

            <p className="text-sm text-muted-foreground">
              {total} produto
              {total !== 1 ? "s" : ""} encontrado
              {total !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              checked={itens.length > 0 && itens.every((produto: any) => produtosSelecionados.includes(produto.id))}
              onCheckedChange={(valor) => selecionarTodosDaPagina(Boolean(valor))}
            />
            <span className="text-sm">Selecionar todos desta página</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {lista.isLoading && <p className="col-span-full text-sm text-muted-foreground">Carregando produtos…</p>}

          {!lista.isLoading && itens.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Nenhum produto encontrado com os filtros selecionados.
            </p>
          )}

          {itens.map((produto: any) => (
            <div
              key={produto.id}
              className={`relative flex flex-col rounded-xl border bg-card p-3 shadow-sm ${produtosSelecionados.includes(produto.id) ? "ring-2 ring-primary" : ""}`}
            >
              <label className="absolute right-2 top-2 z-10 flex cursor-pointer items-center rounded-md bg-background/95 p-1 shadow">
                <Checkbox
                  checked={produtosSelecionados.includes(produto.id)}
                  onCheckedChange={() => alternarProdutoSelecionado(produto.id)}
                />
              </label>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                {produto.imagem || produto.image_candidato_url ? (
                  <img
                    src={produto.imagem ?? produto.image_candidato_url}
                    alt={produto.nome}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">sem foto</span>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-xs font-medium">{produto.nome}</p>

              <p className="text-[11px] text-muted-foreground">{produto.codigo_barras || produto.codigo}</p>

              <div className="mt-2 flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => abrirProduto(produto)}>
                  Buscar imagem
                </Button>

                {produto.image_status === "manual_review" && produto.image_candidato_url && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await fnAprovar({
                            data: {
                              produtoId: produto.id,
                            },
                          });

                          toast.success("Imagem aprovada.");

                          atualizar();
                        } catch (erro) {
                          toast.error(erro instanceof Error ? erro.message : "Falha.");
                        }
                      }}
                    >
                      Aprovar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          await fnRejeitar({
                            data: {
                              produtoId: produto.id,

                              removerAtual: false,
                            },
                          });

                          toast.success("Imagem rejeitada.");

                          atualizar();
                        } catch (erro) {
                          toast.error(erro instanceof Error ? erro.message : "Falha.");
                        }
                      }}
                    >
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((numero) => numero - 1)}>
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          Página {pagina} de {paginas} · {total} produtos
        </span>

        <Button variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((numero) => numero + 1)}>
          Próxima
        </Button>
      </div>

      <Dialog
        open={!!selecionado}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setSelecionado(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selecionado?.nome}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label className="text-xs">Buscar com outro termo</Label>

              <Input
                value={termoManual}
                placeholder="Ex.: dipirona 500mg comprimidos"
                onChange={(ev) => setTermoManual(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    void buscarComTermo();
                  }
                }}
              />
            </div>

            <Button variant="outline" onClick={buscarComTermo} disabled={carregandoCandidatos}>
              Buscar
            </Button>
          </div>

          <div className="mt-2">
            <Label className="text-xs">Ou envie uma foto do computador</Label>

            <Input
              type="file"
              accept="image/*"
              onChange={(ev) => {
                const arquivo = ev.target.files?.[0];

                if (arquivo && selecionado) {
                  void enviarArquivo(selecionado.id, arquivo);
                }
              }}
            />
          </div>

          {carregandoCandidatos ? (
            <p className="mt-4 text-sm text-muted-foreground">Procurando imagens…</p>
          ) : candidatos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma imagem encontrada nas fontes disponíveis.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {candidatos.map((candidato, indice) => (
                <div key={indice} className="rounded-xl border p-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                    <img src={candidato.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {candidato.source} · {Math.round(candidato.confianca ?? 0)}%
                    {candidato.conflito ? " · conflito" : ""}
                  </p>

                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={aplicarMutation.isPending}
                    onClick={() => aplicarMutation.mutate(candidato)}
                  >
                    Usar esta imagem
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
