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

const cacheTermosNormalizados = new Map<string, string>();

const normalizarTermo = (termo: string) => {
  const existente = cacheTermosNormalizados.get(termo);
  if (existente !== undefined) return existente;
  const normalizado = normalizar(termo);
  cacheTermosNormalizados.set(termo, normalizado);
  return normalizado;
};

const contem = (texto: string, ...termos: string[]) => termos.some((termo) => texto.includes(normalizarTermo(termo)));

const textoDoProduto = (produto: Produto) =>
  normalizar([produto.nome, produto.descricao, ...(produto.informacoes ?? [])].filter(Boolean).join(" "));

const origemDoProduto = (produto: Produto) =>
  normalizar([produto.categoria, produto.subcategoria].filter(Boolean).join(" "));

const criarSubcategorias = (itens: Array<[string, string]>): Subcategory[] =>
  itens.map(([nome, slug]) => ({
    nome,
    slug,
  }));

export const ESTRUTURA_CATEGORIAS_SITE: Categoria[] = [
  {
    nome: "Medicamentos de Marca",
    slug: "medicamentos-de-marca",
    icone: "💊",
    subcategorias: criarSubcategorias([
      ["Analgésicos e antitérmicos", "analgesicos-antitermicos"],
      ["Anti-inflamatórios", "anti-inflamatorios"],
      ["Antialérgicos", "antialergicos"],
      ["Antibióticos", "antibioticos"],
      ["Antifúngicos e antivirais", "antifungicos-antivirais"],
      ["Cardiovasculares e pressão", "cardiovasculares-pressao"],
      ["Diabetes e metabolismo", "diabetes-metabolismo"],
      ["Colesterol e triglicerídeos", "colesterol-triglicerideos"],
      ["Gastrointestinais", "gastrointestinais"],
      ["Respiratórios", "respiratorios"],
      ["Sistema nervoso", "sistema-nervoso"],
      ["Anticoncepcionais", "anticoncepcionais"],
      ["Saúde feminina", "saude-feminina"],
      ["Saúde masculina e urológicos", "saude-masculina-urologicos"],
      ["Dermatológicos", "dermatologicos"],
      ["Oftálmicos", "oftalmicos"],
      ["Otológicos", "otologicos"],
      ["Nasais", "nasais"],
      ["Vitaminas e minerais", "vitaminas-minerais"],
      ["Comprimidos e cápsulas", "comprimidos-capsulas"],
      ["Líquidos e xaropes", "liquidos-xaropes"],
      ["Gotas", "gotas"],
      ["Cremes e pomadas", "cremes-pomadas"],
      ["Sprays e aerossóis", "sprays-aerossois"],
      ["Pastilhas", "pastilhas"],
      ["Supositórios", "supositorios"],
      ["Injetáveis", "injetaveis"],
      ["Outros medicamentos", "outros-medicamentos"],
    ]),
  },
  {
    nome: "Medicamentos Genéricos",
    slug: "medicamentos-genericos",
    icone: "💊",
    subcategorias: criarSubcategorias([
      ["Analgésicos e antitérmicos", "analgesicos-antitermicos"],
      ["Anti-inflamatórios", "anti-inflamatorios"],
      ["Antialérgicos", "antialergicos"],
      ["Antibióticos", "antibioticos"],
      ["Antifúngicos e antivirais", "antifungicos-antivirais"],
      ["Cardiovasculares e pressão", "cardiovasculares-pressao"],
      ["Diabetes e metabolismo", "diabetes-metabolismo"],
      ["Colesterol e triglicerídeos", "colesterol-triglicerideos"],
      ["Gastrointestinais", "gastrointestinais"],
      ["Respiratórios", "respiratorios"],
      ["Sistema nervoso", "sistema-nervoso"],
      ["Anticoncepcionais", "anticoncepcionais"],
      ["Saúde feminina", "saude-feminina"],
      ["Saúde masculina e urológicos", "saude-masculina-urologicos"],
      ["Dermatológicos", "dermatologicos"],
      ["Oftálmicos", "oftalmicos"],
      ["Otológicos", "otologicos"],
      ["Nasais", "nasais"],
      ["Vitaminas e minerais", "vitaminas-minerais"],
      ["Comprimidos e cápsulas", "comprimidos-capsulas"],
      ["Líquidos e xaropes", "liquidos-xaropes"],
      ["Gotas", "gotas"],
      ["Cremes e pomadas", "cremes-pomadas"],
      ["Sprays e aerossóis", "sprays-aerossois"],
      ["Pastilhas", "pastilhas"],
      ["Supositórios", "supositorios"],
      ["Injetáveis", "injetaveis"],
      ["Outros medicamentos", "outros-medicamentos"],
    ]),
  },
  {
    nome: "Medicamentos Similares",
    slug: "medicamentos-similares",
    icone: "💊",
    subcategorias: criarSubcategorias([
      ["Analgésicos e antitérmicos", "analgesicos-antitermicos"],
      ["Anti-inflamatórios", "anti-inflamatorios"],
      ["Antialérgicos", "antialergicos"],
      ["Antibióticos", "antibioticos"],
      ["Antifúngicos e antivirais", "antifungicos-antivirais"],
      ["Cardiovasculares e pressão", "cardiovasculares-pressao"],
      ["Diabetes e metabolismo", "diabetes-metabolismo"],
      ["Colesterol e triglicerídeos", "colesterol-triglicerideos"],
      ["Gastrointestinais", "gastrointestinais"],
      ["Respiratórios", "respiratorios"],
      ["Sistema nervoso", "sistema-nervoso"],
      ["Anticoncepcionais", "anticoncepcionais"],
      ["Saúde feminina", "saude-feminina"],
      ["Saúde masculina e urológicos", "saude-masculina-urologicos"],
      ["Dermatológicos", "dermatologicos"],
      ["Oftálmicos", "oftalmicos"],
      ["Otológicos", "otologicos"],
      ["Nasais", "nasais"],
      ["Vitaminas e minerais", "vitaminas-minerais"],
      ["Comprimidos e cápsulas", "comprimidos-capsulas"],
      ["Líquidos e xaropes", "liquidos-xaropes"],
      ["Gotas", "gotas"],
      ["Cremes e pomadas", "cremes-pomadas"],
      ["Sprays e aerossóis", "sprays-aerossois"],
      ["Pastilhas", "pastilhas"],
      ["Supositórios", "supositorios"],
      ["Injetáveis", "injetaveis"],
      ["Outros medicamentos", "outros-medicamentos"],
    ]),
  },
  {
    nome: "MIPs",
    slug: "mips",
    icone: "🩺",
    subcategorias: criarSubcategorias([
      ["Dor e febre", "dor-febre"],
      ["Gripe e resfriado", "gripe-resfriado"],
      ["Tosse", "tosse"],
      ["Alergias", "alergias"],
      ["Digestão e azia", "digestao-azia"],
      ["Intestino", "intestino"],
      ["Vitaminas", "vitaminas"],
      ["Cuidados dermatológicos", "cuidados-dermatologicos"],
      ["Cuidados oftálmicos", "cuidados-oftalmicos"],
      ["Cuidados nasais", "cuidados-nasais"],
      ["Cremes e pomadas", "cremes-pomadas"],
      ["Gotas", "gotas"],
      ["Sprays", "sprays"],
      ["Pastilhas", "pastilhas"],
      ["Outros MIPs", "outros-mips"],
    ]),
  },
  {
    nome: "Higiene Feminina e Íntima",
    slug: "higiene-feminina-intima",
    icone: "🌸",
    subcategorias: criarSubcategorias([
      ["Absorventes menstruais", "absorventes-menstruais"],
      ["Absorventes noturnos", "absorventes-noturnos"],
      ["Absorventes com abas", "absorventes-com-abas"],
      ["Absorventes sem abas", "absorventes-sem-abas"],
      ["Absorventes internos", "absorventes-internos"],
      ["Protetores diários", "protetores-diarios"],
      ["Coletores menstruais", "coletores-menstruais"],
      ["Sabonetes íntimos", "sabonetes-intimos"],
      ["Cuidados íntimos", "cuidados-intimos"],
      ["Preservativos", "preservativos"],
      ["Lubrificantes", "lubrificantes"],
      ["Outros cuidados íntimos", "outros-cuidados-intimos"],
    ]),
  },
  {
    nome: "Mamãe e Bebê",
    slug: "mamae-e-bebe",
    icone: "🍼",
    subcategorias: criarSubcategorias([
      ["Fraldas infantis", "fraldas-infantis"],
      ["Fraldas tipo shortinho", "fraldas-shortinho"],
      ["Fraldas calça", "fraldas-calca"],
      ["Fraldas para recém-nascido", "fraldas-recem-nascido"],
      ["Lenços umedecidos", "lencos-umedecidos"],
      ["Higiene do bebê", "higiene-bebe"],
      ["Sabonetes infantis", "sabonetes-infantis"],
      ["Shampoos infantis", "shampoos-infantis"],
      ["Condicionadores infantis", "condicionadores-infantis"],
      ["Colônias infantis", "colonias-infantis"],
      ["Pomadas para assaduras", "pomadas-assaduras"],
      ["Cuidados com a pele do bebê", "cuidados-pele-bebe"],
      ["Chupetas", "chupetas"],
      ["Mamadeiras", "mamadeiras"],
      ["Copos infantis", "copos-infantis"],
      ["Alimentação infantil", "alimentacao-infantil"],
      ["Leites e fórmulas infantis", "leites-formulas-infantis"],
      ["Acessórios para bebê", "acessorios-bebe"],
      ["Brinquedos infantis", "brinquedos-infantis"],
    ]),
  },
  {
    nome: "Incontinência e Cuidados Adultos",
    slug: "incontinencia-cuidados-adultos",
    icone: "🧓",
    subcategorias: criarSubcategorias([
      ["Fraldas geriátricas", "fraldas-geriatricas"],
      ["Fraldas adultas", "fraldas-adultas"],
      ["Roupas íntimas descartáveis", "roupas-intimas-descartaveis"],
      ["Absorventes para incontinência", "absorventes-incontinencia"],
      ["Proteções noturnas", "protecao-noturna"],
      ["Produtos para incontinência", "produtos-incontinencia"],
      ["Cuidados pessoais para adultos", "cuidados-adultos"],
    ]),
  },
  {
    nome: "Perfumaria e Cosméticos",
    slug: "perfumaria-cosmeticos",
    icone: "🧴",
    subcategorias: criarSubcategorias([
      ["Perfumes", "perfumes"],
      ["Perfumes importados", "perfumes-importados"],
      ["Deo colônias", "deo-colonias"],
      ["Hidratantes corporais", "hidratantes-corporais"],
      ["Cuidados faciais", "cuidados-faciais"],
      ["Produtos anti-idade", "anti-idade"],
      ["Limpeza facial", "limpeza-facial"],
      ["Dermocosméticos", "dermocosmeticos"],
      ["Tratamentos dermatológicos cosméticos", "tratamentos-dermatologicos"],
      ["Maquiagem", "maquiagem"],
      ["Produtos capilares", "produtos-capilares"],
      ["Shampoos", "shampoos"],
      ["Condicionadores", "condicionadores"],
      ["Tratamentos capilares", "tratamentos-capilares"],
      ["Coloração", "coloracao"],
      ["Cuidados masculinos", "cuidados-masculinos"],
      ["Cuidados pessoais", "cuidados-pessoais"],
      ["Barba", "barba"],
      ["Depilação", "depilacao"],
      ["Protetores solares", "protetores-solares"],
      ["Pós-sol", "pos-sol"],
      ["Produtos de salão", "produtos-salao"],
      ["Acessórios de beleza", "acessorios-beleza"],
    ]),
  },
  {
    nome: "Higiene Pessoal",
    slug: "higiene-pessoal",
    icone: "🧼",
    subcategorias: criarSubcategorias([
      ["Sabonetes", "sabonetes"],
      ["Sabonetes líquidos", "sabonetes-liquidos"],
      ["Desodorantes", "desodorantes"],
      ["Antitranspirantes", "antitranspirantes"],
      ["Higiene corporal", "higiene-corporal"],
      ["Higiene das mãos", "higiene-maos"],
      ["Higiene masculina", "higiene-masculina"],
      ["Barbear", "barbear"],
      ["Repelentes", "repelentes"],
      ["Cuidados com unhas", "cuidados-unhas"],
      ["Cuidados pessoais", "cuidados-pessoais"],
      ["Algodão e lenços", "algodao-lencos"],
      ["Outros produtos de higiene", "outros-higiene"],
    ]),
  },
  {
    nome: "Saúde Bucal",
    slug: "saude-bucal",
    icone: "🦷",
    subcategorias: criarSubcategorias([
      ["Cremes dentais", "cremes-dentais"],
      ["Escovas dentais", "escovas-dentais"],
      ["Escovas infantis", "escovas-infantis"],
      ["Enxaguantes bucais", "enxaguantes-bucais"],
      ["Fio dental", "fio-dental"],
      ["Escovas interdentais", "escovas-interdentais"],
      ["Higiene de próteses", "higiene-proteses"],
      ["Acessórios odontológicos", "acessorios-odontologicos"],
      ["Clareamento e estética", "clareamento-estetica"],
    ]),
  },
  {
    nome: "Vitaminas e Suplementos",
    slug: "vitaminas-suplementos",
    icone: "💪",
    subcategorias: criarSubcategorias([
      ["Multivitamínicos", "multivitaminicos"],
      ["Vitamina C", "vitamina-c"],
      ["Vitamina D", "vitamina-d"],
      ["Complexo B", "complexo-b"],
      ["Minerais", "minerais"],
      ["Cálcio", "calcio"],
      ["Magnésio", "magnesio"],
      ["Ferro", "ferro"],
      ["Ômega 3", "omega-3"],
      ["Suplementos alimentares", "suplementos-alimentares"],
      ["Proteínas", "proteinas"],
      ["Whey protein", "whey-protein"],
      ["Creatina", "creatina"],
      ["Nutrição esportiva", "nutricao-esportiva"],
      ["Academia", "academia"],
      ["Produtos naturais", "produtos-naturais"],
    ]),
  },
  {
    nome: "Saúde, Primeiros Socorros e Hospitalar",
    slug: "saude-primeiros-socorros-hospitalar",
    icone: "🩹",
    subcategorias: criarSubcategorias([
      ["Curativos", "curativos"],
      ["Gaze", "gaze"],
      ["Algodão", "algodao"],
      ["Ataduras", "ataduras"],
      ["Esparadrapos e fitas", "esparadrapos-fitas"],
      ["Antissépticos", "antissepticos"],
      ["Álcool", "alcool"],
      ["Cicatrizantes", "cicatrizantes"],
      ["Seringas", "seringas"],
      ["Agulhas", "agulhas"],
      ["Lancetas", "lancetas"],
      ["Cateteres", "cateteres"],
      ["Equipos", "equipos"],
      ["Coletores", "coletores"],
      ["Termômetros", "termometros"],
      ["Aparelhos de pressão", "aparelhos-pressao"],
      ["Medidores", "medidores"],
      ["Produtos hospitalares", "produtos-hospitalares"],
      ["Cadeiras de rodas", "cadeiras-rodas"],
      ["Outros produtos de saúde", "outros-saude"],
    ]),
  },
  {
    nome: "Ortopedia e Cuidados Especiais",
    slug: "ortopedia-cuidados-especiais",
    icone: "🦵",
    subcategorias: criarSubcategorias([
      ["Joelheiras", "joelheiras"],
      ["Cintas", "cintas"],
      ["Tornozeleiras", "tornozeleiras"],
      ["Munhequeiras", "munhequeiras"],
      ["Cotoveleiras", "cotoveleiras"],
      ["Meias de compressão", "meias-compressao"],
      ["Suportes", "suportes"],
      ["Bengalas", "bengalas"],
      ["Produtos ortopédicos", "produtos-ortopedicos"],
      ["Produtos para mobilidade", "mobilidade"],
      ["Cuidados especiais", "cuidados-especiais"],
    ]),
  },
  {
    nome: "Conveniência e Alimentos",
    slug: "conveniencia-alimentos",
    icone: "🍫",
    subcategorias: criarSubcategorias([
      ["Chocolates", "chocolates"],
      ["Balas", "balas"],
      ["Doces", "doces"],
      ["Biscoitos", "biscoitos"],
      ["Snacks", "snacks"],
      ["Chips", "chips"],
      ["Bebidas", "bebidas"],
      ["Águas", "aguas"],
      ["Sucos", "sucos"],
      ["Leites", "leites"],
      ["Adoçantes", "adocantes"],
      ["Alimentos naturais", "alimentos-naturais"],
      ["Produtos funcionais", "produtos-funcionais"],
      ["Outros alimentos", "outros-alimentos"],
    ]),
  },
  {
    nome: "Utilidades, Acessórios e Eletrônicos",
    slug: "utilidades-acessorios-eletronicos",
    icone: "🔌",
    subcategorias: criarSubcategorias([
      ["Acessórios", "acessorios"],
      ["Eletrônicos", "eletronicos"],
      ["Pilhas", "pilhas"],
      ["Acessórios de beleza", "acessorios-beleza"],
      ["Pequenos itens de utilidade", "pequenos-itens-utilidade"],
      ["Produtos diversos", "produtos-diversos"],
    ]),
  },
];

