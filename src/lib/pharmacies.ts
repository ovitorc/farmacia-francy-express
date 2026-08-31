export type Unidade = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  whatsapp_url: string;
  active: boolean;
};

export const UNIDADES: Unidade[] = [
  {
    id: "ernani-satiro",
    name: "FRANCY ERNANI SÁTIRO",
    address: "R. Prof. José Holmes, 230",
    neighborhood: "Ernani Sátiro",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58080-400",
    latitude: -7.174731,
    longitude: -34.892988,
    whatsapp_url: "https://api.whatsapp.com/send?phone=5583987834315",
    active: true,
  },
  {
    id: "colinas-do-sul",
    name: "FRANCY COLINAS DO SUL",
    address: "R. Joaquim Monteiro da Franca, 307",
    neighborhood: "Gramame",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58069-000",
    latitude: -7.195695,
    longitude: -34.884844,
    whatsapp_url: "https://api.whatsapp.com/send?phone=5583987831334",
    active: true,
  },
  {
    id: "cabedelo",
    name: "FRANCY CABEDELO",
    address: "Av. Pastor José Alves de Oliveira, 259",
    neighborhood: "Vila São João",
    city: "Cabedelo",
    state: "PB",
    postal_code: "58101-082",
    latitude: -6.975414,
    longitude: -34.83152,
    whatsapp_url: "https://api.whatsapp.com/send?phone=5583987832809",
    active: true,
  },
  {
    id: "tibiri",
    name: "FRANCY TIBIRI",
    address: "Av. João Pessoa, 345",
    neighborhood: "Tibiri",
    city: "Santa Rita",
    state: "PB",
    postal_code: "58302-530",
    latitude: -7.1481081,
    longitude: -34.9671478,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583987913800&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "mag-shopping",
    name: "FRANCY MAG SHOPPING",
    address: "Av. Gov. Flávio Ribeiro Coutinho",
    neighborhood: "Manaíra",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58038-000",
    latitude: -7.0974786,
    longitude: -34.833961,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583988887475&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "cristo-1",
    name: "FRANCY CRISTO (1°)",
    address: "R. Pres. Ranieri Mazilli, 1730",
    neighborhood: "Cristo Redentor",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58071-000",
    latitude: -7.161203,
    longitude: -34.870583,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583987916273&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "geisel",
    name: "FRANCY GEISEL",
    address: "R. Arcanjo de Holanda Cavalcanti, 17",
    neighborhood: "Conjunto Rad.",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58075-430",
    latitude: -7.179708,
    longitude: -34.873528,
    whatsapp_url: "https://api.whatsapp.com/send?phone=5583988111773",
    active: true,
  },
  {
    id: "agua-fria",
    name: "FRANCY AGUA FRIA",
    address: "R. Diógenes Chianca, 1443",
    neighborhood: "Água Fria",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58053-000",
    latitude: -7.166201,
    longitude: -34.862372,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=558396780068&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "bessa",
    name: "FRANCY BESSA",
    address: "R. Francisco Leocádio Ribeiro Coutinho, 55",
    neighborhood: "Bessa",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58027-390",
    latitude: -7.084598,
    longitude: -34.840955,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583987259411&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "cristo-2",
    name: "FRANCY CRISTO (2°)",
    address: "R. Pres. Nereu Ramos",
    neighborhood: "Cristo Redentor",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58070-440",
    latitude: -7.1593848,
    longitude: -34.8757328,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583998060012&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "valentina",
    name: "FRANCY VALENTINA",
    address: "R. Mariangela Lucena Peixoto",
    neighborhood: "Valentina de Figueiredo",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58063-300",
    latitude: -7.2013525,
    longitude: -34.8485708,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583996190016&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "torre",
    name: "FRANCY TORRE",
    address: "Av. Min. José Américo de Almeida, 1378",
    neighborhood: "Torre",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58040-300",
    latitude: -7.129337,
    longitude: -34.858177,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583998710665&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "tambau",
    name: "FRANCY TAMBAÚ",
    address: "Av. Sen. Ruy Carneiro, 215",
    neighborhood: "Tambaú",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58039-181",
    latitude: -7.110886,
    longitude: -34.825182,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=558396780032&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "intermares",
    name: "FRANCY INTERMARES",
    address: "Av. Mar Vermelho, 128",
    neighborhood: "Intermares",
    city: "Cabedelo",
    state: "PB",
    postal_code: "58102-110",
    latitude: -7.044657,
    longitude: -34.842693,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=558321823700&text&type=phone_number&app_absent=0",
    active: true,
  },
  {
    id: "miramar",
    name: "FRANCY MIRAMAR",
    address: "R. José Liberato, 204",
    neighborhood: "Miramar",
    city: "João Pessoa",
    state: "PB",
    postal_code: "58043-100",
    latitude: -7.12233,
    longitude: -34.836876,
    whatsapp_url:
      "https://api.whatsapp.com/send/?phone=5583996780021&text&type=phone_number&app_absent=0",
    active: true,
  },
];

export const UNIDADES_ATIVAS = UNIDADES.filter((u) => u.active);

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function unidadeMaisProxima(lat: number, lon: number) {
  let melhor: { unidade: Unidade; distancia: number } | null = null;
  for (const unidade of UNIDADES_ATIVAS) {
    const distancia = distanciaKm(lat, lon, unidade.latitude, unidade.longitude);
    if (!melhor || distancia < melhor.distancia) melhor = { unidade, distancia };
  }
  return melhor;
}

export function enderecoUnidade(u: Unidade) {
  return `${u.address} — ${u.neighborhood}, ${u.city}/${u.state}`;
}

export function formatarDistancia(km: number) {
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/** Acrescenta o texto ao link do WhatsApp preservando os parâmetros existentes. */
export function linkWhatsAppComTexto(whatsappUrl: string, texto: string) {
  const url = new URL(whatsappUrl);
  url.searchParams.set("text", texto);
  return url.toString();
}

export const FORMAS_PAGAMENTO = [
  { id: "cash", titulo: "Dinheiro", descricao: "Pagamento em dinheiro", rotulo: "Dinheiro" },
  { id: "debit_machine", titulo: "Débito", descricao: "Maquineta", rotulo: "Débito — Maquineta" },
  { id: "credit_machine", titulo: "Crédito", descricao: "Maquineta", rotulo: "Crédito — Maquineta" },
  { id: "pix_machine", titulo: "Pix", descricao: "Maquineta", rotulo: "Pix — Maquineta" },
  { id: "pix_link", titulo: "Pix", descricao: "Via link", rotulo: "Pix — Via link" },
  { id: "credit_link", titulo: "Crédito", descricao: "Via link", rotulo: "Crédito — Via link" },
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]["id"];

export function rotuloPagamento(id: FormaPagamento) {
  return FORMAS_PAGAMENTO.find((f) => f.id === id)?.rotulo ?? "";
}
