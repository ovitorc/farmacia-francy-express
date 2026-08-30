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
  listarBannersAdmin,
  salvarBanner,
  excluirBanner,
  alternarBanner,
  alterarOrdemBanner,
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
        content: "Painel administrativo das Farmácias Francy.",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: AdminPage,
});

/* ============================================================
   TIPOS
   ============================================================ */

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

type Banner = {
  id: string;
  titulo: string;
  imagem: string;
  ativo: boolean;
  ordem: number;
  created_at?: string;
};

/* ============================================================
   PRODUTO VAZIO
   ============================================================ */

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

/* ============================================================
   PÁGINA ADMIN
   ============================================================ */

function AdminPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ==========================================================
     PRODUTOS
     ========================================================== */

  const { data: catalogo } = useQuery(catalogoQueryOptions);

  const { data: perfil } = useQuery({
    queryKey: ["sou-admin"],
    queryFn: () => souAdmin(),
  });

  const salvar = useServerFn(salvarProduto);
  const excluir = useServerFn(excluirProduto);
  const upload = useServerFn(enviarImagem);
  const destacar = useServerFn(marcarDestaque);

  const [termo, setTermo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  /* ==========================================================
     BANNERS
     ========================================================== */

  const [bannerAberto, setBannerAberto] = useState(false);

  const [bannerEditando, setBannerEditando] = useState<Banner | null>(null);

  const [bannerTitulo, setBannerTitulo] = useState("");

  const [bannerImagem, setBannerImagem] = useState<string | null>(null);

  const [bannerAtivo, setBannerAtivo] = useState(true);

  const [bannerOrdem, setBannerOrdem] = useState("0");

  const [enviandoBanner, setEnviandoBanner] = useState(false);

  const [salvandoBanner, setSalvandoBanner] = useState(false);

  const [excluindoBanner, setExcluindoBanner] = useState<string | null>(null);

  const [alterandoBanner, setAlterandoBanner] = useState<string | null>(null);

  const salvarBannerFn = useServerFn(salvarBanner);

  const excluirBannerFn = useServerFn(excluirBanner);

  const alternarBannerFn = useServerFn(alternarBanner);

  const alterarOrdemBannerFn = useServerFn(alterarOrdemBanner);

  const { data: banners = [] } = useQuery({
    queryKey: ["banners-admin"],
    queryFn: () => listarBannersAdmin(),
    enabled: Boolean(perfil?.admin),
  });

  /* ==========================================================
     CATEGORIAS
     ========================================================== */

  const categorias = catalogo?.categorias ?? [];
  const destaques = catalogo?.produtos ?? [];

  /* ==========================================================
     BUSCA DE PRODUTOS
     ========================================================== */

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

  /* ==========================================================
     SUBCATEGORIAS
     ========================================================== */

  const subcategoriasDoRascunho = categorias.find((c) => c.slug === rascunho?.categoria_slug)?.subcategorias ?? [];

  /* ==========================================================
     ATUALIZAR DADOS
     ========================================================== */

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

    await queryClient.invalidateQueries({
      queryKey: ["banners"],
    });

    await router.invalidate();
  }

  /* ==========================================================
     PRODUTOS
     ========================================================== */

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

  /* ==========================================================
     BANNERS
     ========================================================== */

  function abrirNovoBanner() {
    setBannerEditando(null);
    setBannerTitulo("");
    setBannerImagem(null);
    setBannerAtivo(true);

    const maiorOrdem = banners.length > 0 ? Math.max(...banners.map((b: Banner) => b.ordem)) + 1 : 0;

    setBannerOrdem(String(maiorOrdem));

    setBannerAberto(true);
  }

  function abrirEdicaoBanner(banner: Banner) {
    setBannerEditando(banner);
    setBannerTitulo(banner.titulo ?? "");
    setBannerImagem(banner.imagem);
    setBannerAtivo(banner.ativo);
    setBannerOrdem(String(banner.ordem ?? 0));
    setBannerAberto(true);
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

      const { url } = await upload({
        data: {
          nomeArquivo: file.name,
          tipo: file.type || "image/jpeg",
          conteudoBase64: btoa(binario),
        },
      });

      setBannerImagem(url);

      toast.success("Banner enviado.");
    } catch {
      toast.error("Não foi possível enviar o banner.");
    } finally {
      setEnviandoBanner(false);
    }
  }

  async function confirmarSalvarBanner() {
    if (!bannerImagem) {
      toast.error("Escolha uma imagem para o banner.");
      return;
    }

    setSalvandoBanner(true);

    try {
      await salvarBannerFn({
        data: {
          ...(bannerEditando?.id
            ? {
                id: bannerEditando.id,
              }
            : {}),
          titulo: bannerTitulo.trim(),
          imagem: bannerImagem,
          ativo: bannerAtivo,
          ordem: Number(bannerOrdem) || 0,
        },
      });

      setBannerAberto(false);

      setBannerEditando(null);
      setBannerTitulo("");
      setBannerImagem(null);
      setBannerAtivo(true);
      setBannerOrdem("0");

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners"],
      });

      await router.invalidate();

      toast.success(bannerEditando ? "Banner atualizado." : "Banner adicionado.");
    } catch {
      toast.error("Erro ao salvar o banner.");
    } finally {
      setSalvandoBanner(false);
    }
  }

  async function confirmarExcluirBanner(banner: Banner) {
    if (!confirm(`Excluir o banner "${banner.titulo || "sem título"}"?`)) {
      return;
    }

    setExcluindoBanner(banner.id);

    try {
      await excluirBannerFn({
        data: {
          id: banner.id,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners"],
      });

      await router.invalidate();

      toast.success("Banner excluído.");
    } catch {
      toast.error("Erro ao excluir o banner.");
    } finally {
      setExcluindoBanner(null);
    }
  }

  async function mudarStatusBanner(banner: Banner, ativo: boolean) {
    setAlterandoBanner(banner.id);

    try {
      await alternarBannerFn({
        data: {
          id: banner.id,
          ativo,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners"],
      });

      await router.invalidate();

      toast.success(ativo ? "Banner ativado." : "Banner desativado.");
    } catch {
      toast.error("Não foi possível alterar o banner.");
    } finally {
      setAlterandoBanner(null);
    }
  }

  async function mudarOrdemBanner(banner: Banner, novaOrdem: number) {
    setAlterandoBanner(banner.id);

    try {
      await alterarOrdemBannerFn({
        data: {
          id: banner.id,
          ordem: novaOrdem,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners-admin"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["banners"],
      });

      await router.invalidate();
    } catch {
      toast.error("Não foi possível alterar a ordem.");
    } finally {
      setAlterandoBanner(null);
    }
  }

  /* ==========================================================
     SAIR
     ========================================================== */

  async function sair() {
    await queryClient.cancelQueries();

    queryClient.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/auth",
      replace: true,
    });
  }

  /* ==========================================================
     ACESSO
     ========================================================== */

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

      {/* ======================================================
          ÁREA DE BANNERS
          ====================================================== */}

      <section className="mt-8 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-primary">Banners da página inicial</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Adicione, edite, organize e ative os banners que aparecem na Home.
            </p>
          </div>

          <Button onClick={abrirNovoBanner}>+ Adicionar banner</Button>
        </div>

        {/* ====================================================
            LISTA DE BANNERS
            ==================================================== */}

        <div className="mt-6 space-y-4">
          {banners.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-medium text-foreground">Nenhum banner cadastrado</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Clique em "Adicionar banner" para colocar o primeiro banner da Home.
              </p>
            </div>
          ) : (
            banners.map((banner: Banner) => (
              <div key={banner.id} className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-center">
                {/* IMAGEM */}

                <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg border bg-muted lg:w-64">
                  <img
                    src={banner.imagem}
                    alt={banner.titulo || "Banner da Farmácias Francy"}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* INFORMAÇÕES */}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{banner.titulo || "Banner sem título"}</h3>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        banner.ativo ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {banner.ativo ? "Ativo" : "Desativado"}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">Ordem: {banner.ordem}</p>

                  {/* CONTROLES */}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={banner.ativo}
                        disabled={alterandoBanner === banner.id}
                        onCheckedChange={(valor) => void mudarStatusBanner(banner, valor)}
                      />
                      Ativo
                    </label>

                    <div className="flex items-center gap-2">
                      <Label htmlFor={`ordem-${banner.id}`} className="text-xs">
                        Ordem
                      </Label>

                      <Input
                        id={`ordem-${banner.id}`}
                        type="number"
                        min="0"
                        defaultValue={banner.ordem}
                        className="w-20"
                        disabled={alterandoBanner === banner.id}
                        onBlur={(e) => {
                          const valor = Number(e.target.value);

                          if (valor !== banner.ordem) {
                            void mudarOrdemBanner(banner, valor);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* BOTÕES */}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => abrirEdicaoBanner(banner)}>
                    Editar
                  </Button>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={excluindoBanner === banner.id}
                    onClick={() => void confirmarExcluirBanner(banner)}
                  >
                    {excluindoBanner === banner.id ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ======================================================
          PRODUTOS
          ====================================================== */}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Produtos</h2>

            <p className="text-sm text-muted-foreground">{lista.length} produto(s) listado(s)</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
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

        {/* LISTA DE PRODUTOS */}

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

      {/* ======================================================
          MODAL — BANNER
          ====================================================== */}

      <Dialog
        open={bannerAberto}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setBannerAberto(false);
            setBannerEditando(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{bannerEditando ? "Editar banner" : "Adicionar banner"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* IMAGEM */}

            <div className="space-y-2">
              <Label>Imagem do banner</Label>

              <div className="overflow-hidden rounded-xl border bg-muted">
                {bannerImagem ? (
                  <img
                    src={bannerImagem}
                    alt="Pré-visualização do banner"
                    className="aspect-[16/6] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[16/6] items-center justify-center">
                    <p className="text-sm text-muted-foreground">Nenhuma imagem selecionada</p>
                  </div>
                )}
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

              {enviandoBanner ? (
                <p className="text-xs text-muted-foreground">Enviando banner...</p>
              ) : (
                <p className="text-xs text-muted-foreground">Recomendado: imagem horizontal em formato 16:6.</p>
              )}
            </div>

            {/* TÍTULO */}

            <div className="space-y-2">
              <Label>Título</Label>

              <Input
                placeholder="Ex.: Ofertas da semana"
                value={bannerTitulo}
                onChange={(e) => setBannerTitulo(e.target.value)}
              />
            </div>

            {/* ORDEM */}

            <div className="space-y-2">
              <Label>Ordem de exibição</Label>

              <Input type="number" min="0" value={bannerOrdem} onChange={(e) => setBannerOrdem(e.target.value)} />

              <p className="text-xs text-muted-foreground">Quanto menor o número, mais cedo o banner aparece.</p>
            </div>

            {/* ATIVO */}

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={bannerAtivo} onCheckedChange={setBannerAtivo} />

              <div>
                <p className="text-sm font-medium">Banner ativo</p>

                <p className="text-xs text-muted-foreground">Banners desativados não aparecem na página inicial.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBannerAberto(false)}>
              Cancelar
            </Button>

            <Button onClick={() => void confirmarSalvarBanner()} disabled={salvandoBanner || enviandoBanner}>
              {salvandoBanner ? "Salvando..." : "Salvar banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================
          MODAL — PRODUTO
          ====================================================== */}

      <Dialog open={rascunho !== null} onOpenChange={(aberto) => !aberto && setRascunho(null)}>
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

            <Button onClick={() => void confirmarSalvar()} disabled={salvando || enviandoFoto}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