function identificarTipoMedicamento(origem: string): string {
  if (
    contem(
      origem,
      "generico",
      "genericos",
      "medicamentos genericos",
      "genericos 01",
      "genericos 02",
      "genericos 03",
      "genericos 04",
      "genericos 05",
      "genericos 06",
      "genericos 07",
    )
  ) {
    return "medicamentos-genericos";
  }

  if (contem(origem, "similar", "similares")) {
    return "medicamentos-similares";
  }

  return "medicamentos-de-marca";
}

function classificarSubcategoriaMedicamento(texto: string): string {
  if (
    contem(
      texto,
      "amoxicilina",
      "amoxic",
      "azitromicina",
      "ampicilina",
      "cefadroxila",
      "cefalexina",
      "cefuroxima",
      "claritromicina",
      "clindamicina",
      "doxiciclina",
      "levofloxacino",
      "moxifloxacino",
      "metronidazol",
      "nitrofurantoina",
      "sulfametoxazol",
      "trimetoprima",
      "antibiotico",
    )
  ) {
    return "antibioticos";
  }

  if (
    contem(
      texto,
      "anticoncepcional",
      "levonorgestrel",
      "etinilestradiol",
      "drospirenona",
      "desogestrel",
      "noretisterona",
      "contraceptivo",
    )
  ) {
    return "anticoncepcionais";
  }

  if (contem(texto, "dipirona", "paracetamol", "dorflex", "analgesico", "analgésico", "antitermico", "antitérmico")) {
    return "analgesicos-antitermicos";
  }

  if (
    contem(
      texto,
      "ibuprofeno",
      "diclofenaco",
      "nimesulida",
      "naproxeno",
      "cetoprofeno",
      "meloxicam",
      "aceclofenaco",
      "antiinflamatorio",
      "anti-inflamatorio",
    )
  ) {
    return "anti-inflamatorios";
  }

  if (
    contem(
      texto,
      "loratadina",
      "desloratadina",
      "fexofenadina",
      "cetirizina",
      "levocetirizina",
      "dexclorfeniramina",
      "antialergico",
      "antialérgico",
    )
  ) {
    return "antialergicos";
  }

  if (
    contem(
      texto,
      "cetoconazol",
      "clotrimazol",
      "miconazol",
      "terbinafina",
      "fluconazol",
      "aciclovir",
      "mupirocina",
      "betametasona",
      "clobetasol",
      "mometasona",
      "sulfadiazina de prata",
    )
  ) {
    return "dermatologicos";
  }

  if (
    contem(
      texto,
      "losartana",
      "enalapril",
      "captopril",
      "atenolol",
      "amlodipino",
      "metoprolol",
      "selozok",
      "valsartana",
      "furosemida",
      "hidroclorotiazida",
      "pressao arterial",
      "hipertensao",
      "hipertensão",
    )
  ) {
    return "cardiovasculares-pressao";
  }

  if (contem(texto, "metformina", "gliclazida", "glibenclamida", "insulina", "diabetes", "diabetico", "diabético")) {
    return "diabetes-metabolismo";
  }

  if (
    contem(
      texto,
      "sinvastatina",
      "atorvastatina",
      "rosuvastatina",
      "pravastatina",
      "colesterol",
      "triglicerideo",
      "triglicerídeo",
    )
  ) {
    return "colesterol-triglicerideos";
  }

  if (
    contem(
      texto,
      "omeprazol",
      "pantoprazol",
      "esomeprazol",
      "domperidona",
      "metoclopramida",
      "simeticona",
      "lactulose",
      "bisacodil",
      "antiacido",
      "antiácido",
      "azia",
      "estomago",
      "estômago",
      "digestivo",
      "laxante",
    )
  ) {
    return "gastrointestinais";
  }

  if (
    contem(
      texto,
      "salbutamol",
      "budesonida",
      "fenoterol",
      "acetilcisteina",
      "ambroxol",
      "bronco",
      "tosse",
      "asma",
      "antigripal",
      "gripe",
      "resfriado",
    )
  ) {
    return "respiratorios";
  }

  if (
    contem(
      texto,
      "sildenafila",
      "tadalafila",
      "finasterida",
      "tansulosina",
      "prostata",
      "próstata",
      "urologico",
      "urológico",
      "disfuncao eretil",
      "disfunção erétil",
    )
  ) {
    return "saude-masculina-urologicos";
  }

  if (
    contem(
      texto,
      "antidepressivo",
      "sertralina",
      "fluoxetina",
      "escitalopram",
      "amitriptilina",
      "clonazepam",
      "diazepam",
      "alprazolam",
      "carbamazepina",
      "gabapentina",
      "pregabalina",
      "sistema nervoso",
    )
  ) {
    return "sistema-nervoso";
  }

  if (contem(texto, "oftalmico", "oftálmico", "colirio", "colírio", "lubrificante ocular")) {
    return "oftalmicos";
  }

  if (contem(texto, "otologico", "otológico", "ouvido", "auricular")) {
    return "otologicos";
  }

  if (contem(texto, "nasal", "nariz", "descongestionante nasal")) {
    return "nasais";
  }

  if (
    contem(
      texto,
      "vitamina",
      "vitaminas",
      "vitamina c",
      "vitamina d",
      "complexo b",
      "calcio",
      "cálcio",
      "magnesio",
      "magnésio",
      "ferro",
    )
  ) {
    return "vitaminas-minerais";
  }

  if (contem(texto, "comprimido", "comprimidos", "capsula", "cápsula", "capsulas", "cápsulas", "dragea", "drágea")) {
    return "comprimidos-capsulas";
  }

  if (contem(texto, "xarope", "solucao oral", "solução oral", "suspensao oral", "suspensão oral")) {
    return "liquidos-xaropes";
  }

  if (contem(texto, "gota", "gotas", "solucao oftalmica", "solução oftálmica")) {
    return "gotas";
  }

  if (contem(texto, "creme", "pomada", "gel dermatologico", "gel dermatológico")) {
    return "cremes-pomadas";
  }

  if (contem(texto, "spray")) {
    return "sprays-aerossois";
  }

  if (contem(texto, "aerosol", "aerossol")) {
    return "sprays-aerossois";
  }

  if (contem(texto, "pastilha")) {
    return "pastilhas";
  }

  if (contem(texto, "supositorio", "supositório")) {
    return "supositorios";
  }

  if (contem(texto, "injetavel", "injetável", "ampola", "injeção", "injecao")) {
    return "injetaveis";
  }

  return "outros-medicamentos";
}

