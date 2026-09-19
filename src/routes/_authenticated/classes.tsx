import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDeferredValue, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit3, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  classificarResultados,
  classificarSelecionados,
  excluirClasse,
  listarClasses,
  listarEstruturaClasses,
  salvarCategoriaClasse,
  salvarClassificacao,
  salvarSubcategoriaClasse,
} from "@/lib/classes.functions";
import { formatarPreco } from "@/lib/catalog";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Classes de produtos | Farmácias Francy" },
      { name: "description", content: "Gerenciamento administrativo das categorias e subcategorias do catálogo." },
      { property: "og:title", content: "Classes de produtos | Farmácias Francy" },
      { property: "og:description", content: "Gerenciamento administrativo das categorias e subcategorias do catálogo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClassesPage,
});

type Status = "todos" | "sem_categoria" | "sem_subcategoria" | "completa";
type Categoria = { id: string; nome: string; slug: string; quantidade: number };
type Subcategoria = { id: string; categoria_id: string; nome: string; slug: string; quantidade: number };
type ProdutoClasse = {
  id: string;
  codigo: string;
  codigo_original?: string | null;
  nome: string;
  descricao: string;
  fabricante: string;
  preco: number;
  disponivel: boolean;
  imagem?: string | null;
  categoria_id?: string | null;
  subcategoria_id?: string | null;
};

const POR_PAGINA = 20;

