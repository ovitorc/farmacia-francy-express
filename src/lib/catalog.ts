export type Subcategory = {
  nome: string;
  slug: string;
};

export type Categoria = {
  nome: string;
  slug: string;
  icone: string;
  subcategorias: Subcategory[];
};

export type Produto = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  descricao: string;
  preco: number;
  precoPromocional?: number;
  imagem?: string;
  disponivel: boolean;
  oferta: boolean;
  rasgaPreco?: boolean;
  informacoes?: string[];
};

export type Catalogo = {
  categorias: Categoria[];
  produtos: Produto[];
  vitrines?: {
    rasgaPreco: Produto[];
    ofertas: Produto[];
  };
};

export const WHATSAPP_URL = "https://wa.me/558321781349";
export const INSTAGRAM_URL = "https://www.instagram.com/farmaciasfrancy/";

export const CATEGORIAS_REMOVIDAS = [
  "pet",
  "pets",
  "produto-para-animais",
  "produtos-para-animais",
  "produtos-para-pet",
  "animais",
  "produtos-para-animais-pet",
];

export const slugify = (valor: string) =>
  String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const normalizar = (valor: string) => slugify(valor).replace(/-/g, " ");

const textoDoProduto = (produto: Produto) =>
  normalizar(
    [produto.categoria, produto.subcategoria, produto.nome, produto.descricao, ...(produto.informacoes ?? [])]
      .filter(Boolean)
      .join(" "),
  );

const contem = (texto: string, ...termos: string[]) => termos.some((termo) => texto.includes(normalizar(termo)));

