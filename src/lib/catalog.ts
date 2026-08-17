import loratamedAsset from "@/assets/loratamed.png.asset.json";
import dorflexAsset from "@/assets/dorflex_cartela.png.asset.json";
import absAsset from "@/assets/abs_aways.png.asset.json";

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
  precoPromocional?: number;
  imagem?: string;
  disponivel: boolean;
  oferta: boolean;
  rasgaPreco?: boolean;
  informacoes?: string[];
};

const s = (n: string) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const cat = (nome: string, icone: string, subs: string[]): Categoria => ({
  nome,
  slug: s(nome),
  icone,
  subcategorias: subs.map((sub) => ({ nome: sub, slug: s(sub) })),
});

export const categorias: Categoria[] = [
  cat("Medicamentos", "💊", [
    "Analgésicos",
    "Antialérgicos",
    "Antigripais",
    "Digestivos",
    "Vitaminas",
    "Uso contínuo",
    "Outros",
  ]),
  cat("Perfumaria e Cosméticos", "🧴", [
    "Perfumes",
    "Cremes",
    "Protetor solar",
    "Maquiagem",
    "Cuidados com o cabelo",
    "Cuidados com a pele",
  ]),
  cat("Higiene Pessoal", "🧼", [
    "Sabonetes",
    "Desodorantes",
    "Shampoos",
    "Higiene íntima",
    "Higiene oral",
  ]),
  cat("Cuidados com Bebês e Crianças", "🍼", [
    "Fraldas",
    "Lenços umedecidos",
    "Higiene infantil",
    "Cuidados com a pele",
    "Alimentação infantil",
  ]),
  cat("Saúde e Primeiros Socorros", "🩹", [
    "Curativos",
    "Álcool",
    "Termômetros",
    "Ataduras",
    "Antissépticos",
  ]),
  cat("Vitaminas e Suplementos", "🍊", [
    "Multivitamínicos",
    "Vitamina C",
    "Vitamina D",
    "Minerais",
    "Suplementos",
  ]),
  cat("Higiene e Cuidados Íntimos", "🌸", [
    "Absorventes",
    "Protetores diários",
    "Sabonetes íntimos",
    "Incontinência",
  ]),
  cat("Ortopedia e Cuidados Especiais", "🦵", [
    "Joelheiras",
    "Cintas",
    "Meias de compressão",
    "Bengalas",
    "Suportes",
  ]),
  cat("Beleza e Cuidados Pessoais", "💄", [
    "Cremes",
    "Produtos capilares",
    "Cuidados faciais",
    "Cuidados corporais",
  ]),
  cat("Produtos para Idosos e Incontinência", "🧓", [
    "Fraldas adultas",
    "Absorventes",
    "Produtos de cuidado pessoal",
  ]),
  cat("Saúde Bucal", "🦷", ["Cremes dentais", "Escovas", "Enxaguantes", "Fio dental"]),
  cat("Conveniência e Alimentos", "🍫", ["Balas", "Chocolates", "Snacks", "Bebidas", "Outros produtos"]),
  cat("Produtos para Animais (Pet)", "🐾", ["Higiene", "Cuidados", "Acessórios", "Produtos para pets"]),
  cat("Utilidades e Acessórios", "🔌", ["Pilhas", "Acessórios", "Pequenos itens de utilidade"]),
];

export const getCategoria = (slug: string) => categorias.find((c) => c.slug === slug);

/**
 * Catálogo demonstrativo. Os itens abaixo são fictícios e servem apenas para
 * estruturar a loja — substitua por produtos reais mantendo os mesmos campos.
 */
