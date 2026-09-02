import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
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
  codigo_barras: string;

  nome: string;
  descricao: string;

  categoria_slug: string;
  subcategoria_slug: string;

  fabricante: string;
  unidade: string;

  preco: string;
  preco_promocional: string;

  estoque: string;

  principio_ativo: string;
  registro_ms: string;

  farmacia_popular: boolean;
  preco_farmacia_popular: string;

  imagem: string | null;

  disponivel: boolean;
  oferta: boolean;
  rasga_preco: boolean;
};

type Banner = {
  id: string;
  titulo: string;
  imagem: string;
  imagem_mobile?: string | null;
  ativo: boolean;
  ordem: number;
  created_at?: string;
};

/* ============================================================
   PRODUTO VAZIO
   ============================================================ */

const vazio = (categoriaSlug: string): Rascunho => ({
  codigo: "",
  codigo_barras: "",

  nome: "",
  descricao: "",

  categoria_slug: categoriaSlug,
  subcategoria_slug: "",

  fabricante: "",
  unidade: "",

  preco: "",
  preco_promocional: "",

  estoque: "0",

  principio_ativo: "",
  registro_ms: "",

  farmacia_popular: false,
  preco_farmacia_popular: "",

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

  const [bannerImagemMobile, setBannerImagemMobile] = useState<string | null>(null);

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
     BUSCA
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
    const produtoCompleto = p as Produto & {
      codigo_barras?: string | null;
      fabricante?: string;
      unidade?: string;
      estoque?: number;
      principio_ativo?: string;
      registro_ms?: string;
      farmacia_popular?: boolean;
      preco_farmacia_popular?: number | null;
    };

    setRascunho({
      id: p.id,

      codigo: p.codigo,
      codigo_barras: produtoCompleto.codigo_barras ?? "",

      nome: p.nome,
      descricao: p.descricao,

      categoria_slug: p.categoria,
      subcategoria_slug: p.subcategoria,

      fabricante: produtoCompleto.fabricante ?? "",

      unidade: produtoCompleto.unidade ?? "",

      preco: String(p.preco),

      preco_promocional: p.precoPromocional == null ? "" : String(p.precoPromocional),

      estoque: String(produtoCompleto.estoque ?? 0),

      principio_ativo: produtoCompleto.principio_ativo ?? "",

      registro_ms: produtoCompleto.registro_ms ?? "",

      farmacia_popular: Boolean(produtoCompleto.farmacia_popular),

      preco_farmacia_popular:
        produtoCompleto.preco_farmacia_popular == null ? "" : String(produtoCompleto.preco_farmacia_popular),

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

  /* ==========================================================
     UPLOAD DE PRODUTO
     ========================================================== */

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

  /* ==========================================================
     SALVAR PRODUTO
     ========================================================== */

  async function confirmarSalvar() {
    if (!rascunho) return;

    if (!rascunho.nome.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }

    if (!rascunho.codigo.trim()) {
      toast.error("Informe o código interno do produto.");
      return;
    }

    if (!rascunho.categoria_slug) {
      toast.error("Selecione uma categoria.");
      return;
    }

    setSalvando(true);

    try {
      await salvar({
        data: {
          ...(rascunho.id
            ? {
                id: rascunho.id,
              }
            : {}),

          codigo: rascunho.codigo.trim(),

          codigo_barras: rascunho.codigo_barras.trim() === "" ? null : rascunho.codigo_barras.trim(),

          nome: rascunho.nome.trim(),

          descricao: rascunho.descricao.trim(),

          categoria_slug: rascunho.categoria_slug,

          subcategoria_slug: rascunho.subcategoria_slug,

          fabricante: rascunho.fabricante.trim(),

          unidade: rascunho.unidade.trim(),

          preco: Number(rascunho.preco.replace(",", ".")) || 0,

          preco_promocional:
            rascunho.preco_promocional.trim() === "" ? null : Number(rascunho.preco_promocional.replace(",", ".")),

          estoque: Number(rascunho.estoque) || 0,

          principio_ativo: rascunho.principio_ativo.trim(),

          registro_ms: rascunho.registro_ms.trim(),

          farmacia_popular: rascunho.farmacia_popular,

          preco_farmacia_popular:
            rascunho.preco_farmacia_popular.trim() === ""
              ? null
              : Number(rascunho.preco_farmacia_popular.replace(",", ".")),

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
    } catch (error) {
      console.error(error);

      toast.error("Erro ao salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  /* ==========================================================
     EXCLUIR PRODUTO
     ========================================================== */

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
    setBannerImagemMobile(null);
    setBannerAtivo(true);

    const maiorOrdem = banners.length > 0 ? Math.max(...banners.map((b: Banner) => b.ordem)) + 1 : 0;

    setBannerOrdem(String(maiorOrdem));

    setBannerAberto(true);
  }

  function abrirEdicaoBanner(banner: Banner) {
    setBannerEditando(banner);

    setBannerTitulo(banner.titulo ?? "");

    setBannerImagem(banner.imagem);

    setBannerImagemMobile(banner.imagem_mobile ?? null);

    setBannerAtivo(banner.ativo);

    setBannerOrdem(String(banner.ordem ?? 0));

    setBannerAberto(true);
  }

  async function escolherBanner(file: File, destino: "desktop" | "mobile" = "desktop") {
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

      if (destino === "mobile") {
        setBannerImagemMobile(url);
      } else {
        setBannerImagem(url);
      }

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

          imagem_mobile: bannerImagemMobile,

          ativo: bannerAtivo,

          ordem: Number(bannerOrdem) || 0,
        },
      });

      setBannerAberto(false);

      setBannerEditando(null);
      setBannerTitulo("");
      setBannerImagem(null);
      setBannerImagemMobile(null);
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
          <Button variant="outline" asChild>
            <Link to="/imagens">Imagens dos produtos</Link>
          </Button>

          <Button variant="outline" onClick={sair}>
            Sair
          </Button>

          <Button onClick={abrirNovo}>Novo produto</Button>
        </div>

      </div>

      {/* ======================================================
          BANNERS
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
                <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg border bg-muted lg:w-64">
                  <img
                    src={banner.imagem}
                    alt={banner.titulo || "Banner da Farmácias Francy"}
                    className="h-full w-full object-cover"
                  />
                </div>

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
                <p className="text-xs text-muted-foreground">
                  Recomendado para computador: imagem horizontal 1600 x 600 px.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Imagem para celular (opcional)</Label>

              <div className="mx-auto w-48 overflow-hidden rounded-xl border bg-muted">
                {bannerImagemMobile ? (
                  <img
                    src={bannerImagemMobile}
                    alt="Pré-visualização do banner para celular"
                    className="aspect-[4/5] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] items-center justify-center">
                    <p className="px-3 text-center text-xs text-muted-foreground">Sem imagem de celular</p>
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
                    void escolherBanner(file, "mobile");
                  }
                }}
              />

              <p className="text-xs text-muted-foreground">
                Recomendado para celular: 1080 x 1350 px (4:5). Sem esta imagem, o celular usa a versão de computador
                sem deformar.
              </p>

              {bannerImagemMobile && (
                <button
                  type="button"
                  onClick={() => setBannerImagemMobile(null)}
                  className="text-xs font-medium text-muted-foreground underline"
                >
                  Remover imagem de celular
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Título</Label>

              <Input
                placeholder="Ex.: Ofertas da semana"
                value={bannerTitulo}
                onChange={(e) => setBannerTitulo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Ordem de exibição</Label>

              <Input type="number" min="0" value={bannerOrdem} onChange={(e) => setBannerOrdem(e.target.value)} />

              <p className="text-xs text-muted-foreground">Quanto menor o número, mais cedo o banner aparece.</p>
            </div>

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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{rascunho?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          {rascunho ? (
            <div className="space-y-6">
              {/* ==================================================
                  IDENTIFICAÇÃO
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Identificação</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome *</Label>

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
                    <Label>Código interno *</Label>

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
                    <Label>Código de barras</Label>

                    <Input
                      inputMode="numeric"
                      placeholder="Ex.: 7891234567890"
                      value={rascunho.codigo_barras}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          codigo_barras: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fabricante</Label>

                    <Input
                      placeholder="Ex.: EMS"
                      value={rascunho.fabricante}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          fabricante: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unidade</Label>

                    <Input
                      placeholder="Ex.: caixa, frasco, unidade"
                      value={rascunho.unidade}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          unidade: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estoque</Label>

                    <Input
                      type="number"
                      min="0"
                      value={rascunho.estoque}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          estoque: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* ==================================================
                  CATEGORIA
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Categoria</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoria *</Label>

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
                </div>
              </div>

              {/* ==================================================
                  PREÇOS
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Preços</h3>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Preço normal (R$)</Label>

                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
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
                      placeholder="0,00"
                      value={rascunho.preco_promocional}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          preco_promocional: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Preço Farmácia Popular (R$)</Label>

                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={rascunho.preco_farmacia_popular}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          preco_farmacia_popular: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-lg border p-3">
                  <Switch
                    checked={rascunho.farmacia_popular}
                    onCheckedChange={(v) =>
                      setRascunho({
                        ...rascunho,
                        farmacia_popular: v,
                      })
                    }
                  />

                  <div>
                    <p className="text-sm font-medium">Farmácia Popular</p>

                    <p className="text-xs text-muted-foreground">
                      Marque se este produto participa da Farmácia Popular.
                    </p>
                  </div>
                </div>
              </div>

              {/* ==================================================
                  INFORMAÇÕES DO MEDICAMENTO
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Informações do produto</h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Princípio ativo</Label>

                    <Input
                      placeholder="Ex.: Loratadina"
                      value={rascunho.principio_ativo}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          principio_ativo: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Registro MS</Label>

                    <Input
                      placeholder="Ex.: 123456789"
                      value={rascunho.registro_ms}
                      onChange={(e) =>
                        setRascunho({
                          ...rascunho,
                          registro_ms: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Descrição</Label>

                  <Textarea
                    rows={4}
                    value={rascunho.descricao}
                    onChange={(e) =>
                      setRascunho({
                        ...rascunho,
                        descricao: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* ==================================================
                  FOTO
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Imagem</h3>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {rascunho.imagem ? (
                      <img src={rascunho.imagem} alt="Pré-visualização" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={enviandoFoto}
                      onChange={(e) => {
                        const file = e.target.files?.[0];

                        if (file) {
                          void escolherFoto(file);
                        }
                      }}
                    />

                    {enviandoFoto ? (
                      <p className="mt-2 text-xs text-muted-foreground">Enviando foto...</p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Selecione uma imagem do produto.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ==================================================
                  STATUS
                  ================================================== */}

              <div>
                <h3 className="mb-3 text-sm font-semibold text-primary">Status do produto</h3>

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <Switch
                      checked={rascunho.disponivel}
                      onCheckedChange={(v) =>
                        setRascunho({
                          ...rascunho,
                          disponivel: v,
                        })
                      }
                    />

                    <span>Disponível</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <Switch
                      checked={rascunho.oferta}
                      onCheckedChange={(v) =>
                        setRascunho({
                          ...rascunho,
                          oferta: v,
                        })
                      }
                    />

                    <span>Oferta</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                    <Switch
                      checked={rascunho.rasga_preco}
                      onCheckedChange={(v) =>
                        setRascunho({
                          ...rascunho,
                          rasga_preco: v,
                        })
                      }
                    />

                    <span>Rasga Preço</span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRascunho(null)}>
              Cancelar
            </Button>

            <Button onClick={() => void confirmarSalvar()} disabled={salvando || enviandoFoto}>
              {salvando ? "Salvando..." : "Salvar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
