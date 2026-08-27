export type Subcategory = { nome: string; slug: string };
export type Categoria = { nome: string; slug: string; icone: string; subcategorias: Subcategory[] };

export type Produto = {
  id: string;
  /** Código interno usado no pedido enviado ao WhatsApp */
  codigo: string;
  nome: string;
  categoria: string; // slug da categoria
  subcategoria: string; // slug da subcategoria
  descricao: string;
  preco: number;
  precoPromocional?: number | undefined;
  imagem?: string | undefined;
  disponivel: boolean;
  oferta: boolean;
  rasgaPreco?: boolean | undefined;
  informacoes?: string[] | undefined;
};

export type Catalogo = {
  categorias: Categoria[];
  produtos: Produto[];
  /** Vitrines da home: itens marcados no painel ou preenchidos automaticamente */
  vitrines?: { rasgaPreco: Produto[]; ofertas: Produto[] } | undefined;
};


export const slugify = (n: string) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const precoFinal = (p: Produto) => p.precoPromocional ?? p.preco;

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const acharCategoria = (categorias: Categoria[], slug: string) =>
  categorias.find((c) => c.slug === slug);

export const acharProduto = (produtos: Produto[], id: string) => produtos.find((p) => p.id === id);

export function filtrarBusca(catalogo: Catalogo, termo: string): Produto[] {
  const q = slugify(termo.trim());
  if (!q) return [];
  return catalogo.produtos.filter((p) => {
    const c = acharCategoria(catalogo.categorias, p.categoria);
    const sub = c?.subcategorias.find((x) => x.slug === p.subcategoria);
    const alvo = slugify(`${p.nome} ${p.codigo} ${c?.nome ?? ""} ${sub?.nome ?? ""}`);
    return q.split("-").every((parte) => alvo.includes(parte));
  });
}

export const WHATSAPP_URL = "https://wa.me/558321781349";
export const INSTAGRAM_URL = "https://www.instagram.com/farmaciasfrancy/";