export const ESTRUTURA_CATEGORIAS_SITE: Categoria[] = [
  {
    nome: "Medicamentos",
    slug: "medicamentos",
    icone: "💊",
    subcategorias: [
      ["Medicamentos de Marca", "medicamentos-de-marca"],
      ["Genéricos", "genericos"],
      ["Similares", "similares"],
      ["Uso Contínuo", "uso-continuo"],
      ["Antibióticos", "antibioticos"],
      ["Anticoncepcionais", "anticoncepcionais"],
      ["Dermatológicos", "dermatologicos"],
      ["Oftálmicos", "oftalmicos"],
      ["Nasais", "nasais"],
      ["Otológicos", "otologicos"],
      ["Injetáveis", "injetaveis"],
      ["Comprimidos e Cápsulas", "comprimidos-capsulas"],
      ["Cremes e Pomadas", "cremes-pomadas"],
      ["Gotas", "gotas"],
      ["Spray e Aerossol", "spray"],
      ["Pastilhas", "pastilhas"],
      ["Supositórios", "supositorios"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "MIPs",
    slug: "mips",
    icone: "🩺",
    subcategorias: [
      ["Dor e Febre", "dor-e-febre"],
      ["Gripe e Resfriado", "gripe-e-resfriado"],
      ["Alergia", "alergia"],
      ["Digestão", "digestao"],
      ["Dermatológicos", "dermatologicos"],
      ["Oftálmicos", "oftalmicos"],
      ["Nasais", "nasais"],
      ["Cremes e Pomadas", "cremes-pomadas"],
      ["Gotas", "gotas"],
      ["Spray e Aerossol", "spray"],
      ["Pastilhas", "pastilhas"],
      ["Outros MIPs", "outros-mips"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "Perfumaria",
    slug: "perfumaria",
    icone: "🧴",
    subcategorias: [
      ["Perfumaria", "perfumaria"],
      ["Perfumaria Importada", "perfumaria-importada"],
      ["Higiene Pessoal", "higiene-pessoal"],
      ["Higiene Bucal", "higiene-bucal"],
      ["Dermocosméticos", "dermocosmeticos"],
      ["Salão e Beleza", "salao-e-beleza"],
      ["Cremes e Pomadas", "cremes-pomadas"],
      ["Solar", "solar"],
      ["Protetor Solar", "protetor-solar"],
      ["Preservativos", "preservativos"],
      ["Acessórios", "acessorios"],
      ["Eletrônicos", "eletronicos"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "Mamãe e Bebê",
    slug: "mamae-e-bebe",
    icone: "🍼",
    subcategorias: [
      ["Fraldas e Lenços", "fraldas-lencos"],
      ["Higiene Infantil", "higiene-infantil"],
      ["Chupetas, Mamadeiras e Copos", "chupetas-mamadeiras-copos"],
      ["Infantil", "infantil"],
      ["Leite", "leite"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "Conveniência",
    slug: "conveniencia",
    icone: "🍫",
    subcategorias: [
      ["Alimentos", "alimentos"],
      ["Boboniere", "boboniere"],
      ["Líquidos", "liquidos"],
      ["Leite", "leite"],
      ["Adoçantes", "adocantes"],
      ["Naturais", "naturais"],
      ["Chips", "chips"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "Vitaminas e Suplementos",
    slug: "vitaminas-e-suplementos",
    icone: "💪",
    subcategorias: [
      ["Polivitamínicos", "polivitaminicos"],
      ["Suplementos", "suplementos"],
      ["Nutrição Esportiva", "nutricao-esportiva"],
      ["Academia", "academia"],
      ["Naturais", "naturais"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
  {
    nome: "Saúde e Bem-estar",
    slug: "saude-e-bem-estar",
    icone: "🏥",
    subcategorias: [
      ["Médico-Hospitalar", "medico-hospitalar"],
      ["Ortopédicos", "ortopedicos"],
      ["Oficinais", "oficinais"],
      ["Naturais", "naturais"],
      ["Acessórios", "acessorios"],
    ].map(([nome, slug]) => ({ nome, slug })),
  },
];

function subcategoriaPorTexto(texto: string, categoria: string): string | null {
  if (categoria === "mamae-e-bebe") {
    if (contem(texto, "fralda", "lenco", "lenço")) return "fraldas-lencos";
    if (contem(texto, "chupeta", "mamadeira", "copo infantil")) return "chupetas-mamadeiras-copos";
    if (contem(texto, "higiene infantil", "shampoo infantil", "sabonete infantil")) return "higiene-infantil";
    if (contem(texto, "leite infantil", "formula infantil", "fórmula infantil")) return "leite";
    return "infantil";
  }

  if (categoria === "conveniencia") {
    if (contem(texto, "boboniere", "chocolate", "bala", "doce")) return "boboniere";
    if (contem(texto, "adocante", "adoçante")) return "adocantes";
    if (contem(texto, "chips", "salgadinho")) return "chips";
    if (contem(texto, "leite")) return "leite";
    if (contem(texto, "natural", "organico", "orgânico")) return "naturais";
    if (contem(texto, "bebida", "agua", "água", "suco", "liquido", "líquido")) return "liquidos";
    return "alimentos";
  }

  if (categoria === "vitaminas-e-suplementos") {
    if (contem(texto, "polivitamin", "multivitamin")) return "polivitaminicos";
    if (
      contem(
        texto,
        "nutricao esportiva",
        "nutrição esportiva",
        "whey",
        "creatina",
        "pre treino",
        "pré treino",
        "proteina",
        "proteína",
      )
    )
      return "nutricao-esportiva";
    if (contem(texto, "academia")) return "academia";
    if (contem(texto, "natural")) return "naturais";
    return "suplementos";
  }

  if (categoria === "saude-e-bem-estar") {
    if (contem(texto, "ortopedic", "joelheira", "cinta", "compressao", "compressão", "bengala", "suporte"))
      return "ortopedicos";
    if (contem(texto, "oficinal", "manipulado")) return "oficinais";
    if (contem(texto, "natural")) return "naturais";
    if (contem(texto, "acessor", "utilidade")) return "acessorios";
    return "medico-hospitalar";
  }

  if (categoria === "perfumaria") {
    if (contem(texto, "importad")) return "perfumaria-importada";
    if (contem(texto, "higiene bucal", "saude bucal", "saúde bucal", "creme dental", "escova", "enxaguante"))
      return "higiene-bucal";
    if (contem(texto, "dermocosmet", "dermatocosmet")) return "dermocosmeticos";
    if (contem(texto, "cabelo", "capilar", "maquiagem", "beleza", "salao", "salão")) return "salao-e-beleza";
    if (contem(texto, "protetor solar")) return "protetor-solar";
    if (contem(texto, "solar")) return "solar";
    if (contem(texto, "preservativo", "camisinha")) return "preservativos";
    if (contem(texto, "eletron", "secador", "prancha", "barbeador")) return "eletronicos";
    if (contem(texto, "acessor", "utilidade")) return "acessorios";
    if (contem(texto, "creme", "pomada")) return "cremes-pomadas";
    if (contem(texto, "higiene", "sabonete", "desodorante", "shampoo", "higiene intima", "higiene íntima"))
      return "higiene-pessoal";
    return "perfumaria";
  }

  if (categoria === "mips") {
    if (contem(texto, "analges", "dor", "febre", "dipirona", "paracetamol", "ibuprofeno")) return "dor-e-febre";
    if (contem(texto, "antigrip", "gripe", "resfriado", "tosse")) return "gripe-e-resfriado";
    if (contem(texto, "antialerg", "alergia", "loratadina", "desloratadina", "fexofenadina")) return "alergia";
    if (contem(texto, "digest", "antiacido", "antiácido", "azia", "estomago", "estômago", "laxante")) return "digestao";
    if (contem(texto, "dermatolog")) return "dermatologicos";
    if (contem(texto, "oftalm")) return "oftalmicos";
    if (contem(texto, "nasal")) return "nasais";
    if (contem(texto, "creme", "pomada")) return "cremes-pomadas";
    if (contem(texto, "gota")) return "gotas";
    if (contem(texto, "spray", "aerosol")) return "spray";
    if (contem(texto, "pastilha")) return "pastilhas";
    return "outros-mips";
  }

  if (categoria === "medicamentos") {
    if (contem(texto, "generico", "genérico")) return "genericos";
    if (contem(texto, "similar")) return "similares";
    if (contem(texto, "uso continuo", "uso contínuo")) return "uso-continuo";
    if (contem(texto, "antibiot")) return "antibioticos";
    if (contem(texto, "anticoncepcional")) return "anticoncepcionais";
    if (contem(texto, "dermatolog")) return "dermatologicos";
    if (contem(texto, "oftalm")) return "oftalmicos";
    if (contem(texto, "nasal")) return "nasais";
    if (contem(texto, "otolog", "ouvido")) return "otologicos";
    if (contem(texto, "injet", "ampola")) return "injetaveis";
    if (contem(texto, "comprim", "capsula", "cápsula", "dragea", "drágea")) return "comprimidos-capsulas";
    if (contem(texto, "creme", "pomada")) return "cremes-pomadas";
    if (contem(texto, "gota")) return "gotas";
    if (contem(texto, "spray", "aerosol")) return "spray";
    if (contem(texto, "pastilha")) return "pastilhas";
    if (contem(texto, "supositorio", "supositório")) return "supositorios";
    return "medicamentos-de-marca";
  }

  return null;
}

export function classificarProdutoNoSite(produto: Produto): { categoria: string; subcategoria: string } {
  const categoriaOriginal = normalizar(produto.categoria);
  const subcategoriaOriginal = normalizar(produto.subcategoria);
  const texto = textoDoProduto(produto);
  const origem = `${categoriaOriginal} ${subcategoriaOriginal}`;

  if (categoriaFoiRemovida(produto.categoria)) return { categoria: "", subcategoria: "" };

  if (
    contem(
      origem,
      "fralda",
      "bebe",
      "bebes",
      "crianca",
      "crianças",
      "infantil",
      "mamadeira",
      "chupeta",
      "lencos umedecidos",
      "lenços umedecidos",
    )
  ) {
    return { categoria: "mamae-e-bebe", subcategoria: subcategoriaPorTexto(texto, "mamae-e-bebe") ?? "infantil" };
  }

  if (
    contem(
      origem,
      "conveniencia",
      "conveniência",
      "alimento",
      "boboniere",
      "adoçante",
      "adocante",
      "chips",
      "liquido",
      "líquido",
    )
  ) {
    return { categoria: "conveniencia", subcategoria: subcategoriaPorTexto(texto, "conveniencia") ?? "alimentos" };
  }

  if (contem(origem, "vitamina", "suplement", "nutricao esportiva", "nutrição esportiva", "academia")) {
    return {
      categoria: "vitaminas-e-suplementos",
      subcategoria: subcategoriaPorTexto(texto, "vitaminas-e-suplementos") ?? "suplementos",
    };
  }

  if (
    contem(
      origem,
      "hospital",
      "primeiros socorros",
      "ortopedia",
      "idosos",
      "incontinencia",
      "incontinência",
      "oficinais",
      "utilidades",
    )
  ) {
    return {
      categoria: "saude-e-bem-estar",
      subcategoria: subcategoriaPorTexto(texto, "saude-e-bem-estar") ?? "medico-hospitalar",
    };
  }

  if (contem(origem, "mip", "mips")) {
    return { categoria: "mips", subcategoria: subcategoriaPorTexto(texto, "mips") ?? "outros-mips" };
  }

  const pareceMIP =
    contem(origem, "analgesico", "analgésico", "antialergico", "antialérgico", "antigripal", "digestivo") &&
    !contem(origem, "uso continuo", "uso contínuo", "antibiot", "controlado");

  if (pareceMIP) {
    return { categoria: "mips", subcategoria: subcategoriaPorTexto(texto, "mips") ?? "outros-mips" };
  }

  if (
    contem(
      origem,
      "medicamento",
      "generico",
      "genérico",
      "similar",
      "marca",
      "antibiot",
      "anticoncepcional",
      "uso continuo",
      "uso contínuo",
    )
  ) {
    return {
      categoria: "medicamentos",
      subcategoria: subcategoriaPorTexto(texto, "medicamentos") ?? "medicamentos-de-marca",
    };
  }

  if (
    contem(
      origem,
      "perfumaria",
      "cosmet",
      "higiene",
      "beleza",
      "saude bucal",
      "saúde bucal",
      "cuidados intimos",
      "cuidados íntimos",
      "acessorios",
      "acessórios",
    )
  ) {
    return { categoria: "perfumaria", subcategoria: subcategoriaPorTexto(texto, "perfumaria") ?? "perfumaria" };
  }

  if (contem(texto, "fralda", "mamadeira", "chupeta", "lenço umedecido", "lenco umedecido")) {
    return { categoria: "mamae-e-bebe", subcategoria: subcategoriaPorTexto(texto, "mamae-e-bebe") ?? "infantil" };
  }

  if (contem(texto, "whey", "creatina", "suplemento", "vitamina", "mineral")) {
    return {
      categoria: "vitaminas-e-suplementos",
      subcategoria: subcategoriaPorTexto(texto, "vitaminas-e-suplementos") ?? "suplementos",
    };
  }

  if (contem(texto, "curativo", "termometro", "termômetro", "atadura", "ortopedic", "compressao", "compressão")) {
    return {
      categoria: "saude-e-bem-estar",
      subcategoria: subcategoriaPorTexto(texto, "saude-e-bem-estar") ?? "medico-hospitalar",
    };
  }

  if (
    contem(
      texto,
      "perfume",
      "sabonete",
      "desodorante",
      "shampoo",
      "protetor solar",
      "maquiagem",
      "preservativo",
      "creme dental",
      "escova dental",
    )
  ) {
    return { categoria: "perfumaria", subcategoria: subcategoriaPorTexto(texto, "perfumaria") ?? "perfumaria" };
  }

  return { categoria: "perfumaria", subcategoria: "perfumaria" };
}

export function produtosDaCategoriaSite(produtos: Produto[], categoria: string, sub?: string) {
  return produtos.filter((produto) => {
    const classificacao = classificarProdutoNoSite(produto);
    return classificacao.categoria === categoria && (!sub || classificacao.subcategoria === sub);
  });
}

export function categoriaFoiRemovida(slug: string): boolean {
  const categoria = slugify(slug);
  return CATEGORIAS_REMOVIDAS.includes(categoria) || categoria.includes("pet") || categoria.includes("animal");
}

export function removerProdutosDeCategoriasRemovidas(produtos: Produto[]) {
  return produtos.filter((produto) => !categoriaFoiRemovida(produto.categoria));
}

export function produtoTemImagem(produto: Produto): boolean {
  const imagem = produto.imagem?.trim().toLowerCase();
  return Boolean(imagem && !["null", "undefined", "sem imagem", "sem-imagem"].includes(imagem));
}

export function ordenarProdutosPorRelevancia(produtos: Produto[]) {
  return [...produtos].sort((a, b) => {
    const imagemA = produtoTemImagem(a) ? 1 : 0;
    const imagemB = produtoTemImagem(b) ? 1 : 0;
    if (imagemA !== imagemB) return imagemB - imagemA;
    const ofertaA = a.oferta ? 1 : 0;
    const ofertaB = b.oferta ? 1 : 0;
    if (ofertaA !== ofertaB) return ofertaB - ofertaA;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function ordenarSubcategoriasPorRelevancia(
  subcategorias: Subcategory[],
  categoriaSlug: string,
  produtos: Produto[],
) {
  const indiceOriginal = new Map(subcategorias.map((subcategoria, indice) => [subcategoria.slug, indice]));
  return [...subcategorias].sort((a, b) => {
    const totalA = produtosDaCategoriaSite(produtos, categoriaSlug, a.slug).length;
    const totalB = produtosDaCategoriaSite(produtos, categoriaSlug, b.slug).length;
    if (totalA !== totalB) return totalB - totalA;
    return (indiceOriginal.get(a.slug) ?? 0) - (indiceOriginal.get(b.slug) ?? 0);
  });
}

export function ordenarCategoriasPorRelevancia(categorias: Categoria[], produtos: Produto[]) {
  const indiceOriginal = new Map(ESTRUTURA_CATEGORIAS_SITE.map((categoria, indice) => [categoria.slug, indice]));
  return [...categorias].sort((a, b) => {
    const totalA = produtosDaCategoriaSite(produtos, a.slug).length;
    const totalB = produtosDaCategoriaSite(produtos, b.slug).length;
    if (totalA !== totalB) return totalB - totalA;
    return (indiceOriginal.get(a.slug) ?? 999) - (indiceOriginal.get(b.slug) ?? 999);
  });
}

export function acharCategoria(categorias: Categoria[], slug: string) {
  return categorias.find((categoria) => categoria.slug === slug);
}

export const precoFinal = (produto: Produto) => produto.precoPromocional ?? produto.preco;

export const formatarPreco = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