function classificarMIP(texto: string): string {
  if (contem(texto, "dipirona", "paracetamol", "ibuprofeno", "dor", "febre")) {
    return "dor-febre";
  }

  if (contem(texto, "gripe", "resfriado", "antigripal")) {
    return "gripe-resfriado";
  }

  if (contem(texto, "tosse", "expectorante", "antitussivo")) {
    return "tosse";
  }

  if (contem(texto, "loratadina", "desloratadina", "fexofenadina", "cetirizina", "alergia")) {
    return "alergias";
  }

  if (contem(texto, "azia", "antiacido", "antiácido", "digestivo", "estomago", "estômago")) {
    return "digestao-azia";
  }

  if (contem(texto, "laxante", "intestino", "constipacao", "constipação")) {
    return "intestino";
  }

  if (contem(texto, "vitamina")) {
    return "vitaminas";
  }

  if (contem(texto, "oftalm", "colirio", "colírio")) {
    return "cuidados-oftalmicos";
  }

  if (contem(texto, "nasal", "nariz")) {
    return "cuidados-nasais";
  }

  if (contem(texto, "creme", "pomada")) {
    return "cremes-pomadas";
  }

  if (contem(texto, "gota")) {
    return "gotas";
  }

  if (contem(texto, "spray", "aerosol")) {
    return "sprays";
  }

  if (contem(texto, "pastilha")) {
    return "pastilhas";
  }

  return "outros-mips";
}

