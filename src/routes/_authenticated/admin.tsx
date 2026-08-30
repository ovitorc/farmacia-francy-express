import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { buscaQueryOptions, catalogoQueryOptions, listaQueryOptions } from "@/lib/catalog-context";
import { formatarPreco, type Produto } from "@/lib/catalog";

import {
  salvarProduto,
  excluirProduto,
  enviarImagem,
  souAdmin,
  marcarDestaque,
  listarBanners,
  salvarBanner,
  excluirBanner,
  marcarBannerAtivo,
  enviarBanner,
} from "@/lib/admin.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      {
        title: "Painel administrativo | Farmácias Francy",
      },
      {
        name: "description",
        content: "Gerencie produtos e banners da Farmácias Francy.",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),

  component: AdminPage,
});

type Rascunho = {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  categoria_slug: string;
  subcategoria_slug: string;
  preco: string;
  preco_promocional: string;
  imagem: string | null;
  disponivel: boolean;
  oferta: boolean;
  rasga_preco: boolean;
};

type RascunhoBanner = {
  id?: string;
  titulo: string;
  descricao: string;
  imagem: string;
  link: string;
  ativo: boolean;
  ordem: string;
};

type Banner = {
  id: string;
  titulo: string;
  descricao: string;
  imagem: string;
  link: string;
  ativo: boolean;
  ordem: number;
};

const vazio = (categoriaSlug: string): Rascunho => ({
  codigo: "",
  nome: "",
  descricao: "",
  categoria_slug: categoriaSlug,
  subcategoria_slug: "",
  preco: "",
  preco_promocional: "",
  imagem: null,
  disponivel: true,
  oferta: false,
  rasga_preco: false,
});

const bannerVazio = (): RascunhoBanner => ({
  titulo: "",
  descricao: "",
  imagem: "",
  link: "",
  ativo: true,
  ordem: "0",
});

function AdminPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: catalogo } = useQuery(catalogoQueryOptions);

  const { data: perfil } = useQuery({
    queryKey: ["sou-admin"],
    queryFn: () => souAdmin(),
  });

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["banners-admin"],
    queryFn: () => listarBanners(),
  });

  const salvar = useServerFn(salvarProduto);
  const excluir = useServerFn(excluirProduto);
  const upload = useServerFn(enviarImagem);
  const destacar = useServerFn(marcarDestaque);

  const salvarBannerFn = useServerFn(salvarBanner);
  const excluirBannerFn = useServerFn(excluirBanner);
  const marcarBannerAtivoFn = useServerFn(marcarBannerAtivo);
  const enviarBannerFn = useServerFn(enviarBanner);

  const [termo, setTermo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const [rascunhoBanner, setRascunhoBanner] = useState<RascunhoBanner | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [salvandoBanner, setSalvandoBanner] = useState(false);

  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [enviandoBanner, setEnviandoBanner] = useState(false);

  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  const [marcandoBannerId, setMarcandoBannerId] = useState<string | null>(null);

  const categorias = catalogo?.categorias ?? [];
  const destaques = catalogo?.produtos ?? [];

  const termoBusca = termo.trim();

  const { data: resultadoBusca } = useQuery({
    ...buscaQueryOptions(termoBusca, 60),
    enabled: termoBusca.length > 1,
  });

  const { data: pagina } = useQuery({
    ...listaQueryOptions({
      categoria: filtroCategoria,
    }),
    enabled: termoBusca.length <= 1 && filtroCategoria !== "todas",
  });

  const lista = useMemo(() => {
    if (termoBusca.length > 1) {
      const base = resultadoBusca ?? [];

      return filtroCategoria === "todas" ? base : base.filter((p) => p.categoria === filtroCategoria);
    }

    if (filtroCategoria !== "todas") {
      return pagina?.itens ?? [];
    }

    return destaques;
  }, [termoBusca, resultadoBusca, pagina, destaques, filtroCategoria]);

  const subcategoriasDoRascunho = categorias.find((c) => c.slug === rascunho?.categoria_slug)?.subcategorias ?? [];

  function abrirNovo() {
    setRascunho(vazio(categorias[0]?.slug ?? ""));
  }

  function abrirEdicao(p: Produto) {
    setRascunho({
      id: p.id,
      codigo: p.codigo,
      nome: p.nome,
      descricao: p.descricao,
      categoria_slug: p.categoria,
      subcategoria_slug: p.subcategoria,
      preco: String(p.preco),
      preco_promocional: p.precoPromocional == null ? "" : String(p.precoPromocional),
      imagem: p.imagem ?? null,
      disponivel: p.disponivel,
      oferta: p.oferta,
      rasga_preco: Boolean(p.rasgaPreco),
    });
  }

  function abrirNovoBanner() {
    setRascunhoBanner(bannerVazio());
  }

  function abrirEdicaoBanner(banner: Banner) {
    setRascunhoBanner({
      id: banner.id,
      titulo: banner.titulo,
      descricao: banner.descricao,
      imagem: banner.imagem,
      link: banner.link ?? "",
      ativo: banner.ativo,
      ordem: String(banner.ordem),
    });
  }

  async function atualizarTudo() {
    await queryClient.invalidateQueries({
      queryKey: ["catalogo"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["busca"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["produtos"],
    });

    await queryClient.invalidateQueries({
      queryKey: ["banners-admin"],
    });

    await router.invalidate();
  }

  async function alternar(p: Produto, campo: "oferta" | "rasga_preco", valor: boolean) {
    setMarcandoId(p.id);

    try {
      await destacar({
        data: {
          id: p.id,
          campo,
          valor,
        },
      });

      await atualizarTudo();

      toast.success(`${campo === "oferta" ? "Oferta" : "Rasga Preço"} ${valor ? "ativado" : "removido"}.`);
    } catch {
      toast.error("Não foi possível atualizar o destaque.");
    } finally {
      setMarcandoId(null);
    }
  }

  async function escolherFoto(file: File) {
    setEnviandoFoto(true);

    try {
      const buffer = await file.arrayBuffer();

      let binario = "";

      const bytes = new Uint8Array(buffer);

      for (let i = 0; i < bytes.length; i += 1) {
        binario += String.fromCharCode(bytes[i]!);
      }

      const { url } = await upload({
        data: {
          nomeArquivo: file.name,
          tipo: file.type || "image/jpeg",
          conteudoBase64: btoa(binario),
        },
      });

      setRascunho((r) =>
        r
          ? {
              ...r,
              imagem: url,
            }
          : r,
      );

      toast.success("Foto enviada.");
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function escolherBanner(file: File) {
    setEnviandoBanner(true);

    try {
      const buffer = await file.arrayBuffer();

      let binario = "";

      const bytes = new Uint8Array(buffer);

      for (let i = 0; i < bytes.length; i += 1) {
        binario += String.fromCharCode(bytes[i]!);
      }

      const { url } = await enviarBannerFn({
        data: {
          nomeArquivo: file.name,
          tipo: file.type || "image/jpeg",
          conteudoBase64: btoa(binario),
        },
      });

      setRascunhoBanner((b) =>
        b
          ? {
              ...b,
              imagem: url,
            }
          : b,
      );

      toast.success("Banner enviado com sucesso.");
    } catch {
      toast.error("Não foi possível enviar o banner.");
    } finally {
      setEnviandoBanner(false);
    }
  }

  async function confirmarSalvar() {
    if (!rascunho) return;

    setSalvando(true);

    try {
      await salvar({
        data: {
          ...(rascunho.id ? { id: rascunho.id } : {}),

          codigo: rascunho.codigo.trim(),

          nome: rascunho.nome.trim(),

          descricao: rascunho.descricao,

          categoria_slug: rascunho.categoria_slug,

          subcategoria_slug: rascunho.subcategoria_slug,

          preco: Number(rascunho.preco.replace(",", ".")) || 0,

          preco_promocional:
            rascunho.preco_promocional.trim() === "" ? null : Number(rascunho.preco_promocional.replace(",", ".")),

          imagem: rascunho.imagem,

          disponivel: rascunho.disponivel,

          oferta: rascunho.oferta,

          rasga_preco: rascunho.rasga_preco,

          informacoes: [],
        },
      });

      setRascunho(null);

      await atualizarTudo();

      toast.success("Produto salvo.");
    } catch {
      toast.error("Erro ao salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExcluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) {
      return;
    }

    try {
      await excluir({
        data: {
          id: p.id,
        },
      });

      await atualizarTudo();

      toast.success("Produto excluído.");
    } catch {
      toast.error("Erro ao excluir o produto.");
    }
  }

  async function confirmarSalvarBanner() {
    if (!rascunhoBanner) return;

    if (!rascunhoBanner.imagem) {
      toast.error("Selecione uma imagem para o banner.");
      return;
    }

    if (!rascunhoBanner.titulo.trim()) {
      toast.error("Informe um título para o banner.");
      return;
    }

    setSalvandoBanner(true);

    try {
      await salvarBannerFn({
        data: {
          ...(rascunhoBanner.id
            ? {
                id: rascunhoBanner.id,
              }
            : {}),

          titulo: rascunhoBanner.titulo.trim(),

          descricao: rascunhoBanner.descricao.trim(),

          imagem: rascunhoBanner.imagem,

          link: rascunhoBanner.link.trim(),

          ativo: rascunhoBanner.ativo,

          ordem: Number(rascunhoBanner.ordem) || 0,
        },
      });

      setRascunhoBanner(null);

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      toast.success("Banner salvo com sucesso.");
    } catch (error) {
      console.error(error);

      toast.error("Erro ao salvar o banner.");
    } finally {
      setSalvandoBanner(false);
    }
  }

  async function confirmarExcluirBanner(banner: Banner) {
    if (!confirm(`Excluir o banner "${banner.titulo}"?`)) {
      return;
    }

    try {
      await excluirBannerFn({
        data: {
          id: banner.id,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      toast.success("Banner excluído.");
    } catch {
      toast.error("Erro ao excluir o banner.");
    }
  }

  async function alternarBanner(banner: Banner, ativo: boolean) {
    setMarcandoBannerId(banner.id);

    try {
      await marcarBannerAtivoFn({
        data: {
          id: banner.id,
          ativo,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      toast.success(ativo ? "Banner ativado." : "Banner desativado.");
    } catch {
      toast.error("Não foi possível atualizar o banner.");
    } finally {
      setMarcandoBannerId(null);
    }
  }

  async function sair() {
    await queryClient.cancelQueries();

    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  }

  if (perfil && !perfil.admin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-primary">Acesso restrito</h1>

        <p className="mt-2 text-sm text-muted-foreground">Sua conta não tem permissão de administrador.</p>

        <Button className="mt-6" variant="outline" onClick={sair}>
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* =====================================================
          CABEÇALHO
      ====================================================== */}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Painel administrativo</h1>

          <p className="text-sm text-muted-foreground">Gerencie produtos e banners da Farmácias Francy.</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={sair}>
            Sair
          </Button>

          <Button onClick={abrirNovo}>Novo produto</Button>
        </div>
      </div>

      {/* =====================================================
          BANNERS
      ====================================================== */}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Banners da Home</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Adicione e organize os banners que aparecerão na página inicial.
            </p>
          </div>

          <Button onClick={abrirNovoBanner}>+ Adicionar banner</Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {banners.map((banner) => (
            <div key={banner.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="aspect-[16/6] w-full overflow-hidden bg-muted">
                {banner.imagem ? (
                  <img src={banner.imagem} alt={banner.titulo} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Sem imagem
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{banner.titulo}</h3>

                    {banner.descricao ? <p className="mt-1 text-sm text-muted-foreground">{banner.descricao}</p> : null}

                    <p className="mt-1 text-xs text-muted-foreground">Ordem: {banner.ordem}</p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      banner.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {banner.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="mr-auto flex items-center gap-2 text-sm">
                    <Switch
                      checked={banner.ativo}
                      disabled={marcandoBannerId === banner.id}
                      onCheckedChange={(valor) => void alternarBanner(banner, valor)}
                    />
                    Ativo
                  </label>

                  <Button size="sm" variant="outline" onClick={() => abrirEdicaoBanner(banner)}>
                    Editar
                  </Button>

                  <Button size="sm" variant="destructive" onClick={() => void confirmarExcluirBanner(banner)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {banners.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center md:col-span-2">
              <p className="font-medium">Nenhum banner cadastrado</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Clique em "Adicionar banner" para colocar o primeiro banner na página inicial.
              </p>

              <Button className="mt-4" onClick={abrirNovoBanner}>
                + Adicionar primeiro banner
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {/* =====================================================
          PRODUTOS
      ====================================================== */}

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Produtos</h2>

            <p className="text-sm text-muted-foreground">{lista.length} produto(s) listado(s)</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nome ou código"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="max-w-xs"
          />

          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>

              {categorias.map((c) => (
                <SelectItem key={c.slug} value={c.slug}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 divide-y rounded-lg border">
          {lista.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded border bg-muted">
                {p.imagem ? <img src={p.imagem} alt={p.nome} className="h-full w-full object-contain" /> : null}
              </div>

              <div className="min-w-40 flex-1">
                <p className="font-medium text-foreground">{p.nome}</p>

                <p className="text-xs text-muted-foreground">
                  {p.codigo} · {formatarPreco(p.precoPromocional ?? p.preco)}
                  {p.disponivel ? "" : " · indisponível"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={p.oferta}
                    disabled={marcandoId === p.id}
                    onCheckedChange={(v) => void alternar(p, "oferta", v)}
                  />
                  Oferta
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <Switch
                    checked={Boolean(p.rasgaPreco)}
                    disabled={marcandoId === p.id}
                    onCheckedChange={(v) => void alternar(p, "rasga_preco", v)}
                  />
                  Rasga Preço
                </label>

                <Button size="sm" variant="outline" onClick={() => abrirEdicao(p)}>
                  Editar
                </Button>

                <Button size="sm" variant="destructive" onClick={() => void confirmarExcluir(p)}>
                  Excluir
                </Button>
              </div>
            </div>
          ))}

          {lista.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
          ) : null}
        </div>
      </section>

      {/* =====================================================
          MODAL DE PRODUTO
      ====================================================== */}

      <Dialog open={rascunho !== null} onOpenChange={(o) => !o && setRascunho(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          {rascunho ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>

                  <Input
                    value={rascunho.nome}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        nome: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Código interno</Label>

                  <Input
                    value={rascunho.codigo}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        codigo: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categoria</Label>

                  <Select
                    value={rascunho.categoria_slug}
                    onValueChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        categoria_slug: v,
                        subcategoria_slug: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      {categorias.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Subcategoria</Label>

                  <Select
                    value={rascunho.subcategoria_slug || "nenhuma"}
                    onValueChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        subcategoria_slug: v === "nenhuma" ? "" : v,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="nenhuma">Sem subcategoria</SelectItem>

                      {subcategoriasDoRascunho.map((s) => (
                        <SelectItem key={s.slug} value={s.slug}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Preço (R$)</Label>

                  <Input
                    inputMode="decimal"
                    value={rascunho.preco}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        preco: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preço promocional (R$)</Label>

                  <Input
                    inputMode="decimal"
                    value={rascunho.preco_promocional}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        preco_promocional: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>

                <Textarea
                  rows={3}
                  value={rascunho.descricao}
                  onChange={(e) =>
                    setRascunho({
                      ...rascunho,
                      descricao: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Foto</Label>

                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded border bg-muted">
                    {rascunho.imagem ? (
                      <img src={rascunho.imagem} alt="Pré-visualização" className="h-full w-full object-contain" />
                    ) : null}
                  </div>

                  <Input
                    type="file"
                    accept="image/*"
                    disabled={enviandoFoto}
                    onChange={(e) => {
                      const f = e.target.files?.[0];

                      if (f) {
                        void escolherFoto(f);
                      }
                    }}
                  />
                </div>

                {enviandoFoto ? <p className="text-xs text-muted-foreground">Enviando foto...</p> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rascunho.disponivel}
                    onCheckedChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        disponivel: v,
                      })
                    }
                  />
                  Disponível
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rascunho.oferta}
                    onCheckedChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        oferta: v,
                      })
                    }
                  />
                  Oferta
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rascunho.rasga_preco}
                    onCheckedChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        rasga_preco: v,
                      })
                    }
                  />
                  Rasga Preço
                </label>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunho(null)}>
              Cancelar
            </Button>

            <Button onClick={confirmarSalvar} disabled={salvando || enviandoFoto}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =====================================================
          MODAL DE BANNER
      ====================================================== */}

      <Dialog open={rascunhoBanner !== null} onOpenChange={(o) => !o && setRascunhoBanner(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{rascunhoBanner?.id ? "Editar banner" : "Adicionar banner"}</DialogTitle>
          </DialogHeader>

          {rascunhoBanner ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Título</Label>

                <Input
                  placeholder="Ex.: Ofertas da semana"
                  value={rascunhoBanner.titulo}
                  onChange={(e) =>
                    setRascunhoBanner({
                      ...rascunhoBanner,
                      titulo: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>

                <Textarea
                  rows={3}
                  placeholder="Descrição opcional do banner"
                  value={rascunhoBanner.descricao}
                  onChange={(e) =>
                    setRascunhoBanner({
                      ...rascunhoBanner,
                      descricao: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Imagem do banner</Label>

                <div className="overflow-hidden rounded-xl border bg-muted">
                  <div className="aspect-[16/6] w-full">
                    {rascunhoBanner.imagem ? (
                      <img
                        src={rascunhoBanner.imagem}
                        alt="Pré-visualização do banner"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Nenhuma imagem selecionada
                      </div>
                    )}
                  </div>
                </div>

                <Input
                  type="file"
                  accept="image/*"
                  disabled={enviandoBanner}
                  onChange={(e) => {
                    const file = e.target.files?.[0];

                    if (file) {
                      void escolherBanner(file);
                    }
                  }}
                />

                {enviandoBanner ? <p className="text-xs text-muted-foreground">Enviando banner...</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Link opcional</Label>

                <Input
                  placeholder="Ex.: /categoria/medicamentos"
                  value={rascunhoBanner.link}
                  onChange={(e) =>
                    setRascunhoBanner({
                      ...rascunhoBanner,
                      link: e.target.value,
                    })
                  }
                />

                <p className="text-xs text-muted-foreground">
                  Se preenchido, poderemos tornar o banner clicável na Home.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ordem</Label>

                  <Input
                    type="number"
                    min="0"
                    value={rascunhoBanner.ordem}
                    onChange={(e) =>
                      setRascunhoBanner({
                        ...rascunhoBanner,
                        ordem: e.target.value,
                      })
                    }
                  />

                  <p className="text-xs text-muted-foreground">0 aparece primeiro, depois 1, 2, 3...</p>
                </div>

                <label className="flex items-center gap-3 sm:pt-8">
                  <Switch
                    checked={rascunhoBanner.ativo}
                    onCheckedChange={(v) =>
                      setRascunhoBanner({
                        ...rascunhoBanner,
                        ativo: v,
                      })
                    }
                  />

                  <span className="text-sm">Banner ativo</span>
                </label>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunhoBanner(null)}>
              Cancelar
            </Button>

            <Button onClick={confirmarSalvarBanner} disabled={salvandoBanner || enviandoBanner}>
              {salvandoBanner ? "Salvando..." : "Salvar banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
