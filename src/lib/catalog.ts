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
  vitrines?: {
    rasgaPreco: Produto[];
    ofertas: Produto[];
  };
};

export const CATEGORIAS_REMOVIDAS = [
  "pet",
  "pets",
  "produto-para-animais",
  "produtos-para-animais",
  "produtos-para-pet",
  "animais",
];

export const slugify = (n: string) =>
  n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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
      ["Spray", "spray"],
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
      ["Spray", "spray"],
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

function textoProduto(p: Produto) {
  return `${p.categoria} ${p.subcategoria} ${p.nome} ${p.descricao}`.toLowerCase();
}

const contem = (texto: string, ...termos: string[]) => termos.some((termo) => texto.includes(termo));

export function classificarProdutoNoSite(produto: Produto): { categoria: string; subcategoria: string } {
  const t = textoProduto(produto);

  const medicamento = contem(
    t,
    "medic",
    "generico",
    "genérico",
    "similar",
    "marcas",
    "antibiot",
    "anticoncepcional",
    "oftalm",
    "nasal",
    "otolog",
    "injet",
    "comprim",
    "capsula",
    "cápsula",
    "supositor",
  );

  const perfumaria = contem(
    t,
    "perfum",
    "higiene",
    "dermocosmet",
    "salao",
    "salão",
    "protetor solar",
    "preservativo",
    "acessor",
    "eletron",
  );

  if (contem(t, "fralda", "lenco", "lenço", "chupeta", "mamadeira", "copos", "higiene infanti")) {
    return {
      categoria: "mamae-e-bebe",
      subcategoria: contem(t, "fralda", "lenco", "lenço")
        ? "fraldas-lencos"
        : contem(t, "chupeta", "mamadeira", "copos")
          ? "chupetas-mamadeiras-copos"
          : "higiene-infantil",
    };
  }

  if (
    contem(t, "conveniencia", "conveniência", "boboniere", "alimentos", "liquidos", "líquidos", "adocante", "chips")
  ) {
    return {
      categoria: "conveniencia",
      subcategoria: contem(t, "boboniere")
        ? "boboniere"
        : contem(t, "alimentos")
          ? "alimentos"
          : contem(t, "adocante")
            ? "adocantes"
            : contem(t, "chips")
              ? "chips"
              : "liquidos",
    };
  }

  if (contem(t, "polivitamin", "suplement", "nutriçao esport", "nutrição esport", "academia")) {
    return {
      categoria: "vitaminas-e-suplementos",
      subcategoria: contem(t, "nutri")
        ? "nutricao-esportiva"
        : contem(t, "academia")
          ? "academia"
          : contem(t, "polivit")
            ? "polivitaminicos"
            : "suplementos",
    };
  }

  if (contem(t, "hospital", "ortopedic", "oficinais")) {
    return {
      categoria: "saude-e-bem-estar",
      subcategoria: contem(t, "ortopedic") ? "ortopedicos" : contem(t, "oficinais") ? "oficinais" : "medico-hospitalar",
    };
  }

  if (perfumaria) {
    let sub = "perfumaria";

    if (contem(t, "import")) sub = "perfumaria-importada";
    else if (contem(t, "higiene bucal", "oral")) sub = "higiene-bucal";
    else if (contem(t, "higiene")) sub = "higiene-pessoal";
    else if (contem(t, "dermocosmet")) sub = "dermocosmeticos";
    else if (contem(t, "salao", "salão", "beleza")) sub = "salao-e-beleza";
    else if (contem(t, "protetor solar")) sub = "protetor-solar";
    else if (contem(t, "solar")) sub = "solar";
    else if (contem(t, "preservativo")) sub = "preservativos";
    else if (contem(t, "acessor")) sub = "acessorios";
    else if (contem(t, "eletron")) sub = "eletronicos";
    else if (contem(t, "cremes", "pomadas")) sub = "cremes-pomadas";

    return {
      categoria: "perfumaria",
      subcategoria: sub,
    };
  }

  if (medicamento && contem(t, "analges", "antigrip", "antialerg", "digest", "dor", "febre", "gripe", "resfriado")) {
    let sub = "outros-mips";

    if (contem(t, "analges", "dor", "febre")) sub = "dor-e-febre";
    else if (contem(t, "antigrip", "gripe", "resfriado")) sub = "gripe-e-resfriado";
    else if (contem(t, "antialerg", "alerg")) sub = "alergia";
    else if (contem(t, "digest")) sub = "digestao";

    return {
      categoria: "mips",
      subcategoria: sub,
    };
  }

  if (medicamento) {
    let sub = "medicamentos-de-marca";

    if (contem(t, "generico", "genérico")) sub = "genericos";
    else if (contem(t, "similar")) sub = "similares";
    else if (contem(t, "antibiot")) sub = "antibioticos";
    else if (contem(t, "anticoncepcional")) sub = "anticoncepcionais";
    else if (contem(t, "dermatolog")) sub = "dermatologicos";
    else if (contem(t, "oftalm")) sub = "oftalmicos";
    else if (contem(t, "nasal")) sub = "nasais";
    else if (contem(t, "otolog")) sub = "otologicos";
    else if (contem(t, "injet")) sub = "injetaveis";
    else if (contem(t, "comprim", "capsula", "cápsula")) sub = "comprimidos-capsulas";
    else if (contem(t, "spray", "aerosol")) sub = "spray";
    else if (contem(t, "gotas")) sub = "gotas";
    else if (contem(t, "pastilhas")) sub = "pastilhas";
    else if (contem(t, "supositor")) sub = "supositorios";

    return {
      categoria: "medicamentos",
      subcategoria: sub,
    };
  }

  return {
    categoria: "perfumaria",
    subcategoria: "perfumaria",
  };
}

export function produtosDaCategoriaSite(produtos: Produto[], categoria: string, sub?: string) {
  return produtos.filter((produto) => {
    const c = classificarProdutoNoSite(produto);

    return c.categoria === categoria && (!sub || c.subcategoria === sub);
  });
}

export const precoFinal = (p: Produto) => p.precoPromocional ?? p.preco;

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function produtoTemImagem(produto: Produto): boolean {
  if (!produto.imagem) {
    return false;
  }

  const imagem = produto.imagem.trim();

  if (!imagem) {
    return false;
  }

  const valor = imagem.toLowerCase();

  if (valor === "null" || valor === "undefined" || valor === "sem imagem" || valor === "sem-imagem") {
    return false;
  }

  return true;
}

export function categoriaFoiRemovida(slug: string): boolean {
  const categoria = slugify(slug);

  if (CATEGORIAS_REMOVIDAS.includes(categoria)) {
    return true;
  }

  return categoria.includes("pet") || categoria.includes("animal");
}

export function ordenarProdutosPorRelevancia(produtos: Produto[]) {
  return [...produtos].sort((a, b) => {
    const aImagem = produtoTemImagem(a) ? 1 : 0;
    const bImagem = produtoTemImagem(b) ? 1 : 0;

    if (aImagem !== bImagem) {
      return bImagem - aImagem;
    }

    const aOferta = a.oferta ? 1 : 0;
    const bOferta = b.oferta ? 1 : 0;

    if (aOferta !== bOferta) {
      return bOferta - aOferta;
    }

    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