export const produtos: Produto[] = [
  {
    id: "p001",
    codigo: "FF-1001",
    nome: "Loratamed Loratadina 10mg 12 comprimidos",
    categoria: "medicamentos",
    subcategoria: "antialergicos",
    descricao:
      "Antialérgico com loratadina 10 mg, indicado para o alívio dos sintomas de alergia como coceira, espirros e coriza. Uso oral adulto e pediátrico acima de 12 anos.",
    preco: 5.99,
    precoPromocional: 3.99,
    imagem: loratamedAsset.url,
    disponivel: true,
    oferta: true,
    rasgaPreco: true,
    informacoes: ["12 comprimidos", "24h de ação", "Uso oral"],
  },
  {
    id: "p002",
    codigo: "FF-1002",
    nome: "Dorflex 10 comprimidos",
    categoria: "medicamentos",
    subcategoria: "analgesicos",
    descricao:
      "Analgésico e relaxante muscular em cartela com 10 comprimidos, indicado para o alívio de dores associadas a contraturas musculares.",
    preco: 10.9,
    precoPromocional: 8.72,
    imagem: dorflexAsset.url,
    disponivel: true,
    oferta: true,
    rasgaPreco: true,
    informacoes: ["Cartela com 10 comprimidos", "Analgésico e relaxante muscular"],
  },
  {
    id: "p003",
    codigo: "FF-1003",
    nome: "Absorvente Sempre Livre Adapt Suave com Abas Leve 16 Pague 14",
    categoria: "higiene-e-cuidados-intimos",
    subcategoria: "absorventes",
    descricao:
      "Absorvente com cobertura suave e abas, rápida absorção e até 6h de proteção. Embalagem leve 16 pague 14 unidades.",
    preco: 18.9,
    precoPromocional: 15.99,
    imagem: absAsset.url,
    disponivel: true,
    oferta: true,
    rasgaPreco: true,
    informacoes: ["16 unidades", "Cobertura suave com abas", "Até 6h de proteção"],
  },
  // Itens fictícios complementares (sem foto cadastrada)
  ...(
    [
      ["Dipirona Sódica 500mg 10 comprimidos", "medicamentos", "analgesicos", 6.5, 4.99, true],
      ["Paracetamol 750mg 20 comprimidos", "medicamentos", "analgesicos", 12.9, undefined, false],
      ["Antigripal Dia e Noite 12 comprimidos", "medicamentos", "antigripais", 21.9, 17.49, true],
      ["Antiácido Efervescente 6 envelopes", "medicamentos", "digestivos", 9.9, undefined, false],
      ["Losartana Potássica 50mg 30 comprimidos", "medicamentos", "uso-continuo", 14.9, 11.9, true],
      ["Soro Fisiológico 100ml", "medicamentos", "outros", 5.5, undefined, false],
      ["Perfume Floral Deo Colônia 100ml", "perfumaria-e-cosmeticos", "perfumes", 89.9, 69.9, true],
      ["Creme Hidratante Corporal 400ml", "perfumaria-e-cosmeticos", "cremes", 32.9, undefined, false],
      ["Protetor Solar FPS 50 120ml", "perfumaria-e-cosmeticos", "protetor-solar", 59.9, 47.9, true],
      ["Base Líquida Cobertura Natural", "perfumaria-e-cosmeticos", "maquiagem", 39.9, undefined, false],
      ["Sabonete Hidratante em Barra 90g", "higiene-pessoal", "sabonetes", 3.49, 2.79, true],
      ["Desodorante Aerosol 150ml", "higiene-pessoal", "desodorantes", 18.9, undefined, false],
      ["Shampoo Anticaspa 400ml", "higiene-pessoal", "shampoos", 26.9, 21.9, true],
      ["Fralda Infantil Confort M 40 unidades", "cuidados-com-bebes-e-criancas", "fraldas", 49.9, 42.9, true],
      ["Lenços Umedecidos 75 unidades", "cuidados-com-bebes-e-criancas", "lencos-umedecidos", 12.9, undefined, false],
      ["Pomada para Assaduras 45g", "cuidados-com-bebes-e-criancas", "cuidados-com-a-pele", 22.9, undefined, false],
      ["Curativo Adesivo 20 unidades", "saude-e-primeiros-socorros", "curativos", 8.9, 6.99, true],
      ["Álcool 70% Líquido 1L", "saude-e-primeiros-socorros", "alcool", 11.9, undefined, false],
      ["Termômetro Digital", "saude-e-primeiros-socorros", "termometros", 29.9, 24.9, true],
      ["Atadura de Crepe 10cm", "saude-e-primeiros-socorros", "ataduras", 4.9, undefined, false],
      ["Multivitamínico A-Z 60 cápsulas", "vitaminas-e-suplementos", "multivitaminicos", 45.9, 36.9, true],
      ["Vitamina C 1g 10 comprimidos efervescentes", "vitaminas-e-suplementos", "vitamina-c", 19.9, undefined, false],
      ["Vitamina D 2000UI 30 cápsulas", "vitaminas-e-suplementos", "vitamina-d", 34.9, undefined, false],
      ["Protetor Diário Sem Perfume 40 unidades", "higiene-e-cuidados-intimos", "protetores-diarios", 14.9, 11.99, true],
      ["Sabonete Íntimo 200ml", "higiene-e-cuidados-intimos", "sabonetes-intimos", 24.9, undefined, false],
      ["Joelheira Elástica Tamanho M", "ortopedia-e-cuidados-especiais", "joelheiras", 39.9, undefined, false],
      ["Meia de Compressão 20-30mmHg", "ortopedia-e-cuidados-especiais", "meias-de-compressao", 89.9, 74.9, true],
      ["Creme Facial Antissinais 50g", "beleza-e-cuidados-pessoais", "cuidados-faciais", 64.9, 52.9, true],
      ["Condicionador Reparação 350ml", "beleza-e-cuidados-pessoais", "produtos-capilares", 27.9, undefined, false],
      ["Fralda Geriátrica G 8 unidades", "produtos-para-idosos-e-incontinencia", "fraldas-adultas", 32.9, 27.9, true],
      ["Absorvente para Incontinência 16 unidades", "produtos-para-idosos-e-incontinencia", "absorventes", 21.9, undefined, false],
      ["Creme Dental Proteção Total 90g", "saude-bucal", "cremes-dentais", 9.9, 7.49, true],
      ["Escova Dental Macia", "saude-bucal", "escovas", 12.9, undefined, false],
      ["Enxaguante Bucal Sem Álcool 500ml", "saude-bucal", "enxaguantes", 22.9, 18.9, true],
      ["Fio Dental 50m", "saude-bucal", "fio-dental", 8.9, undefined, false],
      ["Chocolate ao Leite 90g", "conveniencia-e-alimentos", "chocolates", 8.49, undefined, false],
      ["Bala de Menta Sem Açúcar", "conveniencia-e-alimentos", "balas", 4.99, undefined, false],
      ["Água Mineral 500ml", "conveniencia-e-alimentos", "bebidas", 3.5, undefined, false],
      ["Shampoo Pet Filhotes 500ml", "produtos-para-animais-pet", "higiene", 29.9, 24.9, true],
      ["Coleira Antipulgas", "produtos-para-animais-pet", "acessorios", 44.9, undefined, false],
      ["Pilha Alcalina AA 4 unidades", "utilidades-e-acessorios", "pilhas", 19.9, 15.9, true],
      ["Copo Dosador Graduado", "utilidades-e-acessorios", "pequenos-itens-de-utilidade", 5.9, undefined, false],
    ] as const
  ).map(([nome, categoria, subcategoria, preco, promo, oferta], i) => ({
    id: `p${String(i + 4).padStart(3, "0")}`,
    codigo: `FF-${1004 + i}`,
    nome,
    categoria,
    subcategoria,
    descricao: `${nome}. Produto demonstrativo do catálogo da Farmácias Francy. Confirme disponibilidade e apresentação pelo WhatsApp.`,
    preco,
    precoPromocional: promo,
    disponivel: true,
    oferta,
    rasgaPreco: oferta && i % 2 === 0,
  })),
];

export const precoFinal = (p: Produto) => p.precoPromocional ?? p.preco;

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const getProduto = (id: string) => produtos.find((p) => p.id === id);

export const produtosRasgaPreco = () => produtos.filter((p) => p.rasgaPreco);

export function buscarProdutos(termo: string): Produto[] {
  const q = s(termo.trim());
  if (!q) return [];
  return produtos.filter((p) => {
    const c = getCategoria(p.categoria);
    const sub = c?.subcategorias.find((x) => x.slug === p.subcategoria);
    const alvo = s(`${p.nome} ${p.codigo} ${c?.nome ?? ""} ${sub?.nome ?? ""}`);
    return q.split("-").every((parte) => alvo.includes(parte));
  });
}

export const WHATSAPP_URL = "https://wa.me/558321781349";
export const INSTAGRAM_URL = "https://www.instagram.com/farmaciasfrancy/";
