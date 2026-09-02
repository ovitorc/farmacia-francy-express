import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/imagens")({
  head: () => ({
    meta: [
      { title: "Imagens dos produtos | Farmácias Francy" },
      { name: "description", content: "Busca e curadoria das imagens do catálogo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImagensPage,
});

type Filtro = "todos" | "sem_imagem" | "com_imagem" | "manual_review" | "not_found" | "error" | "approved";

function ImagensPage() {
  const qc = useQueryClient();

  const fnEstatisticas = useServerFn(estatisticasImagens);
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
  const [pagina, setPagina] = useState(1);
  const porPagina = 24;

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

  const lista = useQuery({
    queryKey: ["imagens", "lista", filtro, termoBusca, pagina],
    queryFn: () =>
      fnListar({
        data: { filtro, busca: termoBusca, comEan: "qualquer", fabricante: "", categoria: "", pagina, porPagina },
      }),
  });

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ["imagens"] });
  };

  const abrirProduto = async (produto: any) => {
    setSelecionado(produto);
    setCandidatos([]);
    setTermoManual("");
    setCarregandoCandidatos(true);

    try {
      const r = await fnCandidatos({ data: { produtoId: produto.id } });
      setCandidatos(r.candidatos ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar imagens.");
    } finally {
      setCarregandoCandidatos(false);
    }
  };

  const buscarComTermo = async () => {
    if (!selecionado) return;
    setCarregandoCandidatos(true);

    try {
      const r = await fnCandidatos({ data: { produtoId: selecionado.id, termo: termoManual } });
      setCandidatos(r.candidatos ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na busca.");
    } finally {
      setCarregandoCandidatos(false);
    }
  };

  const aplicarMutation = useMutation({
    mutationFn: (c: any) =>
      fnAplicar({
        data: {
          produtoId: selecionado.id,
          imageUrl: c.imageUrl,
          source: c.source ?? "manual",
          sourceUrl: c.sourceUrl,
          licenca: c.licenca,
          confianca: Math.round(c.confianca ?? 100),
        },
      }),
    onSuccess: () => {
      toast.success("Imagem aplicada ao produto.");
      setSelecionado(null);
      atualizar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao aplicar imagem."),
  });

  const enviarArquivo = async (produtoId: string, file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    try {
      await fnEnviar({
        data: { produtoId, nomeArquivo: file.name, tipo: file.type || "image/jpeg", conteudoBase64: base64 },
      });
      toast.success("Imagem enviada.");
      setSelecionado(null);
      atualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    }
  };

  const rodarLote = async (escopo: "sem_imagem" | "revisao" | "todos") => {
    setRodandoLote(true);
    setLote(null);

    try {
      const r = await fnLote({ data: { escopo, tamanho: 10, forcar: false } });
      setLote(r);
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

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Imagens dos produtos</h1>
          <p className="text-sm text-muted-foreground">Busca automática, revisão manual e envio de fotos.</p>
        </div>

        <Button variant="outline" asChild>
          <Link to="/admin">Voltar ao painel</Link>
        </Button>
      </div>

      {/* Estatísticas */}
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

      {/* Lote */}
      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-primary">Sincronização automática</h2>
        <p className="text-sm text-muted-foreground">
          Processa 10 produtos por vez. Repita quantas vezes precisar.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={rodandoLote} onClick={() => rodarLote("sem_imagem")}>
            {rodandoLote ? "Processando…" : "Buscar para produtos sem imagem"}
          </Button>

          <Button variant="outline" disabled={rodandoLote} onClick={() => rodarLote("revisao")}>
            Reprocessar pendentes de revisão
          </Button>
        </div>

        {lote ? (
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            <p>
              Processados: {lote.processados} · Aprovados: {lote.aprovados} · Revisão: {lote.revisao} · Não
              encontradas: {lote.naoEncontrados} · Erros: {lote.erros}
            </p>

            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {lote.detalhes?.map((d: any, i: number) => (
                <li key={i}>
                  {d.nome} — {d.status}
                  {d.fonte ? ` (${d.fonte}${d.confianca ? `, ${d.confianca}%` : ""})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Filtros */}
      <section className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label className="text-xs">Situação</Label>
          <Select
            value={filtro}
            onValueChange={(v) => {
              setFiltro(v as Filtro);
              setPagina(1);
            }}
          >
            <SelectTrigger>
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

        <div className="min-w-[220px] flex-1">
          <Label className="text-xs">Buscar</Label>
          <Input
            value={busca}
            placeholder="Nome, código ou código de barras"
            onChange={(ev) => setBusca(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                setTermoBusca(busca);
                setPagina(1);
              }
            }}
          />
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setTermoBusca(busca);
            setPagina(1);
          }}
        >
          Filtrar
        </Button>
      </section>

      {/* Lista */}
      <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {lista.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

        {itens.map((p: any) => (
          <div key={p.id} className="flex flex-col rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
              {p.imagem || p.image_candidato_url ? (
                <img
                  src={p.imagem ?? p.image_candidato_url}
                  alt={p.nome}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-xs text-muted-foreground">sem foto</span>
              )}
            </div>

            <p className="mt-2 line-clamp-2 text-xs font-medium">{p.nome}</p>
            <p className="text-[11px] text-muted-foreground">{p.codigo_barras || p.codigo}</p>

            <div className="mt-2 flex flex-col gap-1">
              <Button size="sm" variant="outline" onClick={() => abrirProduto(p)}>
                Buscar imagem
              </Button>

              {p.image_status === "manual_review" && p.image_candidato_url ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await fnAprovar({ data: { produtoId: p.id } });
                        toast.success("Aprovada.");
                        atualizar();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha.");
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
                        await fnRejeitar({ data: { produtoId: p.id, removerAtual: false } });
                        toast.success("Rejeitada.");
                        atualizar();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha.");
                      }
                    }}
                  >
                    Rejeitar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
          Anterior
        </Button>

        <span className="text-sm text-muted-foreground">
          Página {pagina} de {paginas} · {total} produtos
        </span>

        <Button variant="outline" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>
          Próxima
        </Button>
      </div>

      {/* Diálogo de candidatos */}
      <Dialog open={!!selecionado} onOpenChange={(o) => (o ? null : setSelecionado(null))}>
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
                const file = ev.target.files?.[0];
                if (file && selecionado) void enviarArquivo(selecionado.id, file);
              }}
            />
          </div>

          {carregandoCandidatos ? (
            <p className="mt-4 text-sm text-muted-foreground">Procurando imagens…</p>
          ) : candidatos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma imagem encontrada nas fontes disponíveis.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {candidatos.map((c, i) => (
                <div key={i} className="rounded-xl border p-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                    <img src={c.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </div>

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.source} · {Math.round(c.confianca)}%{c.conflito ? " · conflito" : ""}
                  </p>

                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={aplicarMutation.isPending}
                    onClick={() => aplicarMutation.mutate(c)}
                  >
                    Usar esta
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