export function classificarProdutoNoSite(produto: Produto): {
  categoria: string;
  subcategoria: string;
} {
  const texto = textoDoProduto(produto);
  const origem = origemDoProduto(produto);

  if (
    contem(texto, "pet", "cachorro", "cão", "cao", "gato", "animal", "canino", "felino", "veterinario", "veterinário")
  ) {
    return {
      categoria: "",
      subcategoria: "",
    };
  }

  if (
    contem(
      texto,
      "geriatrico",
      "geriátrico",
      "geriatric",
      "incontinencia",
      "incontinência",
      "bigfral",
      "plenitud",
      "roupa intima",
      "roupa íntima",
      "fralda ger",
      "fralda adulto",
      "absorvente geriatrico",
      "absorvente geriátrico",
      "absorvente para incontinencia",
      "absorvente para incontinência",
    )
  ) {
    if (contem(texto, "roupa intima", "roupa íntima", "pants", "short")) {
      return {
        categoria: "incontinencia-cuidados-adultos",
        subcategoria: "roupas-intimas-descartaveis",
      };
    }

    if (contem(texto, "absorvente")) {
      return {
        categoria: "incontinencia-cuidados-adultos",
        subcategoria: "absorventes-incontinencia",
      };
    }

    if (contem(texto, "noturna", "noturno")) {
      return {
        categoria: "incontinencia-cuidados-adultos",
        subcategoria: "protecao-noturna",
      };
    }

    if (contem(texto, "fralda")) {
      return {
        categoria: "incontinencia-cuidados-adultos",
        subcategoria: "fraldas-geriatricas",
      };
    }

    return {
      categoria: "incontinencia-cuidados-adultos",
      subcategoria: "cuidados-adultos",
    };
  }

  if (
    contem(
      texto,
      "absorvente",
      "protetor diario",
      "protetor diário",
      "absorvente interno",
      "absorvente interno",
      "coletor menstrual",
      "coletor menstrual",
      "intimus",
      "sempre livre",
      "sempre-livre",
      "always",
      "tampon",
      "tampao",
      "tampão",
    )
  ) {
    if (contem(texto, "absorvente interno", "tampon", "tampao", "tampão")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "absorventes-internos",
      };
    }

    if (contem(texto, "protetor diario", "protetor diário")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "protetores-diarios",
      };
    }

    if (contem(texto, "coletor menstrual")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "coletores-menstruais",
      };
    }

    if (contem(texto, "noturno", "noturna")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "absorventes-noturnos",
      };
    }

    if (contem(texto, "com abas", "com abas")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "absorventes-com-abas",
      };
    }

    if (contem(texto, "sem abas", "sem abas")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "absorventes-sem-abas",
      };
    }

    return {
      categoria: "higiene-feminina-intima",
      subcategoria: "absorventes-menstruais",
    };
  }

  if (
    contem(
      texto,
      "fralda",
      "babysec",
      "pampers",
      "huggies",
      "mamy poko",
      "mamypoko",
      "personal baby",
      "cremer fralda",
      "fofura fralda",
      "turma da monica",
      "turma da mônica",
    )
  ) {
    if (contem(texto, "shortinho")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "fraldas-shortinho",
      };
    }

    if (contem(texto, "fralda calca", "fralda calça", "pants")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "fraldas-calca",
      };
    }

    if (contem(texto, "rn", "recem nascido", "recém nascido")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "fraldas-recem-nascido",
      };
    }

    return {
      categoria: "mamae-e-bebe",
      subcategoria: "fraldas-infantis",
    };
  }

  if (contem(texto, "chupeta", "mamadeira", "copo infantil", "copo bebe", "copo bebê", "bico de mamadeira")) {
    if (contem(texto, "mamadeira", "bico de mamadeira")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "mamadeiras",
      };
    }

    if (contem(texto, "chupeta")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "chupetas",
      };
    }

    return {
      categoria: "mamae-e-bebe",
      subcategoria: "copos-infantis",
    };
  }

  if (contem(texto, "lenco umedecido", "lenço umedecido", "lencos umedecidos", "lenços umedecidos")) {
    return {
      categoria: "mamae-e-bebe",
      subcategoria: "lencos-umedecidos",
    };
  }

  if (
    contem(
      texto,
      "baruel baby",
      "dove baby",
      "mustela bebe",
      "mustela bebê",
      "higiene infantil",
      "shampoo infantil",
      "sabonete infantil",
      "colonia infantil",
      "colônia infantil",
      "pomada para assadura",
      "assadura",
    )
  ) {
    if (contem(texto, "pomada", "assadura")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "pomadas-assaduras",
      };
    }

    if (contem(texto, "shampoo", "sh ")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "shampoos-infantis",
      };
    }

    if (contem(texto, "sabonete", "sab ")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "sabonetes-infantis",
      };
    }

    if (contem(texto, "colonia", "colônia")) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "colonias-infantis",
      };
    }

    return {
      categoria: "mamae-e-bebe",
      subcategoria: "higiene-bebe",
    };
  }

  if (contem(origem, "mips", "mip")) {
    return {
      categoria: "mips",
      subcategoria: classificarMIP(texto),
    };
  }

  const pareceMIP =
    contem(
      texto,
      "dipirona",
      "paracetamol",
      "ibuprofeno",
      "loratadina",
      "fexofenadina",
      "desloratadina",
      "antigripal",
      "antiacido",
      "antiácido",
      "pastilha para garganta",
    ) && !contem(origem, "generico", "genérico", "similar", "antibiotico", "antibiótico", "controlado");

  if (pareceMIP) {
    return {
      categoria: "mips",
      subcategoria: classificarMIP(texto),
    };
  }

  const medicamentoExplicito =
    contem(
      origem,
      "medicamento",
      "medicamentos",
      "generico",
      "genérico",
      "genericos",
      "similar",
      "similares",
      "marca",
      "marcas",
      "antibiotico",
      "antibiótico",
      "anticoncepcional",
    ) ||
    contem(
      texto,
      "amoxicilina",
      "azitromicina",
      "cefalexina",
      "dipirona",
      "paracetamol",
      "losartana",
      "omeprazol",
      "selozok",
      "metformina",
      "sinvastatina",
      "aciclovir",
      "cetoconazol",
      "mupirocina",
      "levotiroxina",
      "antibiotico",
      "antibiótico",
    );

  if (medicamentoExplicito) {
    return {
      categoria: identificarTipoMedicamento(origem),
      subcategoria: classificarSubcategoriaMedicamento(texto),
    };
  }

  if (
    contem(
      texto,
      "creme dental",
      "creme dent",
      "escova dental",
      "escova de dente",
      "enxaguante bucal",
      "fio dental",
      "escova interdental",
      "higiene bucal",
      "saude bucal",
      "saúde bucal",
    )
  ) {
    if (contem(texto, "fio dental")) {
      return {
        categoria: "saude-bucal",
        subcategoria: "fio-dental",
      };
    }

    if (contem(texto, "enxaguante")) {
      return {
        categoria: "saude-bucal",
        subcategoria: "enxaguantes-bucais",
      };
    }

    if (contem(texto, "escova interdental")) {
      return {
        categoria: "saude-bucal",
        subcategoria: "escovas-interdentais",
      };
    }

    if (contem(texto, "escova")) {
      return {
        categoria: "saude-bucal",
        subcategoria: "escovas-dentais",
      };
    }

    return {
      categoria: "saude-bucal",
      subcategoria: "cremes-dentais",
    };
  }

  if (
    contem(
      texto,
      "whey",
      "creatina",
      "suplemento",
      "vitamina",
      "multivitamin",
      "polivitamin",
      "omega 3",
      "ômega 3",
      "nutricao esportiva",
      "nutrição esportiva",
      "academia",
      "mineral",
    )
  ) {
    if (contem(texto, "whey")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "whey-protein",
      };
    }

    if (contem(texto, "creatina")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "creatina",
      };
    }

    if (contem(texto, "vitamina c")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "vitamina-c",
      };
    }

    if (contem(texto, "vitamina d")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "vitamina-d",
      };
    }

    if (contem(texto, "complexo b")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "complexo-b",
      };
    }

    if (contem(texto, "calcio", "cálcio")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "calcio",
      };
    }

    if (contem(texto, "magnesio", "magnésio")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "magnesio",
      };
    }

    if (contem(texto, "ferro")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "ferro",
      };
    }

    if (contem(texto, "omega 3", "ômega 3")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "omega-3",
      };
    }

    if (contem(texto, "nutricao esportiva", "nutrição esportiva", "academia")) {
      return {
        categoria: "vitaminas-suplementos",
        subcategoria: "nutricao-esportiva",
      };
    }

    return {
      categoria: "vitaminas-suplementos",
      subcategoria: "suplementos-alimentares",
    };
  }

  if (
    contem(
      texto,
      "agulha",
      "seringa",
      "gaze",
      "atadura",
      "curativo",
      "esparadrapo",
      "micropore",
      "cateter",
      "equipo",
      "lanceta",
      "termometro",
      "termômetro",
      "aparelho de pressao",
      "aparelho de pressão",
      "cadeira de rodas",
      "coletor universal",
      "algodao hidrofilo",
      "algodão hidrófilo",
    )
  ) {
    if (contem(texto, "gaze")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "gaze",
      };
    }

    if (contem(texto, "atadura")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "ataduras",
      };
    }

    if (contem(texto, "curativo")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "curativos",
      };
    }

    if (contem(texto, "agulha")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "agulhas",
      };
    }

    if (contem(texto, "seringa")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "seringas",
      };
    }

    if (contem(texto, "lanceta")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "lancetas",
      };
    }

    if (contem(texto, "termometro", "termômetro")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "termometros",
      };
    }

    if (contem(texto, "cadeira de rodas")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "cadeiras-rodas",
      };
    }

    if (contem(texto, "cateter")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "cateteres",
      };
    }

    if (contem(texto, "equipo")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "equipos",
      };
    }

    if (contem(texto, "esparadrapo", "micropore")) {
      return {
        categoria: "saude-primeiros-socorros-hospitalar",
        subcategoria: "esparadrapos-fitas",
      };
    }

    return {
      categoria: "saude-primeiros-socorros-hospitalar",
      subcategoria: "outros-saude",
    };
  }

  if (
    contem(
      texto,
      "joelheira",
      "tornozeleira",
      "munhequeira",
      "cotoveleira",
      "cinta",
      "compressao",
      "compressão",
      "meia de compressao",
      "meia de compressão",
      "bengala",
      "ortopedico",
      "ortopédico",
    )
  ) {
    if (contem(texto, "joelheira")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "joelheiras",
      };
    }

    if (contem(texto, "tornozeleira")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "tornozeleiras",
      };
    }

    if (contem(texto, "munhequeira")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "munhequeiras",
      };
    }

    if (contem(texto, "cotoveleira")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "cotoveleiras",
      };
    }

    if (contem(texto, "meia de compressao", "meia de compressão")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "meias-compressao",
      };
    }

    if (contem(texto, "bengala")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "bengalas",
      };
    }

    if (contem(texto, "cinta")) {
      return {
        categoria: "ortopedia-cuidados-especiais",
        subcategoria: "cintas",
      };
    }

    return {
      categoria: "ortopedia-cuidados-especiais",
      subcategoria: "produtos-ortopedicos",
    };
  }

  if (
    contem(
      texto,
      "preservativo",
      "camisinha",
      "lubrificante",
      "sabonete intimo",
      "sabonete íntimo",
      "gel intimo",
      "gel íntimo",
    )
  ) {
    if (contem(texto, "preservativo", "camisinha")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "preservativos",
      };
    }

    if (contem(texto, "lubrificante")) {
      return {
        categoria: "higiene-feminina-intima",
        subcategoria: "lubrificantes",
      };
    }

    return {
      categoria: "higiene-feminina-intima",
      subcategoria: "sabonetes-intimos",
    };
  }

  if (
    contem(
      texto,
      "perfume",
      "deo colonia",
      "deo colônia",
      "colonia",
      "colônia",
      "dermocosmetico",
      "dermocosmético",
      "hidratante",
      "maquiagem",
      "base liquida",
      "base líquida",
      "batom",
      "rímel",
      "shampoo",
      "condicionador",
      "capilar",
      "cabelo",
      "barba",
      "protetor solar",
      "filtro solar",
    )
  ) {
    if (contem(texto, "perfume", "deo colonia", "deo colônia", "colonia", "colônia")) {
      if (contem(texto, "importado", "importada", "importados", "importadas")) {
        return {
          categoria: "perfumaria-cosmeticos",
          subcategoria: "perfumes-importados",
        };
      }

      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "perfumes",
      };
    }

    if (contem(texto, "protetor solar", "filtro solar")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "protetores-solares",
      };
    }

    if (contem(texto, "shampoo")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "shampoos",
      };
    }

    if (contem(texto, "condicionador")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "condicionadores",
      };
    }

    if (contem(texto, "cabelo", "capilar")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "produtos-capilares",
      };
    }

    if (contem(texto, "barba")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "barba",
      };
    }

    if (contem(texto, "maquiagem", "base", "batom", "rimel", "rímel")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "maquiagem",
      };
    }

    if (contem(texto, "dermocosmet")) {
      return {
        categoria: "perfumaria-cosmeticos",
        subcategoria: "dermocosmeticos",
      };
    }

    return {
      categoria: "perfumaria-cosmeticos",
      subcategoria: "cuidados-faciais",
    };
  }

  if (contem(texto, "creme dental", "escova dental", "enxaguante", "fio dental")) {
    return {
      categoria: "saude-bucal",
      subcategoria: "cremes-dentais",
    };
  }

  if (
    contem(
      texto,
      "sabonete",
      "desodorante",
      "antitranspirante",
      "repelente",
      "barbeador",
      "lamina de barbear",
      "lâmina de barbear",
      "alicate",
      "cuticula",
      "cutícula",
      "pente",
      "pinça",
      "pinca",
      "tesoura de unha",
    )
  ) {
    if (contem(texto, "desodorante", "antitranspirante")) {
      return {
        categoria: "higiene-pessoal",
        subcategoria: "desodorantes",
      };
    }

    if (contem(texto, "repelente")) {
      return {
        categoria: "higiene-pessoal",
        subcategoria: "repelentes",
      };
    }

    if (contem(texto, "barbeador", "lamina de barbear", "lâmina de barbear")) {
      return {
        categoria: "higiene-pessoal",
        subcategoria: "barbear",
      };
    }

    if (contem(texto, "alicate", "cuticula", "cutícula", "pente", "pinça", "pinca", "tesoura")) {
      return {
        categoria: "higiene-pessoal",
        subcategoria: "cuidados-unhas",
      };
    }

    if (contem(texto, "sabonete liquido", "sabonete líquido", "sab liquido", "sab liq")) {
      return {
        categoria: "higiene-pessoal",
        subcategoria: "sabonetes-liquidos",
      };
    }

    return {
      categoria: "higiene-pessoal",
      subcategoria: "sabonetes",
    };
  }

  if (
    contem(
      texto,
      "chocolate",
      "bala",
      "doce",
      "bombom",
      "bis",
      "wafer",
      "biscoito",
      "salgadinho",
      "chips",
      "suco",
      "agua mineral",
      "água mineral",
      "bebida",
      "adocante",
      "adoçante",
    )
  ) {
    if (contem(texto, "chocolate", "bombom", "bis", "wafer")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "chocolates",
      };
    }

    if (contem(texto, "bala", "doce")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "balas",
      };
    }

    if (contem(texto, "chips", "salgadinho")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "chips",
      };
    }

    if (contem(texto, "biscoito")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "biscoitos",
      };
    }

    if (contem(texto, "adocante", "adoçante")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "adocantes",
      };
    }

    if (contem(texto, "suco")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "sucos",
      };
    }

    if (contem(texto, "agua", "água")) {
      return {
        categoria: "conveniencia-alimentos",
        subcategoria: "aguas",
      };
    }

    return {
      categoria: "conveniencia-alimentos",
      subcategoria: "outros-alimentos",
    };
  }

  if (
    contem(
      texto,
      "eletronico",
      "eletrônico",
      "pilha",
      "carregador",
      "secador",
      "prancha",
      "baralho",
      "boneca",
      "boneco",
      "carrinho",
      "jogo ",
      "quebra-cabeca",
      "quebra-cabeça",
      "play-doh",
    )
  ) {
    if (contem(texto, "eletronico", "eletrônico", "secador", "prancha")) {
      return {
        categoria: "utilidades-acessorios-eletronicos",
        subcategoria: "eletronicos",
      };
    }

    if (contem(texto, "pilha")) {
      return {
        categoria: "utilidades-acessorios-eletronicos",
        subcategoria: "pilhas",
      };
    }

    if (
      contem(texto, "baralho", "boneca", "boneco", "carrinho", "jogo ", "quebra-cabeca", "quebra-cabeça", "play-doh")
    ) {
      return {
        categoria: "mamae-e-bebe",
        subcategoria: "brinquedos-infantis",
      };
    }

    return {
      categoria: "utilidades-acessorios-eletronicos",
      subcategoria: "produtos-diversos",
    };
  }

  if (contem(texto, "acessorio", "acessório", "utilidade")) {
    return {
      categoria: "utilidades-acessorios-eletronicos",
      subcategoria: "acessorios",
    };
  }

  if (contem(texto, "natural", "organico", "orgânico")) {
    return {
      categoria: "vitaminas-suplementos",
      subcategoria: "produtos-naturais",
    };
  }

  return {
    categoria: "perfumaria-cosmeticos",
    subcategoria: "cuidados-pessoais",
  };
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
  return produtos.filter((produto) => {
    const texto = textoDoProduto(produto);

    return (
      !categoriaFoiRemovida(produto.categoria) &&
      !contem(texto, "pet", "cachorro", "cão", "cao", "gato", "animal", "veterinario", "veterinário")
    );
  });
}