function ClassesPage() {
  const qc = useQueryClient();
  const fnListar = useServerFn(listarClasses);
  const fnEstrutura = useServerFn(listarEstruturaClasses);
  const fnSalvar = useServerFn(salvarClassificacao);
  const fnSelecionados = useServerFn(classificarSelecionados);
  const fnResultados = useServerFn(classificarResultados);
  const fnCategoria = useServerFn(salvarCategoriaClasse);
  const fnSubcategoria = useServerFn(salvarSubcategoriaClasse);
  const fnExcluir = useServerFn(excluirClasse);

  const [busca, setBusca] = useState("");
  const buscaFinal = useDeferredValue(busca.trim());
  const [categoriaId, setCategoriaId] = useState("todas");
  const [subcategoriaId, setSubcategoriaId] = useState("todas");
  const [status, setStatus] = useState<Status>("todos");
  const [pagina, setPagina] = useState(1);
  const [paginaInput, setPaginaInput] = useState("1");
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [todosResultados, setTodosResultados] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoClasse | null>(null);
  const [editCategoria, setEditCategoria] = useState("sem");
  const [editSubcategoria, setEditSubcategoria] = useState("sem");
  const [massaCategoria, setMassaCategoria] = useState("sem");
  const [massaSubcategoria, setMassaSubcategoria] = useState("sem");
  const [nomeCategoria, setNomeCategoria] = useState("");
  const [nomeSubcategoria, setNomeSubcategoria] = useState("");
  const [categoriaDaSub, setCategoriaDaSub] = useState("");
  const [editandoClasse, setEditandoClasse] = useState<{ tipo: "categoria" | "subcategoria"; id: string; nome: string; categoriaId?: string } | null>(null);

  const filtros = {
    pagina,
    porPagina: POR_PAGINA,
    busca: buscaFinal,
    categoriaId: categoriaId === "todas" ? null : categoriaId,
    subcategoriaId: subcategoriaId === "todas" ? null : subcategoriaId,
    status,
  };

  const estrutura = useQuery({ queryKey: ["classes", "estrutura"], queryFn: () => fnEstrutura({}) });
  const produtos = useQuery({
    queryKey: ["classes", "produtos", filtros],
    queryFn: () => fnListar({ data: filtros }),
    staleTime: 10_000,
  });

  const categorias = (estrutura.data?.categorias ?? []) as Categoria[];
  const subcategorias = (estrutura.data?.subcategorias ?? []) as Subcategoria[];
  const itens = (produtos.data?.itens ?? []) as ProdutoClasse[];
  const total = produtos.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const idsSelecionados = Object.keys(selecionados);
  const subsFiltro = subcategorias.filter((item) => categoriaId === "todas" || item.categoria_id === categoriaId);
  const subsEditar = subcategorias.filter((item) => item.categoria_id === editCategoria);
  const subsMassa = subcategorias.filter((item) => item.categoria_id === massaCategoria);

  const nomesCategorias = useMemo(() => new Map(categorias.map((item) => [item.id, item.nome])), [categorias]);
  const nomesSubcategorias = useMemo(() => new Map(subcategorias.map((item) => [item.id, item.nome])), [subcategorias]);

  const atualizar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["classes"] }),
      qc.invalidateQueries({ queryKey: ["catalogo"] }),
      qc.invalidateQueries({ queryKey: ["produtos"] }),
      qc.invalidateQueries({ queryKey: ["busca"] }),
    ]);
  };

  const salvarMutation = useMutation({
    mutationFn: () => {
      if (!produtoEditando) throw new Error("Produto não selecionado.");
      return fnSalvar({
        data: {
          produtoId: produtoEditando.id,
          categoriaId: editCategoria === "sem" ? null : editCategoria,
          subcategoriaId: editSubcategoria === "sem" ? null : editSubcategoria,
        },
      });
    },
    onSuccess: async () => {
      setProdutoEditando(null);
      toast.success("Classificação atualizada.");
      await atualizar();
    },
    onError: (erro) => toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar."),
  });

  const irParaPagina = (valor: string | number) => {
    const destino = Math.min(totalPaginas, Math.max(1, Number.parseInt(String(valor), 10) || 1));
    setPagina(destino);
    setPaginaInput(String(destino));
  };

  const mudarFiltros = () => {
    setPagina(1);
    setPaginaInput("1");
    setTodosResultados(false);
  };

  const abrirEdicao = (produto: ProdutoClasse) => {
    setProdutoEditando(produto);
    setEditCategoria(produto.categoria_id ?? "sem");
    setEditSubcategoria(produto.subcategoria_id ?? "sem");
  };

  const alternarPagina = (marcar: boolean) => {
    setTodosResultados(false);
    setSelecionados((atual) => {
      const proximo = { ...atual };
      for (const item of itens) {
        if (marcar) proximo[item.id] = item.nome;
        else delete proximo[item.id];
      }
      return proximo;
    });
  };

  const executarMassa = async () => {
    const quantidade = todosResultados ? total : idsSelecionados.length;
    if (!quantidade) return;
    if (!window.confirm(`Confirmar a classificação de ${quantidade} produto(s)?`)) return;
    try {
      const classificacao = {
        categoriaId: massaCategoria === "sem" ? null : massaCategoria,
        subcategoriaId: massaSubcategoria === "sem" ? null : massaSubcategoria,
      };
      const resposta = todosResultados
        ? await fnResultados({
            data: {
              filtros: {
                busca: buscaFinal,
                categoriaId: categoriaId === "todas" ? null : categoriaId,
                subcategoriaId: subcategoriaId === "todas" ? null : subcategoriaId,
                status,
              },
              classificacao,
            },
          })
        : await fnSelecionados({ data: { produtoIds: idsSelecionados, ...classificacao } });
      toast.success(`${resposta.atualizados} produto(s) atualizado(s).`);
      setSelecionados({});
      setTodosResultados(false);
      await atualizar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível classificar os produtos.");
    }
  };

  const salvarClasse = async (tipo: "categoria" | "subcategoria") => {
    try {
      if (tipo === "categoria") {
        const nome = editandoClasse?.tipo === "categoria" ? editandoClasse.nome : nomeCategoria;
        await fnCategoria({ data: { id: editandoClasse?.tipo === "categoria" ? editandoClasse.id : undefined, nome } });
        setNomeCategoria("");
      } else {
        const nome = editandoClasse?.tipo === "subcategoria" ? editandoClasse.nome : nomeSubcategoria;
        const categoria = editandoClasse?.tipo === "subcategoria" ? editandoClasse.categoriaId : categoriaDaSub;
        if (!categoria) throw new Error("Escolha a categoria da subcategoria.");
        await fnSubcategoria({
          data: { id: editandoClasse?.tipo === "subcategoria" ? editandoClasse.id : undefined, categoriaId: categoria, nome },
        });
        setNomeSubcategoria("");
      }
      setEditandoClasse(null);
      toast.success("Classe salva.");
      await atualizar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a classe.");
    }
  };

  const apagarClasse = async (tipo: "categoria" | "subcategoria", id: string, nome: string) => {
    if (!window.confirm(`Excluir ${nome}? Esta ação só será concluída se não houver vínculos.`)) return;
    try {
      await fnExcluir({ data: { tipo, id } });
      toast.success("Classe excluída.");
      await atualizar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível excluir.");
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Classes de produtos</h1>
          <p className="text-sm text-muted-foreground">Defina a categoria oficial de cada item do catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/imagens">Imagens</Link></Button>
          <Button variant="outline" asChild><Link to="/admin">Voltar ao painel</Link></Button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total filtrado", total],
          ["Sem categoria", estrutura.data?.contadores.semCategoria],
          ["Sem subcategoria", estrutura.data?.contadores.semSubcategoria],
          ["Classificação completa", estrutura.data?.contadores.completa],
        ].map(([rotulo, valor]) => (
          <div key={String(rotulo)} className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{rotulo}</p>
            <p className="mt-1 text-xl font-bold text-primary">{valor ?? "—"}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_220px_220px]">
          <div><Label htmlFor="busca-classes">Pesquisa rápida</Label><Input id="busca-classes" className="mt-2" value={busca} onChange={(e) => { setBusca(e.target.value); mudarFiltros(); }} placeholder="Código, descrição, marca ou classe" /></div>
          <div><Label>Categoria</Label><Select value={categoriaId} onValueChange={(valor) => { setCategoriaId(valor); setSubcategoriaId("todas"); mudarFiltros(); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem>{categorias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Subcategoria</Label><Select value={subcategoriaId} onValueChange={(valor) => { setSubcategoriaId(valor); mudarFiltros(); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem>{subsFiltro.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Situação</Label><Select value={status} onValueChange={(valor) => { setStatus(valor as Status); mudarFiltros(); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="sem_categoria">Sem categoria</SelectItem><SelectItem value="sem_subcategoria">Sem subcategoria</SelectItem><SelectItem value="completa">Classificação completa</SelectItem></SelectContent></Select></div>
        </div>
      </section>

      <section className="mt-6 border-y bg-card py-5 sm:rounded-lg sm:border sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold text-primary">Classificar selecionados</h2><p className="text-sm text-muted-foreground">{todosResultados ? `${total} resultados selecionados` : `${idsSelecionados.length} produto(s) selecionado(s)`}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => alternarPagina(true)} disabled={!itens.length}>Selecionar página</Button><Button size="sm" variant="outline" onClick={() => { setTodosResultados(true); setSelecionados({}); }} disabled={!total}>Selecionar todos os resultados</Button><Button size="sm" variant="ghost" onClick={() => { setSelecionados({}); setTodosResultados(false); }}>Limpar</Button></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Select value={massaCategoria} onValueChange={(valor) => { setMassaCategoria(valor); setMassaSubcategoria("sem"); }}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="sem">Sem categoria</SelectItem>{categorias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select>
          <Select value={massaSubcategoria} disabled={massaCategoria === "sem"} onValueChange={setMassaSubcategoria}><SelectTrigger><SelectValue placeholder="Subcategoria" /></SelectTrigger><SelectContent><SelectItem value="sem">Sem subcategoria</SelectItem>{subsMassa.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select>
          <Button onClick={executarMassa} disabled={!todosResultados && idsSelecionados.length === 0}><Check className="size-4" /> Aplicar classificação</Button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden border-y bg-card sm:rounded-lg sm:border">
        {produtos.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Carregando produtos…</p> : produtos.isError ? <p role="alert" className="p-8 text-center text-sm text-destructive">Não foi possível carregar os produtos.</p> : (
          <Table className="min-w-[1180px]">
            <TableHeader><TableRow><TableHead className="w-10"><Checkbox aria-label="Selecionar página" checked={itens.length > 0 && itens.every((item) => Boolean(selecionados[item.id]))} onCheckedChange={(valor) => alternarPagina(Boolean(valor))} /></TableHead><TableHead>Imagem</TableHead><TableHead>Códigos</TableHead><TableHead className="min-w-72">Descrição</TableHead><TableHead>Marca</TableHead><TableHead>Categoria</TableHead><TableHead>Subcategoria</TableHead><TableHead>Preço</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader>
            <TableBody>{itens.map((item) => <TableRow key={item.id} data-state={selecionados[item.id] ? "selected" : undefined}>
              <TableCell><Checkbox aria-label={`Selecionar ${item.nome}`} checked={Boolean(selecionados[item.id])} onCheckedChange={(valor) => { setTodosResultados(false); setSelecionados((atual) => { const proximo = { ...atual }; if (valor) proximo[item.id] = item.nome; else delete proximo[item.id]; return proximo; }); }} /></TableCell>
              <TableCell>{item.imagem ? <img src={item.imagem} alt="" draggable={false} className="size-12 rounded-md border object-contain" /> : <div className="flex size-12 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">Sem foto</div>}</TableCell>
              <TableCell><p className="font-medium">{item.codigo}</p><p className="text-xs text-muted-foreground">{item.codigo_original || "Original: —"}</p></TableCell>
              <TableCell><p className="font-medium">{item.nome}</p>{item.descricao && item.descricao !== item.nome && <p className="line-clamp-2 text-xs text-muted-foreground">{item.descricao}</p>}</TableCell>
              <TableCell>{item.fabricante || "—"}</TableCell><TableCell>{item.categoria_id ? nomesCategorias.get(item.categoria_id) : <Badge variant="destructive">Sem categoria</Badge>}</TableCell><TableCell>{item.subcategoria_id ? nomesSubcategorias.get(item.subcategoria_id) : <Badge variant="outline">Sem subcategoria</Badge>}</TableCell><TableCell>{formatarPreco(Number(item.preco))}</TableCell><TableCell><Badge variant={item.disponivel ? "default" : "secondary"}>{item.disponivel ? "Disponível" : "Indisponível"}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => abrirEdicao(item)}><Edit3 className="size-4" /> Editar</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        )}
      </section>

      <nav aria-label="Paginação" className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button size="icon" variant="outline" aria-label="Primeira página" onClick={() => irParaPagina(1)} disabled={pagina === 1}><ChevronsLeft className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Página anterior" onClick={() => irParaPagina(pagina - 1)} disabled={pagina === 1}><ChevronLeft className="size-4" /></Button>
        {Array.from({ length: Math.min(5, totalPaginas) }, (_, indice) => Math.max(1, Math.min(totalPaginas - 4, pagina - 2)) + indice).map((numero) => <Button key={numero} size="sm" variant={numero === pagina ? "default" : "outline"} onClick={() => irParaPagina(numero)}>{numero}</Button>)}
        <Button size="icon" variant="outline" aria-label="Próxima página" onClick={() => irParaPagina(pagina + 1)} disabled={pagina === totalPaginas}><ChevronRight className="size-4" /></Button>
        <Button size="icon" variant="outline" aria-label="Última página" onClick={() => irParaPagina(totalPaginas)} disabled={pagina === totalPaginas}><ChevronsRight className="size-4" /></Button>
        <span className="ml-2 text-sm text-muted-foreground">Página {pagina} de {totalPaginas}</span><Input className="w-20 text-center" inputMode="numeric" aria-label="Ir para página" value={paginaInput} onChange={(e) => setPaginaInput(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") irParaPagina(paginaInput); }} /><Button size="sm" onClick={() => irParaPagina(paginaInput)}>Ir</Button>
      </nav>

      <section className="mt-10 border-t pt-8">
        <h2 className="text-xl font-bold text-primary">Gerenciar categorias e subcategorias</h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">Categorias</h3><div className="mt-3 flex gap-2"><Input value={nomeCategoria} onChange={(e) => setNomeCategoria(e.target.value)} placeholder="Nova categoria" /><Button size="icon" aria-label="Adicionar categoria" onClick={() => salvarClasse("categoria")}><Plus className="size-4" /></Button></div><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{categorias.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-md border p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.nome}</p><p className="text-xs text-muted-foreground">{item.quantidade} produto(s)</p></div><Button size="icon" variant="ghost" aria-label={`Renomear ${item.nome}`} onClick={() => setEditandoClasse({ tipo: "categoria", id: item.id, nome: item.nome })}><Edit3 className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Excluir ${item.nome}`} onClick={() => apagarClasse("categoria", item.id, item.nome)}><Trash2 className="size-4" /></Button></div>)}</div></div>
          <div className="rounded-lg border bg-card p-4"><h3 className="font-semibold">Subcategorias</h3><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select value={categoriaDaSub} onValueChange={setCategoriaDaSub}><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent>{categorias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select><Input value={nomeSubcategoria} onChange={(e) => setNomeSubcategoria(e.target.value)} placeholder="Nova subcategoria" /><Button size="icon" aria-label="Adicionar subcategoria" onClick={() => salvarClasse("subcategoria")}><Plus className="size-4" /></Button></div><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto">{subcategorias.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-md border p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{item.nome}</p><p className="text-xs text-muted-foreground">{nomesCategorias.get(item.categoria_id)} · {item.quantidade} produto(s)</p></div><Button size="icon" variant="ghost" aria-label={`Renomear ${item.nome}`} onClick={() => setEditandoClasse({ tipo: "subcategoria", id: item.id, nome: item.nome, categoriaId: item.categoria_id })}><Edit3 className="size-4" /></Button><Button size="icon" variant="ghost" aria-label={`Excluir ${item.nome}`} onClick={() => apagarClasse("subcategoria", item.id, item.nome)}><Trash2 className="size-4" /></Button></div>)}</div></div>
        </div>
      </section>

      <Dialog open={Boolean(produtoEditando)} onOpenChange={(aberto) => { if (!aberto) setProdutoEditando(null); }}><DialogContent><DialogHeader><DialogTitle>Editar classificação</DialogTitle></DialogHeader><p className="text-sm font-medium">{produtoEditando?.nome}</p><div className="grid gap-4"><div><Label>Categoria</Label><Select value={editCategoria} onValueChange={(valor) => { setEditCategoria(valor); setEditSubcategoria("sem"); }}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem">Sem categoria</SelectItem>{categorias.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div><div><Label>Subcategoria</Label><Select value={editSubcategoria} disabled={editCategoria === "sem"} onValueChange={setEditSubcategoria}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sem">Sem subcategoria</SelectItem>{subsEditar.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent></Select></div><p className="text-xs text-muted-foreground">Precisa de uma nova opção? Cadastre-a na área de gerenciamento abaixo sem perder esta edição.</p></div><DialogFooter><Button variant="outline" onClick={() => setProdutoEditando(null)}>Cancelar</Button><Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}>{salvarMutation.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(editandoClasse)} onOpenChange={(aberto) => { if (!aberto) setEditandoClasse(null); }}><DialogContent><DialogHeader><DialogTitle>Renomear {editandoClasse?.tipo === "categoria" ? "categoria" : "subcategoria"}</DialogTitle></DialogHeader><div><Label>Novo nome</Label><Input className="mt-2" value={editandoClasse?.nome ?? ""} onChange={(e) => setEditandoClasse((atual) => atual ? { ...atual, nome: e.target.value } : null)} /></div><DialogFooter><Button variant="outline" onClick={() => setEditandoClasse(null)}>Cancelar</Button><Button onClick={() => editandoClasse && salvarClasse(editandoClasse.tipo)}>Salvar nome</Button></DialogFooter></DialogContent></Dialog>
    </main>
  );
}