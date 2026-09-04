import {
  createFileRoute,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";

import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  useServerFn,
} from "@tanstack/react-start";

import {
  useMemo,
  useState,
} from "react";

import {
  toast,
} from "sonner";

import {
  supabase,
} from "@/integrations/supabase/client";

import {
  buscaQueryOptions,
  catalogoQueryOptions,
  listaQueryOptions,
} from "@/lib/catalog-context";

import {
  formatarPreco,
  type Produto,
} from "@/lib/catalog";

import {
  salvarProduto,
  excluirProduto,
  enviarImagem,
  souAdmin,
  marcarDestaque,
} from "@/lib/admin.functions";

import {
  buscarCandidatos,
  aplicarCandidato,
} from "@/lib/images.functions";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  Switch,
} from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route =
  createFileRoute(
    "/_authenticated/admin",
  )({
    head: () => ({
      meta: [
        {
          title:
            "Painel de produtos | Farmácias Francy",
        },
        {
          name:
            "description",

          content:
            "Cadastre, edite e remova produtos do catálogo das Farmácias Francy.",
        },
        {
          property:
            "og:title",

          content:
            "Painel de produtos | Farmácias Francy",
        },
        {
          property:
            "og:description",

          content:
            "Gerencie produtos, preços, ofertas e fotos do catálogo.",
        },
        {
          property:
            "og:type",

          content:
            "website",
        },
        {
          name:
            "twitter:card",

          content:
            "summary",
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
      AdminPage,
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


type CandidatoImagem = {
  imageUrl: string;

  source: string;

  sourceUrl?: string;

  licenca?: string;

  confianca: number;

  conflito?: boolean;

  motivos?: string[];

  ean?: string;

  eanConfirmado?: boolean;
};


const vazio = (
  categoriaSlug: string,
): Rascunho => ({
  codigo: "",

  nome: "",

  descricao: "",

  categoria_slug:
    categoriaSlug,

  subcategoria_slug:
    "",

  preco: "",

  preco_promocional:
    "",

  imagem:
    null,

  disponivel:
    true,

  oferta:
    false,

  rasga_preco:
    false,
});


function AdminPage() {

  const router =
    useRouter();

  const navigate =
    useNavigate();

  const queryClient =
    useQueryClient();


  const {
    data: catalogo,
  } = useQuery(
    catalogoQueryOptions,
  );


  const {
    data: perfil,
  } = useQuery({
    queryKey: [
      "sou-admin",
    ],

    queryFn: () =>
      souAdmin(),
  });


  const salvar =
    useServerFn(
      salvarProduto,
    );

  const excluir =
    useServerFn(
      excluirProduto,
    );

  const upload =
    useServerFn(
      enviarImagem,
    );

  const destacar =
    useServerFn(
      marcarDestaque,
    );

  const buscarFotos =
    useServerFn(
      buscarCandidatos,
    );

  const aplicarFoto =
    useServerFn(
      aplicarCandidato,
    );


  const [
    termo,
    setTermo,
  ] =
    useState("");


  const [
    filtroCategoria,
    setFiltroCategoria,
  ] =
    useState("todas");


  const [
    rascunho,
    setRascunho,
  ] =
    useState<Rascunho | null>(
      null,
    );


  const [
    salvando,
    setSalvando,
  ] =
    useState(false);


  const [
    enviandoFoto,
    setEnviandoFoto,
  ] =
    useState(false);


  const [
    marcandoId,
    setMarcandoId,
  ] =
    useState<string | null>(
      null,
    );


  const [
    buscandoFotos,
    setBuscandoFotos,
  ] =
    useState(false);


  const [
    candidatos,
    setCandidatos,
  ] =
    useState<
      CandidatoImagem[]
    >([]);


  const [
    dialogFotos,
    setDialogFotos,
  ] =
    useState(false);


  const [
    produtoFotos,
    setProdutoFotos,
  ] =
    useState<Produto | null>(
      null,
    );


  const [
    aplicandoImagem,
    setAplicandoImagem,
  ] =
    useState<string | null>(
      null,
    );


  const categorias =
    catalogo?.categorias ??
    [];


  const destaques =
    catalogo?.produtos ??
    [];


  const termoBusca =
    termo.trim();


  const {
    data: resultadoBusca,
  } =
    useQuery({
      ...buscaQueryOptions(
        termoBusca,
        60,
      ),

      enabled:
        termoBusca.length >
        1,
    });


  const {
    data: pagina,
  } =
    useQuery({
      ...listaQueryOptions({
        categoria:
          filtroCategoria,
      }),

      enabled:
        termoBusca.length <=
          1 &&
        filtroCategoria !==
          "todas",
    });


  const lista =
    useMemo(() => {

      if (
        termoBusca.length >
        1
      ) {

        const base =
          resultadoBusca ??
          [];

        return filtroCategoria ===
          "todas"
          ? base
          : base.filter(
              (
                p,
              ) =>
                p.categoria ===
                filtroCategoria,
            );

      }


      if (
        filtroCategoria !==
        "todas"
      ) {

        return (
          pagina?.itens ??
          []
        );

      }


      /**
       * PRODUTOS COM IMAGEM
       * APARECEM PRIMEIRO.
       */

      return [
        ...destaques,
      ].sort(
        (
          a,
          b,
        ) => {

          const aImagem =
            Boolean(
              a.imagem,
            );

          const bImagem =
            Boolean(
              b.imagem,
            );


          if (
            aImagem !==
            bImagem
          ) {

            return aImagem
              ? -1
              : 1;

          }


          return (
            a.nome.localeCompare(
              b.nome,
              "pt-BR",
            )
          );

        },
      );

    }, [

      termoBusca,

      resultadoBusca,

      pagina,

      destaques,

      filtroCategoria,

    ]);


  const subcategoriasDoRascunho =

    categorias.find(
      (
        c,
      ) =>
        c.slug ===
        rascunho?.categoria_slug,
    )?.subcategorias ??

    [];


  function abrirNovo() {

    setCandidatos([]);

    setRascunho(
      vazio(
        categorias[0]?.slug ??
        "",
      ),
    );

  }


  function abrirEdicao(
    p: Produto,
  ) {

    setCandidatos([]);

    setRascunho({

      id:
        p.id,

      codigo:
        p.codigo,

      nome:
        p.nome,

      descricao:
        p.descricao,

      categoria_slug:
        p.categoria,

      subcategoria_slug:
        p.subcategoria,

      preco:
        String(
          p.preco,
        ),

      preco_promocional:

        p.precoPromocional ==
        null

          ? ""

          : String(
              p.precoPromocional,
            ),

      imagem:

        p.imagem ??
        null,

      disponivel:
        p.disponivel,

      oferta:
        p.oferta,

      rasga_preco:
        Boolean(
          p.rasgaPreco,
        ),

    });

  }


  async function atualizarTudo() {

    await queryClient.invalidateQueries({
      queryKey: [
        "catalogo",
      ],
    });


    await queryClient.invalidateQueries({
      queryKey: [
        "busca",
      ],
    });


    await queryClient.invalidateQueries({
      queryKey: [
        "produtos",
      ],
    });


    await router.invalidate();

  }


  async function alternar(

    p: Produto,

    campo:
      | "oferta"
      | "rasga_preco",

    valor:
      boolean,

  ) {

    setMarcandoId(
      p.id,
    );


    try {

      await destacar({

        data: {

          id:
            p.id,

          campo,

          valor,

        },

      });


      await atualizarTudo();


      toast.success(

        `${
          campo ===
          "oferta"

            ? "Oferta"

            : "Rasga Preço"
        } ${
          valor

            ? "ativado"

            : "removido"
        }.`,
      );

    } catch {

      toast.error(
        "Não foi possível atualizar o destaque.",
      );

    } finally {

      setMarcandoId(
        null,
      );

    }

  }


  async function escolherFoto(
    file: File,
  ) {

    setEnviandoFoto(
      true,
    );


    try {

      const buffer =
        await file.arrayBuffer();


      let binario =
        "";


      const bytes =
        new Uint8Array(
          buffer,
        );


      for (

        let i = 0;

        i <
        bytes.length;

        i += 1

      ) {

        binario +=
          String.fromCharCode(
            bytes[i]!,
          );

      }


      const {
        url,
      } =
        await upload({

          data: {

            nomeArquivo:
              file.name,

            tipo:

              file.type ||

              "image/jpeg",

            conteudoBase64:

              btoa(
                binario,
              ),

          },

        });


      setRascunho(
        (
          r,
        ) =>

          r

            ? {
                ...r,

                imagem:
                  url,
              }

            : r,
      );


      toast.success(
        "Foto enviada.",
      );

    } catch {

      toast.error(
        "Não foi possível enviar a foto.",
      );

    } finally {

      setEnviandoFoto(
        false,
      );

    }

  }


  async function procurarImagens(
    p: Produto,
  ) {

    setProdutoFotos(
      p,
    );


    setCandidatos(
      [],
    );


    setDialogFotos(
      true,
    );


    setBuscandoFotos(
      true,
    );


    try {

      const resultado =
        await buscarFotos({

          data: {

            produtoId:
              p.id,

          },

        });


      const imagens =
        (
          resultado.candidatos ??
          []
        ).slice(
          0,
          20,
        );


      setCandidatos(
        imagens,
      );


      if (
        imagens.length ===
        0
      ) {

        toast.info(
          "Nenhuma imagem encontrada para este produto.",
        );

      } else {

        toast.success(

          `${imagens.length} imagem(ns) encontrada(s).`,
        );

      }

    } catch (
      erro,
    ) {

      console.error(
        erro,
      );


      toast.error(
        "Não foi possível procurar imagens.",
      );

    } finally {

      setBuscandoFotos(
        false,
      );

    }

  }


  async function selecionarImagem(

    candidato:
      CandidatoImagem,

  ) {

    if (
      !produtoFotos
    ) {

      return;

    }


    setAplicandoImagem(
      candidato.imageUrl,
    );


    try {

      const resultado =
        await aplicarFoto({

          data: {

            produtoId:
              produtoFotos.id,

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

              candidato.confianca ??
              100,

          },

        });


      /**
       * Atualiza a imagem
       * caso o mesmo produto esteja
       * sendo editado.
       */

      setRascunho(
        (
          r,
        ) => {

          if (
            !r ||
            r.id !==
              produtoFotos.id
          ) {

            return r;

          }


          return {

            ...r,

            imagem:
              resultado.url,

          };

        },
      );


      await atualizarTudo();


      toast.success(
        "Imagem aplicada ao produto.",
      );


      setDialogFotos(
        false,

      );

    } catch (
      erro,
    ) {

      console.error(
        erro,
      );


      toast.error(
        "Não foi possível aplicar esta imagem.",
      );

    } finally {

      setAplicandoImagem(
        null,
      );

    }

  }


  async function confirmarSalvar() {

    if (
      !rascunho
    ) {

      return;

    }


    setSalvando(
      true,
    );


    try {

      await salvar({

        data: {

          ...(

            rascunho.id

              ? {
                  id:
                    rascunho.id,
                }

              : {}
          ),

          codigo:

            rascunho.codigo.trim(),

          nome:

            rascunho.nome.trim(),

          descricao:

            rascunho.descricao,

          categoria_slug:

            rascunho.categoria_slug,

          subcategoria_slug:

            rascunho.subcategoria_slug,

          preco:

            Number(

              rascunho.preco.replace(
                ",",
                ".",
              ),

            ) ||

            0,

          preco_promocional:

            rascunho.preco_promocional.trim() ===
            ""

              ? null

              : Number(

                  rascunho.preco_promocional.replace(
                    ",",
                    ".",
                  ),

                ),

          imagem:

            rascunho.imagem,

          disponivel:

            rascunho.disponivel,

          oferta:

            rascunho.oferta,

          rasga_preco:

            rascunho.rasga_preco,

          informacoes:
            [],

        },

      });


      setRascunho(
        null,
      );


      await atualizarTudo();


      toast.success(
        "Produto salvo.",
      );

    } catch (
      erro,
    ) {

      console.error(
        erro,
      );


      toast.error(
        "Erro ao salvar o produto.",
      );

    } finally {

      setSalvando(
        false,
      );

    }

  }


  async function confirmarExcluir(
    p: Produto,
  ) {

    if (
      !confirm(
        `Excluir "${p.nome}"?`,
      )
    ) {

      return;

    }


    try {

      await excluir({

        data: {

          id:
            p.id,

        },

      });


      await atualizarTudo();


      toast.success(
        "Produto excluído.",
      );

    } catch {

      toast.error(
        "Erro ao excluir o produto.",
      );

    }

  }


  async function sair() {

    await queryClient.cancelQueries();


    queryClient.clear();


    await supabase.auth.signOut();


    navigate({

      to:
        "/auth",

      replace:
        true,

    });

  }


  if (

    perfil &&

    !perfil.admin

  ) {

    return (

      <div
        className="
          mx-auto
          max-w-lg
          px-4
          py-16
          text-center
        "
      >

        <h1
          className="
            text-xl
            font-semibold
            text-primary
          "
        >

          Acesso restrito

        </h1>


        <p
          className="
            mt-2
            text-sm
            text-muted-foreground
          "
        >

          Sua conta não tem permissão de administrador.

        </p>


        <Button

          className="
            mt-6
          "

          variant="
            outline
          "

          onClick={
            sair
          }
        >

          Sair

        </Button>

      </div>

    );

  }


  return (

    <div
      className="
        mx-auto
        w-full
        max-w-6xl
        px-4
        py-8
      "
    >

      <div
        className="
          flex
          flex-wrap
          items-center
          justify-between
          gap-3
        "
      >

        <div>

          <h1
            className="
              text-2xl
              font-bold
              text-primary
            "
          >

            Painel de produtos

          </h1>


          <p
            className="
              text-sm
              text-muted-foreground
            "
          >

            {lista.length} produto(s) listado(s)

          </p>

        </div>


        <div
          className="
            flex
            gap-2
          "
        >

          <Button

            variant="
              outline
            "

            onClick={
              sair
            }
          >

            Sair

          </Button>


          <Button
            onClick={
              abrirNovo
            }
          >

            Novo produto

          </Button>

        </div>

      </div>


      <div
        className="
          mt-6
          flex
          flex-wrap
          gap-3
        "
      >

        <Input

          placeholder="
            Buscar por nome ou código
          "

          value={
            termo
          }

          onChange={(
            e,
          ) =>
            setTermo(
              e.target.value,
            )
          }

          className="
            max-w-xs
          "
        />


        <Select

          value={
            filtroCategoria
          }

          onValueChange={
            setFiltroCategoria
          }
        >

          <SelectTrigger
            className="
              w-56
            "
          >

            <SelectValue
              placeholder="
                Categoria
              "
            />

          </SelectTrigger>


          <SelectContent>

            <SelectItem
              value="
                todas
              "
            >

              Todas as categorias

            </SelectItem>


            {categorias.map(
              (
                c,
              ) => (

                <SelectItem

                  key={
                    c.slug
                  }

                  value={
                    c.slug
                  }
                >

                  {c.nome}

                </SelectItem>

              ),
            )}

          </SelectContent>

        </Select>

      </div>


      <div
        className="
          mt-6
          divide-y
          rounded-lg
          border
        "
      >

        {lista.map(
          (
            p,
          ) => (

            <div

              key={
                p.id
              }

              className="
                flex
                flex-wrap
                items-center
                gap-3
                p-3
              "
            >

              <div
                className="
                  h-14
                  w-14
                  shrink-0
                  overflow-hidden
                  rounded
                  border
                  bg-muted
                "
              >

                {p.imagem ? (

                  <img

                    src={
                      p.imagem
                    }

                    alt={
                      p.nome
                    }

                    className="
                      h-full
                      w-full
                      object-contain
                    "
                  />

                ) : null}

              </div>


              <div
                className="
                  min-w-40
                  flex-1
                "
              >

                <p
                  className="
                    font-medium
                    text-foreground
                  "
                >

                  {p.nome}

                </p>


                <p
                  className="
                    text-xs
                    text-muted-foreground
                  "
                >

                  {p.codigo}

                  {" · "}

                  {formatarPreco(
                    p.precoPromocional ??
                    p.preco,
                  )}

                  {p.disponivel

                    ? ""

                    : " · indisponível"}

                </p>

              </div>


              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-3
                "
              >

                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                  "
                >

                  <Switch

                    checked={
                      p.oferta
                    }

                    disabled={
                      marcandoId ===
                      p.id
                    }

                    onCheckedChange={(
                      v,
                    ) =>
                      void alternar(
                        p,
                        "oferta",
                        v,
                      )
                    }
                  />

                  Oferta

                </label>


                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-xs
                  "
                >

                  <Switch

                    checked={
                      Boolean(
                        p.rasgaPreco,
                      )
                    }

                    disabled={
                      marcandoId ===
                      p.id
                    }

                    onCheckedChange={(
                      v,
                    ) =>
                      void alternar(
                        p,
                        "rasga_preco",
                        v,
                      )
                    }
                  />

                  Rasga Preço

                </label>


                <Button

                  size="
                    sm
                  "

                  variant="
                    secondary
                  "

                  onClick={() =>
                    void procurarImagens(
                      p,
                    )
                  }
                >

                  Buscar fotos

                </Button>


                <Button

                  size="
                    sm
                  "

                  variant="
                    outline
                  "

                  onClick={() =>
                    abrirEdicao(
                      p,
                    )
                  }
                >

                  Editar

                </Button>


                <Button

                  size="
                    sm
                  "

                  variant="
                    destructive
                  "

                  onClick={() =>
                    confirmarExcluir(
                      p,
                    )
                  }
                >

                  Excluir

                </Button>

              </div>

            </div>

          ),
        )}


        {lista.length ===
        0 ? (

          <p
            className="
              p-6
              text-center
              text-sm
              text-muted-foreground
            "
          >

            Nenhum produto encontrado.

          </p>

        ) : null}

      </div>


      {/* =====================================================
          MODAL DE EDIÇÃO
         ===================================================== */}

      <Dialog

        open={
          rascunho !==
          null
        }

        onOpenChange={(
          aberto,
        ) => {

          if (
            !aberto
          ) {

            setRascunho(
              null,
            );

          }

        }}
      >

        <DialogContent
          className="
            max-h-[90vh]
            overflow-y-auto
            sm:max-w-lg
          "
        >

          <DialogHeader>

            <DialogTitle>

              {rascunho?.id

                ? "Editar produto"

                : "Novo produto"}

            </DialogTitle>

          </DialogHeader>


          {rascunho ? (

            <div
              className="
                space-y-4
              "
            >

              <div
                className="
                  grid
                  gap-4
                  sm:grid-cols-2
                "
              >

                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Nome
                  </Label>


                  <Input

                    value={
                      rascunho.nome
                    }

                    onChange={(
                      e,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        nome:
                          e.target.value,

                      })

                    }
                  />

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Código interno
                  </Label>


                  <Input

                    value={
                      rascunho.codigo
                    }

                    onChange={(
                      e,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        codigo:
                          e.target.value,

                      })

                    }
                  />

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Categoria
                  </Label>


                  <Select

                    value={
                      rascunho.categoria_slug
                    }

                    onValueChange={(
                      v,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        categoria_slug:
                          v,

                        subcategoria_slug:
                          "",

                      })

                    }
                  >

                    <SelectTrigger>

                      <SelectValue
                        placeholder="
                          Selecione
                        "
                      />

                    </SelectTrigger>


                    <SelectContent>

                      {categorias.map(
                        (
                          c,
                        ) => (

                          <SelectItem

                            key={
                              c.slug
                            }

                            value={
                              c.slug
                            }
                          >

                            {c.nome}

                          </SelectItem>

                        ),
                      )}

                    </SelectContent>

                  </Select>

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Subcategoria
                  </Label>


                  <Select

                    value={

                      rascunho.subcategoria_slug ||

                      "nenhuma"

                    }

                    onValueChange={(
                      v,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        subcategoria_slug:

                          v ===
                          "nenhuma"

                            ? ""

                            : v,

                      })

                    }
                  >

                    <SelectTrigger>

                      <SelectValue
                        placeholder="
                          Selecione
                        "
                      />

                    </SelectTrigger>


                    <SelectContent>

                      <SelectItem
                        value="
                          nenhuma
                        "
                      >

                        Sem subcategoria

                      </SelectItem>


                      {subcategoriasDoRascunho.map(
                        (
                          s,
                        ) => (

                          <SelectItem

                            key={
                              s.slug
                            }

                            value={
                              s.slug
                            }
                          >

                            {s.nome}

                          </SelectItem>

                        ),
                      )}

                    </SelectContent>

                  </Select>

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Preço (R$)
                  </Label>


                  <Input

                    inputMode="
                      decimal
                    "

                    value={
                      rascunho.preco
                    }

                    onChange={(
                      e,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        preco:
                          e.target.value,

                      })

                    }
                  />

                </div>


                <div
                  className="
                    space-y-2
                  "
                >

                  <Label>
                    Preço promocional (R$)
                  </Label>


                  <Input

                    inputMode="
                      decimal
                    "

                    value={
                      rascunho.preco_promocional
                    }

                    onChange={(
                      e,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        preco_promocional:
                          e.target.value,

                      })

                    }
                  />

                </div>

              </div>


              <div
                className="
                  space-y-2
                "
              >

                <Label>
                  Descrição
                </Label>


                <Textarea

                  rows={
                    3
                  }

                  value={
                    rascunho.descricao
                  }

                  onChange={(
                    e,
                  ) =>

                    setRascunho({

                      ...rascunho,

                      descricao:
                        e.target.value,

                    })

                  }
                />

              </div>


              <div
                className="
                  space-y-2
                "
              >

                <Label>
                  Foto manual
                </Label>


                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >

                  <div
                    className="
                      h-16
                      w-16
                      overflow-hidden
                      rounded
                      border
                      bg-muted
                    "
                  >

                    {rascunho.imagem ? (

                      <img

                        src={
                          rascunho.imagem
                        }

                        alt="
                          Pré-visualização
                        "

                        className="
                          h-full
                          w-full
                          object-contain
                        "
                      />

                    ) : null}

                  </div>


                  <Input

                    type="
                      file
                    "

                    accept="
                      image/*
                    "

                    disabled={
                      enviandoFoto
                    }

                    onChange={(
                      e,
                    ) => {

                      const f =
                        e.target.files?.[0];

                      if (
                        f
                      ) {

                        void escolherFoto(
                          f,
                        );

                      }

                    }}
                  />

                </div>


                {enviandoFoto ? (

                  <p
                    className="
                      text-xs
                      text-muted-foreground
                    "
                  >

                    Enviando foto...

                  </p>

                ) : null}

              </div>


              <div
                className="
                  grid
                  gap-3
                  sm:grid-cols-3
                "
              >

                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                  "
                >

                  <Switch

                    checked={
                      rascunho.disponivel
                    }

                    onCheckedChange={(
                      v,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        disponivel:
                          v,

                      })

                    }
                  />

                  Disponível

                </label>


                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                  "
                >

                  <Switch

                    checked={
                      rascunho.oferta
                    }

                    onCheckedChange={(
                      v,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        oferta:
                          v,

                      })

                    }
                  />

                  Oferta

                </label>


                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                  "
                >

                  <Switch

                    checked={
                      rascunho.rasga_preco
                    }

                    onCheckedChange={(
                      v,
                    ) =>

                      setRascunho({

                        ...rascunho,

                        rasga_preco:
                          v,

                      })

                    }
                  />

                  Rasga Preço

                </label>

              </div>

            </div>

          ) : null}


          <DialogFooter>

            <Button

              variant="
                outline
              "

              onClick={() =>
                setRascunho(
                  null,
                )
              }
            >

              Cancelar

            </Button>


            <Button

              onClick={
                confirmarSalvar
              }

              disabled={

                salvando ||

                enviandoFoto

              }
            >

              {salvando

                ? "Salvando..."

                : "Salvar"}

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>


      {/* =====================================================
          MODAL DAS 20 IMAGENS
         ===================================================== */}

      <Dialog

        open={
          dialogFotos
        }

        onOpenChange={(
          aberto,
        ) => {

          setDialogFotos(
            aberto,
          );


          if (
            !aberto
          ) {

            setCandidatos(
              [],
            );

            setProdutoFotos(
              null,
            );

          }

        }}
      >

        <DialogContent
          className="
            max-h-[90vh]
            max-w-5xl
            overflow-y-auto
          "
        >

          <DialogHeader>

            <DialogTitle>

              Buscar imagens

            </DialogTitle>

          </DialogHeader>


          <div
            className="
              space-y-4
            "
          >

            <div>

              <p
                className="
                  font-medium
                "
              >

                {
                  produtoFotos?.nome
                }

              </p>


              <p
                className="
                  text-sm
                  text-muted-foreground
                "
              >

                Código interno:

                {" "}

                {
                  produtoFotos?.codigo
                }

              </p>

            </div>


            {buscandoFotos ? (

              <div
                className="
                  py-16
                  text-center
                  text-sm
                  text-muted-foreground
                "
              >

                Procurando até 20 imagens...

              </div>

            ) : null}


            {!buscandoFotos &&

            candidatos.length >
              0 ? (

              <div
                className="
                  grid
                  grid-cols-2
                  gap-4
                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-5
                "
              >

                {candidatos.map(
                  (
                    candidato,
                    index,
                  ) => (

                    <button

                      key={

                        `${candidato.imageUrl}-${index}`

                      }

                      type="
                        button
                      "

                      disabled={

                        aplicandoImagem ===

                        candidato.imageUrl

                      }

                      onClick={() =>
                        void selecionarImagem(
                          candidato,
                        )
                      }

                      className="
                        group
                        overflow-hidden
                        rounded-lg
                        border
                        bg-white
                        text-left
                        transition
                        hover:border-primary
                        hover:shadow-md
                        disabled:opacity-50
                      "
                    >

                      <div
                        className="
                          aspect-square
                          bg-muted
                          p-2
                        "
                      >

                        <img

                          src={
                            candidato.imageUrl
                          }

                          alt={

                            `Imagem candidata ${index + 1}`

                          }

                          className="
                            h-full
                            w-full
                            object-contain
                          "

                          loading="
                            lazy
                          "
                        />

                      </div>


                      <div
                        className="
                          space-y-1
                          p-2
                        "
                      >

                        <p
                          className="
                            truncate
                            text-xs
                            font-medium
                          "
                        >

                          {
                            candidato.source
                          }

                        </p>


                        <p
                          className="
                            text-xs
                            text-muted-foreground
                          "
                        >

                          Relevância:

                          {" "}

                          {

                            Math.round(

                              candidato.confianca ??

                              0,

                            )

                          }

                          %

                        </p>


                        {candidato.eanConfirmado ? (

                          <p
                            className="
                              text-xs
                              font-medium
                              text-green-600
                            "
                          >

                            ✓ Código confirmado

                          </p>

                        ) : null}


                        {aplicandoImagem ===

                        candidato.imageUrl ? (

                          <p
                            className="
                              text-xs
                              text-primary
                            "
                          >

                            Aplicando...

                          </p>

                        ) : (

                          <p
                            className="
                              text-xs
                              text-primary
                            "
                          >

                            Clique para escolher

                          </p>

                        )}

                      </div>

                    </button>

                  ),
                )}

              </div>

            ) : null}


            {!buscandoFotos &&

            candidatos.length ===
              0 ? (

              <div
                className="
                  py-10
                  text-center
                  text-sm
                  text-muted-foreground
                "
              >

                Nenhuma imagem encontrada.

              </div>

            ) : null}

          </div>


          <DialogFooter>

            <Button

              variant="
                outline
              "

              onClick={() =>
                setDialogFotos(
                  false,
                )
              }
            >

              Fechar

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>

    </div>

  );

}