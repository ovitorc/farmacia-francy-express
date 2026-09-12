import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
  excluirImagemProduto,
  excluirImagensProdutos,
  enviarImagemProduto,
  processarProdutoImagem,
  listarFontesImagens,
  salvarFonteImagem,
  alternarFonteImagem,
  excluirFonteImagem,
  listarImagensProduto,
  adicionarImagemPorLink,
  definirImagemPrincipal,
  excluirImagemGaleria,
  listarHistoricoImagens,
} from "@/lib/images.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

const CONCORRENCIA = 2;

const NOMES_FONTES: Record<string, string> = {
  pague_menos: "Pague Menos",
  farmacia_permanente: "Farmácia Permanente",
  droga_raia: "Droga Raia",
};

type ResultadoProduto = {
  produtoId: string;
  nome: string;
  status: "found" | "manual_review" | "not_found" | "error";
  fonte?: string | null;
};

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

  const fnExcluirImagem = useServerFn(excluirImagemProduto);

  const fnExcluirImagens = useServerFn(excluirImagensProdutos);

  const fnEnviar = useServerFn(enviarImagemProduto);

  const fnProcessar = useServerFn(processarProdutoImagem);

  const fnFontes = useServerFn(listarFontesImagens);

  const fnSalvarFonte = useServerFn(salvarFonteImagem);

  const fnAlternarFonte = useServerFn(alternarFonteImagem);

  const fnExcluirFonte = useServerFn(excluirFonteImagem);

  const fnGaleria = useServerFn(listarImagensProduto);

  const fnAdicionarLink = useServerFn(adicionarImagemPorLink);

  const fnPrincipal = useServerFn(definirImagemPrincipal);

  const fnExcluirGaleria = useServerFn(excluirImagemGaleria);
  const fnHistorico = useServerFn(listarHistoricoImagens);

  const [filtro, setFiltro] = useState<Filtro>("sem_imagem");

  const [busca, setBusca] = useState("");

  const [termoBusca, setTermoBusca] = useState("");

  const [categoriasSel, setCategoriasSel] = useState<string[]>([]);

  const [subcategoriasSel, setSubcategoriasSel] = useState<string[]>([]);

  const [pagina, setPagina] = useState(1);
  const [paginaInput, setPaginaInput] = useState("1");

  const porPagina = 20;

  const [quantidadeLote, setQuantidadeLote] = useState(10);

  const [quantidadePersonalizada, setQuantidadePersonalizada] = useState("");

  const [selecionado, setSelecionado] = useState<any | null>(null);

  const [candidatos, setCandidatos] = useState<any[]>([]);

  const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);

  const [termoManual, setTermoManual] = useState("");

  const [lote, setLote] = useState<any | null>(null);

  const [rodandoLote, setRodandoLote] = useState(false);

  // Seleção de produtos (mantida entre filtros, buscas e páginas).
  const [selecao, setSelecao] = useState<Record<string, string>>({});

  const [resultados, setResultados] = useState<ResultadoProduto[]>([]);

  const [processando, setProcessando] = useState(false);

  const [totalProcessar, setTotalProcessar] = useState(0);

  // Fontes de pesquisa (padrão + personalizadas).
  const [fontesSel, setFontesSel] = useState<string[]>([]);

  const [fonteEditando, setFonteEditando] = useState<any | null>(null);

  const [fonteNome, setFonteNome] = useState("");

  const [fonteUrl, setFonteUrl] = useState("");

  const [fontePrioridade, setFontePrioridade] = useState("100");

  const [linkImagem, setLinkImagem] = useState("");

  const [salvandoLink, setSalvandoLink] = useState(false);

  const [imagemVisualizando, setImagemVisualizando] = useState<{
    url: string;
    alt?: string;
  } | null>(null);
  const [historicoStatus, setHistoricoStatus] = useState("todos");
  const [historicoFonte, setHistoricoFonte] = useState("todas");
  const [historicoBusca, setHistoricoBusca] = useState("");
  const [historicoTermo, setHistoricoTermo] = useState("");
  const [historicoPagina, setHistoricoPagina] = useState(1);

  useEffect(() => {
    if (!imagemVisualizando) {
      return;
    }

    const fecharComEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setImagemVisualizando(null);
      }
    };

    window.addEventListener("keydown", fecharComEsc);

    return () => {
      window.removeEventListener("keydown", fecharComEsc);
    };
  }, [imagemVisualizando]);

  const fontes = useQuery({
    queryKey: ["imagens", "fontes"],

    queryFn: () => fnFontes({}),
  });

  const listaFontes = (fontes.data?.fontes ?? []) as any[];

  const fontesAtivasIds = listaFontes.filter((f) => f.ativo).map((f) => f.id as string);

  // Sem seleção explícita, usa todas as fontes ativas.
  const fonteIds = fontesSel.length ? fontesSel : fontesAtivasIds;

  const galeria = useQuery({
    queryKey: ["imagens", "galeria", selecionado?.id],

    enabled: !!selecionado?.id,

    queryFn: () => fnGaleria({ data: { produtoId: selecionado.id } }),
  });

  const historico = useQuery({
    queryKey: ["imagens", "historico", historicoStatus, historicoFonte, historicoTermo, historicoPagina],
    queryFn: () =>
      fnHistorico({
        data: {
          status: historicoStatus,
          fonte: historicoFonte,
          busca: historicoTermo,
          pagina: historicoPagina,
          porPagina: 20,
        },
      }),
  });

  const salvarFonte = async () => {
    if (fonteNome.trim().length < 2 || fonteUrl.trim().length < 4) {
      toast.error("Informe o nome e o endereço do site.");

      return;
    }

    try {
      await fnSalvarFonte({
        data: {
          ...(fonteEditando ? { id: fonteEditando.id as string } : {}),
          nome: fonteNome.trim(),
          url: fonteUrl.trim(),
          ativo: fonteEditando ? Boolean(fonteEditando.ativo) : true,
          prioridade: Number.parseInt(fontePrioridade, 10) || 100,
        },
      });

      toast.success(fonteEditando ? "Fonte atualizada." : "Fonte adicionada.");

      setFonteEditando(null);

      setFonteNome("");

      setFonteUrl("");

      setFontePrioridade("100");

      void qc.invalidateQueries({ queryKey: ["imagens", "fontes"] });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar a fonte.");
    }
  };

  const adicionarPorLink = async () => {
    if (!selecionado || !linkImagem.trim()) {
      return;
    }

    setSalvandoLink(true);

    try {
      const r = await fnAdicionarLink({ data: { produtoId: selecionado.id, imageUrl: linkImagem.trim() } });

      if (r.duplicada) {
        toast.info("Essa imagem já está na galeria deste produto.");
      } else {
        toast.success("Imagem adicionada à galeria. Defina como principal para publicá-la.");
      }

      setLinkImagem("");

      void qc.invalidateQueries({ queryKey: ["imagens", "galeria"] });
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível usar esse link.");
    } finally {
      setSalvandoLink(false);
    }
  };

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
    if (categoriasSel.length === 0) {
      return subcategorias;
    }

    return subcategorias.filter((item: any) => categoriasSel.includes(item.categoria_slug));
  }, [categoriasSel, subcategorias]);

  const lista = useQuery({
    queryKey: ["imagens", "lista", filtro, termoBusca, categoriasSel, subcategoriasSel, pagina],

    queryFn: () =>
      fnListar({
        data: {
          filtro,

          busca: termoBusca,

          comEan: "qualquer",

          fabricante: "",

          categoria: "",

          subcategoria: "",

          categorias: categoriasSel,

          subcategorias: subcategoriasSel.filter((slug) =>
            subcategoriasFiltradas.some((item: any) => item.slug === slug),
          ),

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

  const alternarCategoria = (slug: string) => {
    setCategoriasSel((atual) => (atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]));

    setPagina(1);
    setPaginaInput("1");
  };

  const alternarSubcategoria = (slug: string) => {
    setSubcategoriasSel((atual) => (atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]));

    setPagina(1);
    setPaginaInput("1");
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
    setPaginaInput("1");
  };

  const limparFiltros = () => {
    setBusca("");

    setTermoBusca("");

    setCategoriasSel([]);

    setSubcategoriasSel([]);

    setFiltro("sem_imagem");

    setPagina(1);
    setPaginaInput("1");
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

          fonteIds,
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

          fonteIds,
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

          categoria: categoriasSel[0] ?? "",

          subcategoria: subcategoriasSel[0] ?? "",

          busca: termoBusca,

          fabricante: "",

          comEan: "qualquer",

          fonteIds,
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

  const irParaPagina = (valor: string | number) => {
    const numero = Math.min(paginas, Math.max(1, Number.parseInt(String(valor), 10) || 1));
    setPagina(numero);
    setPaginaInput(String(numero));
  };

  const idsSelecionados = Object.keys(selecao);

  const todosExibidosSelecionados = itens.length > 0 && itens.every((p: any) => selecao[p.id]);

  const alternarProduto = (produto: any) => {
    setSelecao((atual) => {
      const copia = { ...atual };

      if (copia[produto.id]) {
        delete copia[produto.id];
      } else {
        copia[produto.id] = produto.nome;
      }

      return copia;
    });
  };

  const selecionarExibidos = () => {
    setSelecao((atual) => {
      const copia = { ...atual };

      for (const p of itens as any[]) {
        copia[p.id] = p.nome;
      }

      return copia;
    });
  };

  const limparSelecao = () => setSelecao({});

  /** Processa uma lista de produtos com no máximo 5 buscas simultâneas. */
  const processarLista = async (produtos: Array<{ id: string; nome: string }>) => {
    if (produtos.length === 0) {
      toast.info("Selecione ao menos um produto.");

      return;
    }

    setProcessando(true);

    setResultados([]);

    setTotalProcessar(produtos.length);

    let indice = 0;

    const trabalhador = async () => {
      while (indice < produtos.length) {
        const atual = produtos[indice++];

        if (!atual) {
          return;
        }

        try {
          const r = await fnProcessar({ data: { produtoId: atual.id, fonteIds } });

          setResultados((lista) => [
            ...lista,
            { produtoId: atual.id, nome: r.nome ?? atual.nome, status: r.status, fonte: r.fonte },
          ]);
        } catch (erro) {
          setResultados((lista) => [...lista, { produtoId: atual.id, nome: atual.nome, status: "error", fonte: null }]);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, produtos.length) }, trabalhador));

      toast.success("Busca concluída. As imagens encontradas foram enviadas para revisão manual.");

      atualizar();
    } finally {
      setProcessando(false);
    }
  };

  const buscarSelecionados = () =>
    processarLista(idsSelecionados.map((id) => ({ id, nome: selecao[id] ?? "Produto" })));

  const excluirSelecionados = async () => {
    if (idsSelecionados.length === 0) {
      toast.info("Selecione ao menos um produto.");

      return;
    }

    const confirmar = window.confirm(`Excluir as imagens de ${idsSelecionados.length} produto(s) selecionado(s)?`);

    if (!confirmar) return;

    try {
      const r = await fnExcluirImagens({ data: { produtoIds: idsSelecionados } });

      toast.success(`${r.excluidas} imagem(ns) removida(s).`);

      limparSelecao();

      atualizar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao excluir imagens.");
    }
  };

  const naoEncontrados = resultados.filter((r) => r.status === "not_found" || r.status === "error");

  const buscarNaoEncontrados = () => processarLista(naoEncontrados.map((r) => ({ id: r.produtoId, nome: r.nome })));

  const encontrados = resultados.filter((r) => r.status === "found").length;

  const emRevisaoResultado = resultados.filter((r) => r.status === "manual_review").length;

  const semImagemResultado = resultados.filter((r) => r.status === "not_found").length;

  const errosResultado = resultados.filter((r) => r.status === "error").length;

  const porFonte = useMemo(() => {
    const mapa: Record<string, number> = {};

    for (const r of resultados) {
      if (r.status === "found" && r.fonte) {
        mapa[r.fonte] = (mapa[r.fonte] ?? 0) + 1;
      }
    }

    return mapa;
  }, [resultados]);

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
        <h2 className="text-lg font-semibold text-primary">Fontes de pesquisa</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre quantos sites quiser. Marque abaixo quais devem ser usados nas próximas buscas; sem nenhuma marcação,
          todos os sites ativos são consultados.
        </p>

        <div className="mt-4 grid gap-2">
          {listaFontes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma fonte cadastrada.</p>}

          {listaFontes.map((fonte: any) => (
            <div key={fonte.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
              <Checkbox
                checked={fontesSel.includes(fonte.id)}
                disabled={!fonte.ativo}
                onCheckedChange={() =>
                  setFontesSel((atual) =>
                    atual.includes(fonte.id) ? atual.filter((id) => id !== fonte.id) : [...atual, fonte.id],
                  )
                }
              />

              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium">
                  {fonte.nome}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {fonte.tipo === "padrao" ? "· padrão" : "· personalizada"} · prioridade {fonte.prioridade}
                  </span>
                </p>

                <p className="text-xs break-all text-muted-foreground">{fonte.url}</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await fnAlternarFonte({ data: { id: fonte.id, ativo: !fonte.ativo } });

                  void qc.invalidateQueries({ queryKey: ["imagens", "fontes"] });
                }}
              >
                {fonte.ativo ? "Desativar" : "Ativar"}
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFonteEditando(fonte);

                  setFonteNome(fonte.nome);

                  setFonteUrl(fonte.url);

                  setFontePrioridade(String(fonte.prioridade));
                }}
              >
                Editar
              </Button>

              {fonte.tipo === "personalizada" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!window.confirm(`Excluir a fonte ${fonte.nome}?`)) return;

                    try {
                      await fnExcluirFonte({ data: { id: fonte.id } });

                      toast.success("Fonte excluída.");

                      void qc.invalidateQueries({ queryKey: ["imagens", "fontes"] });
                    } catch (erro) {
                      toast.error(erro instanceof Error ? erro.message : "Falha ao excluir.");
                    }
                  }}
                >
                  Excluir
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.5fr_auto_auto]">
          <div>
            <Label className="text-xs">Nome do site</Label>

            <Input value={fonteNome} placeholder="Ex.: Drogasil" onChange={(ev) => setFonteNome(ev.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Endereço</Label>

            <Input
              value={fonteUrl}
              placeholder="https://www.drogasil.com.br"
              onChange={(ev) => setFonteUrl(ev.target.value)}
            />
          </div>

          <div className="w-28">
            <Label className="text-xs">Prioridade</Label>

            <Input value={fontePrioridade} inputMode="numeric" onChange={(ev) => setFontePrioridade(ev.target.value)} />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={salvarFonte}>{fonteEditando ? "Salvar" : "Adicionar"}</Button>

            {fonteEditando && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFonteEditando(null);

                  setFonteNome("");

                  setFonteUrl("");

                  setFontePrioridade("100");
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Histórico das pesquisas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte as buscas realizadas, a fonte utilizada e o resultado de cada produto.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{historico.data?.total ?? 0} registros</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <Input
            value={historicoBusca}
            placeholder="EAN, fonte ou situação"
            onChange={(ev) => setHistoricoBusca(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                setHistoricoTermo(historicoBusca);
                setHistoricoPagina(1);
              }
            }}
          />
          <Select
            value={historicoStatus}
            onValueChange={(valor) => {
              setHistoricoStatus(valor);
              setHistoricoPagina(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="manual_review">Em revisão</SelectItem>
              <SelectItem value="approved">Aprovada</SelectItem>
              <SelectItem value="not_found">Não encontrada</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={historicoFonte}
            onValueChange={(valor) => {
              setHistoricoFonte(valor);
              setHistoricoPagina(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as fontes</SelectItem>
              {listaFontes.map((fonte: any) => (
                <SelectItem key={fonte.id} value={fonte.nome}>
                  {fonte.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setHistoricoTermo(historicoBusca);
              setHistoricoPagina(1);
            }}
          >
            Buscar
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Data</th>
                <th className="px-3 py-3 font-medium">Produto</th>
                <th className="px-3 py-3 font-medium">Situação</th>
                <th className="px-3 py-3 font-medium">Fonte</th>
                <th className="px-3 py-3 font-medium">Confiança</th>
                <th className="px-3 py-3 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {historico.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Carregando histórico…
                  </td>
                </tr>
              )}
              {!historico.isLoading && (historico.data?.itens.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {historico.data?.itens.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                      new Date(item.started_at),
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="max-w-64 font-medium">{item.produto_nome}</p>
                    <p className="text-xs text-muted-foreground">{item.ean || item.produto_codigo || "Sem código"}</p>
                  </td>
                  <td className="px-3 py-3">
                    {item.status === "manual_review"
                      ? "Em revisão"
                      : item.status === "approved"
                        ? "Aprovada"
                        : item.status === "not_found"
                          ? "Não encontrada"
                          : item.status === "error"
                            ? "Erro"
                            : item.status}
                  </td>
                  <td className="px-3 py-3">{NOMES_FONTES[item.source ?? ""] ?? item.source ?? "—"}</td>
                  <td className="px-3 py-3">{item.confidence == null ? "—" : `${item.confidence}%`}</td>
                  <td className="max-w-72 px-3 py-3 text-xs text-muted-foreground">{item.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" disabled={historicoPagina <= 1} onClick={() => setHistoricoPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {historicoPagina} de {Math.max(1, Math.ceil((historico.data?.total ?? 0) / 20))}
          </span>
          <Button
            variant="outline"
            disabled={historicoPagina >= Math.max(1, Math.ceil((historico.data?.total ?? 0) / 20))}
            onClick={() => setHistoricoPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Filtros dos produtos</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Marque quantas categorias e subcategorias quiser. A lista abaixo mostra apenas os produtos correspondentes.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <Label>Categorias</Label>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCategoriasSel(categorias.map((c: any) => c.slug));

                    setPagina(1);
                    setPaginaInput("1");
                  }}
                >
                  Todas
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCategoriasSel([]);

                    setSubcategoriasSel([]);

                    setPagina(1);
                    setPaginaInput("1");
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-2 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {categorias.map((item: any) => (
                <label key={item.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={categoriasSel.includes(item.slug)}
                    onCheckedChange={() => alternarCategoria(item.slug)}
                  />

                  <span className="line-clamp-1">{item.nome}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Subcategorias</Label>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSubcategoriasSel(subcategoriasFiltradas.map((s: any) => s.slug));

                    setPagina(1);
                    setPaginaInput("1");
                  }}
                >
                  Todas
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSubcategoriasSel([]);

                    setPagina(1);
                    setPaginaInput("1");
                  }}
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-2 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {subcategoriasFiltradas.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma subcategoria disponível.</p>
              )}

              {subcategoriasFiltradas.map((item: any) => (
                <label key={item.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={subcategoriasSel.includes(item.slug)}
                    onCheckedChange={() => alternarSubcategoria(item.slug)}
                  />

                  <span className="line-clamp-1">{item.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Situação da imagem</Label>

            <Select
              value={filtro}
              onValueChange={(valor) => {
                setFiltro(valor as Filtro);

                setPagina(1);
                setPaginaInput("1");
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
              placeholder="Nome, fabricante ou código de barras"
              onChange={(ev) => setBusca(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  aplicarFiltros();
                }
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={aplicarFiltros}>Aplicar filtros</Button>

          <Button variant="outline" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Buscar imagens dos produtos selecionados</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          A busca acontece ao mesmo tempo em Pague Menos, Farmácia Permanente e Droga Raia, processando 5 produtos por
          vez. Nada é pesquisado automaticamente ao abrir a página.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Produtos selecionados: {idsSelecionados.length}
          </span>

          <Button variant="outline" size="sm" onClick={selecionarExibidos} disabled={itens.length === 0}>
            Selecionar todos os exibidos
          </Button>

          <Button variant="outline" size="sm" onClick={limparSelecao} disabled={idsSelecionados.length === 0}>
            Limpar seleção
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={processando || idsSelecionados.length === 0} onClick={buscarSelecionados}>
            {processando
              ? "Pesquisando…"
              : `🔍 Buscar imagens de ${idsSelecionados.length} produto${idsSelecionados.length !== 1 ? "s" : ""}`}
          </Button>

          <Button
            variant="outline"
            disabled={processando || naoEncontrados.length === 0}
            onClick={buscarNaoEncontrados}
          >
            🔄 Pesquisar novamente os não encontrados ({naoEncontrados.length})
          </Button>
        </div>

        {(processando || resultados.length > 0) && (
          <div className="mt-5 rounded-xl border bg-muted/30 p-4 text-sm">
            <p className="font-semibold">{processando ? "Pesquisando imagens…" : "Resumo da pesquisa"}</p>

            <Progress className="mt-3" value={totalProcessar ? (resultados.length / totalProcessar) * 100 : 0} />

            <p className="mt-2">
              {resultados.length} / {totalProcessar} produtos processados
            </p>

            <p className="mt-1 text-muted-foreground">
              Aprovadas automaticamente: {encontrados} · Em revisão: {emRevisaoResultado} · Não encontrados:{" "}
              {semImagemResultado} · Erros: {errosResultado} · Aguardando:{" "}
              {Math.max(0, totalProcessar - resultados.length)}
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              {Object.entries(porFonte).map(([fonte, quantidade]) => (
                <span key={fonte} className="rounded-full bg-background px-3 py-1">
                  {NOMES_FONTES[fonte] ?? fonte}: {quantidade}
                </span>
              ))}
            </div>

            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">
              {resultados.map((r) => (
                <li key={r.produtoId}>
                  {r.status === "found" && (
                    <span className="text-green-700">
                      ✓ {r.nome} — Fonte: {NOMES_FONTES[r.fonte ?? ""] ?? r.fonte}
                    </span>
                  )}

                  {r.status === "not_found" && (
                    <span className="text-muted-foreground">✗ {r.nome} — não encontrado</span>
                  )}

                  {r.status === "error" && <span className="text-destructive">⚠ {r.nome} — erro na pesquisa</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Busca automática por quantidade (opcional)</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Continua disponível: processa produtos pelos filtros, sem precisar marcar um a um.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUANTIDADES_RAPIDAS.map((quantidade) => (
            <Button
              key={quantidade}
              type="button"
              variant={quantidadeLote === quantidade && quantidadePersonalizada === "" ? "default" : "outline"}
              onClick={() => selecionarQuantidade(quantidade)}
            >
              {quantidade}
            </Button>
          ))}
        </div>

        <div className="mt-4 max-w-sm">
          <Label>Ou digite qualquer quantidade</Label>

          <Input
            className="mt-2"
            type="number"
            min="1"
            max="10000"
            value={quantidadePersonalizada}
            placeholder={`Quantidade atual: ${quantidadeLote}`}
            onChange={(ev) => alterarQuantidadePersonalizada(ev.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={rodandoLote} onClick={() => rodarLote("sem_imagem")}>
            {rodandoLote
              ? "Processando…"
              : `Buscar imagens para ${quantidadeLote} produto${quantidadeLote !== 1 ? "s" : ""}`}
          </Button>

          <Button variant="outline" disabled={rodandoLote} onClick={() => rodarLote("revisao")}>
            Reprocessar pendentes
          </Button>
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

      {idsSelecionados.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={buscarSelecionados} disabled={processando}>
            Procurar imagens para revisão ({idsSelecionados.length})
          </Button>

          <Button variant="destructive" onClick={excluirSelecionados}>
            Excluir imagens selecionadas ({idsSelecionados.length})
          </Button>

          <Button variant="ghost" onClick={limparSelecao}>
            Limpar seleção
          </Button>
        </div>
      )}

      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Produtos encontrados</h2>

            <p className="text-sm text-muted-foreground">
              {total} produto
              {total !== 1 ? "s" : ""} encontrado
              {total !== 1 ? "s" : ""} · {idsSelecionados.length} selecionado
              {idsSelecionados.length !== 1 ? "s" : ""}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={todosExibidosSelecionados}
              onCheckedChange={(marcado) => {
                if (marcado) {
                  selecionarExibidos();
                } else {
                  setSelecao((atual) => {
                    const copia = { ...atual };

                    for (const p of itens as any[]) {
                      delete copia[p.id];
                    }

                    return copia;
                  });
                }
              }}
            />
            Selecionar todos os produtos exibidos
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {lista.isLoading && <p className="col-span-full text-sm text-muted-foreground">Carregando produtos…</p>}

          {!lista.isLoading && itens.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              Nenhum produto encontrado com os filtros selecionados.
            </p>
          )}

          {itens.map((produto: any) => (
            <div key={produto.id} className="flex flex-col rounded-xl border bg-card p-3 shadow-sm">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox checked={!!selecao[produto.id]} onCheckedChange={() => alternarProduto(produto)} />
                Selecionar
              </label>

              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                {produto.imagem || produto.image_candidato_url ? (
                  <img
                    src={produto.imagem ?? produto.image_candidato_url}
                    alt={produto.nome}
                    className="h-full w-full cursor-zoom-in object-contain transition-transform duration-200 hover:scale-[1.02]"
                    loading="lazy"
                    onClick={() =>
                      setImagemVisualizando({
                        url: produto.imagem ?? produto.image_candidato_url,
                        alt: produto.nome,
                      })
                    }
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none";
                    }}
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

                {(produto.imagem || produto.image_candidato_url) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      const confirmar = window.confirm(`Excluir a imagem de "${produto.nome}"?`);

                      if (!confirmar) return;

                      try {
                        await fnExcluirImagem({
                          data: {
                            produtoId: produto.id,
                          },
                        });

                        toast.success("Imagem excluída com sucesso.");

                        atualizar();
                      } catch (erro) {
                        toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir a imagem.");
                      }
                    }}
                  >
                    Excluir imagem
                  </Button>
                )}

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

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-xl border bg-card p-3">
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irParaPagina(1)}>
          Primeira
        </Button>
        <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => irParaPagina(pagina - 1)}>
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">Página</span>
        <Input
          value={paginaInput}
          onChange={(e) => setPaginaInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") irParaPagina(paginaInput);
          }}
          className="w-20 text-center"
          inputMode="numeric"
          aria-label="Número da página"
        />
        <Button size="sm" onClick={() => irParaPagina(paginaInput)}>
          Ir
        </Button>
        <span className="text-sm text-muted-foreground">
          de {paginas} · {total} produtos
        </span>
        <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => irParaPagina(pagina + 1)}>
          Próxima
        </Button>
        <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => irParaPagina(paginas)}>
          Última
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

          <div className="mt-4 rounded-xl border p-3">
            <Label className="text-xs">Adicionar imagem por link</Label>

            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                className="min-w-[220px] flex-1"
                value={linkImagem}
                placeholder="https://site.com/foto-do-produto.jpg"
                onChange={(ev) => setLinkImagem(ev.target.value)}
              />

              <Button variant="outline" disabled={salvandoLink || !linkImagem.trim()} onClick={adicionarPorLink}>
                {salvandoLink ? "Conferindo…" : "Adicionar"}
              </Button>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Aceita JPG, PNG, WEBP e GIF. Links quebrados ou que não sejam imagem são recusados. A imagem só vai ao ar
              quando você definir como principal.
            </p>

            {(galeria.data?.imagens ?? []).length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {(galeria.data?.imagens ?? []).map((img: any) => (
                  <div key={img.id} className="rounded-xl border p-2">
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                      <img
                        src={img.image_url}
                        alt={selecionado?.nome ?? "Imagem do produto"}
                        className="h-full w-full cursor-zoom-in object-contain transition-transform duration-200 hover:scale-[1.02]"
                        loading="lazy"
                        onClick={() =>
                          setImagemVisualizando({
                            url: img.image_url,
                            alt: selecionado?.nome ?? "Imagem do produto",
                          })
                        }
                      />
                    </div>

                    <p className="mt-1 truncate text-[11px] text-muted-foreground" title={img.source_url ?? ""}>
                      {img.is_primary ? "Principal · " : ""}
                      {img.source_url ?? img.source_type}
                    </p>

                    <div className="mt-2 flex gap-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={img.is_primary}
                        onClick={async () => {
                          try {
                            await fnPrincipal({ data: { produtoId: selecionado.id, imagemId: img.id } });

                            toast.success("Imagem principal definida.");

                            void qc.invalidateQueries({ queryKey: ["imagens"] });
                          } catch (erro) {
                            toast.error(erro instanceof Error ? erro.message : "Falha ao definir.");
                          }
                        }}
                      >
                        Principal
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!window.confirm("Excluir esta imagem?")) return;

                          try {
                            await fnExcluirGaleria({ data: { imagemId: img.id } });

                            toast.success("Imagem excluída.");

                            void qc.invalidateQueries({ queryKey: ["imagens"] });
                          } catch (erro) {
                            toast.error(erro instanceof Error ? erro.message : "Falha ao excluir.");
                          }
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                    <img
                      src={candidato.imageUrl}
                      alt={selecionado?.nome ?? "Imagem candidata"}
                      className="h-full w-full cursor-zoom-in object-contain transition-transform duration-200 hover:scale-[1.02]"
                      loading="lazy"
                      onClick={() =>
                        setImagemVisualizando({
                          url: candidato.imageUrl,
                          alt: selecionado?.nome ?? "Imagem candidata",
                        })
                      }
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {NOMES_FONTES[candidato.source] ?? candidato.source} · {Math.round(candidato.confianca ?? 0)}%
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

      {imagemVisualizando && (
        <div
          className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-black/10 p-6 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada da imagem"
          onClick={() => setImagemVisualizando(null)}
        >
          <div className="flex max-h-[64vh] max-w-[64vw] items-center justify-center">
            <img
              src={imagemVisualizando.url}
              alt={imagemVisualizando.alt ?? "Imagem ampliada"}
              className="block max-h-[60vh] max-w-[60vw] cursor-zoom-out object-contain border border-black bg-white shadow-2xl"
              onClick={(ev) => ev.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