export function produtoTemImagem(produto: Produto): boolean {
  const imagem = produto.imagem?.trim().toLowerCase();

  return Boolean(imagem && !["null", "undefined", "sem imagem", "sem-imagem"].includes(imagem));
}

export function ordenarProdutosPorRelevancia(produtos: Produto[]) {
  return [...produtos].sort((a, b) => {
    const imagemA = produtoTemImagem(a) ? 1 : 0;
    const imagemB = produtoTemImagem(b) ? 1 : 0;

    if (imagemA !== imagemB) {
      return imagemB - imagemA;
    }

    const ofertaA = a.oferta ? 1 : 0;
    const ofertaB = b.oferta ? 1 : 0;

    if (ofertaA !== ofertaB) {
      return ofertaB - ofertaA;
    }

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

    if (totalA !== totalB) {
      return totalB - totalA;
    }

    return (indiceOriginal.get(a.slug) ?? 0) - (indiceOriginal.get(b.slug) ?? 0);
  });
}

export function ordenarCategoriasPorRelevancia(categorias: Categoria[], produtos: Produto[]) {
  const indiceOriginal = new Map(ESTRUTURA_CATEGORIAS_SITE.map((categoria, indice) => [categoria.slug, indice]));

  return [...categorias].sort((a, b) => {
    const totalA = produtosDaCategoriaSite(produtos, a.slug).length;

    const totalB = produtosDaCategoriaSite(produtos, b.slug).length;

    if (totalA !== totalB) {
      return totalB - totalA;
    }

    return (indiceOriginal.get(a.slug) ?? 999) - (indiceOriginal.get(b.slug) ?? 999);
  });
}

export function acharCategoria(categorias: Categoria[], slug: string) {
  return categorias.find((categoria) => categoria.slug === slug);
}

export const precoFinal = (produto: Produto) => produto.precoPromocional ?? produto.preco;

export const formatarPreco = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
