import { UNIDADES_ATIVAS, distanciaKm, type Unidade } from "@/lib/pharmacies";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type EnderecoConsulta = {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export type ResultadoUnidade = {
  unidadeId: string;
  distanciaKm: number;
  duracaoMin: number | null;
  origem: "rota" | "linha-reta";
  aviso: string | null;
};

type Coordenadas = {
  lat: number;
  lon: number;
};

type ComponenteEnderecoGoogle = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type ResultadoGeocodingGoogle = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: number;
      lng: number;
    };
  };
  address_components?: ComponenteEnderecoGoogle[];
  types?: string[];
};

type RespostaGeocodingGoogle = {
  status?: string;
  results?: ResultadoGeocodingGoogle[];
};

const cache = new Map<string, ResultadoUnidade>();

const CACHE_MAX = 500;

function normalizarTexto(valor: string) {
  return valor
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

function normalizarCep(valor: string) {
  return somenteDigitos(valor).slice(0, 8);
}

export function chaveCache(e: EnderecoConsulta) {
  return [
    normalizarCep(e.cep),
    normalizarTexto(e.rua),
    normalizarTexto(e.numero),
    normalizarTexto(e.bairro),
    normalizarTexto(e.cidade),
    normalizarTexto(e.estado),
  ].join("|");
}

function guardarCache(chave: string, valor: ResultadoUnidade) {
  if (cache.size >= CACHE_MAX) {
    const primeira = cache.keys().next().value;

    if (primeira) {
      cache.delete(primeira);
    }
  }

  cache.set(chave, valor);
}

export function lerCache(chave: string) {
  return cache.get(chave) ?? null;
}

function credenciais() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];

  if (!lovableKey || !mapsKey) {
    return null;
  }

  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  } as Record<string, string>;
}

/*
 * Monta o endereço mais completo possível.
 *
 * A cidade NÃO fica limitada a João Pessoa.
 * O endereço informado pelo cliente é respeitado,
 * permitindo Santa Rita, Cabedelo e outras localidades.
 */
function enderecoCompleto(e: EnderecoConsulta) {
  const partes = [
    [e.rua.trim(), e.numero.trim()].filter(Boolean).join(", "),

    e.bairro.trim(),

    e.cidade.trim(),

    e.estado.trim(),

    normalizarCep(e.cep),

    "Brasil",
  ].filter(Boolean);

  return partes.join(", ");
}

/*
 * Busca alternativa priorizando o CEP.
 *
 * O CEP é uma das informações mais confiáveis
 * para localizar corretamente o município e a região.
 */
function enderecoPorCep(e: EnderecoConsulta) {
  const cep = normalizarCep(e.cep);

  if (!cep) {
    return "";
  }

  const partes = [
    cep,

    [e.rua.trim(), e.numero.trim()].filter(Boolean).join(", "),

    e.bairro.trim(),

    e.cidade.trim(),

    e.estado.trim(),

    "Brasil",
  ].filter(Boolean);

  return partes.join(", ");
}

function valorComponente(componentes: ComponenteEnderecoGoogle[] | undefined, tipos: string[]) {
  if (!componentes) {
    return "";
  }

  const componente = componentes.find((item) => tipos.some((tipo) => item.types?.includes(tipo)));

  return componente?.long_name || componente?.short_name || "";
}

function resultadoTemCidade(resultado: ResultadoGeocodingGoogle, cidade: string) {
  const cidadeNormalizada = normalizarTexto(cidade);

  if (!cidadeNormalizada) {
    return true;
  }

  const cidadeGoogle = valorComponente(resultado.address_components, [
    "locality",
    "administrative_area_level_2",
    "sublocality",
    "sublocality_level_1",
  ]);

  const cidadeGoogleNormalizada = normalizarTexto(cidadeGoogle);

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  return (
    cidadeGoogleNormalizada === cidadeNormalizada ||
    cidadeGoogleNormalizada.includes(cidadeNormalizada) ||
    cidadeNormalizada.includes(cidadeGoogleNormalizada) ||
    enderecoFormatado.includes(cidadeNormalizada)
  );
}

function resultadoTemEstado(resultado: ResultadoGeocodingGoogle, estado: string) {
  const estadoNormalizado = normalizarTexto(estado);

  if (!estadoNormalizado) {
    return true;
  }

  const estadoGoogle = valorComponente(resultado.address_components, ["administrative_area_level_1"]);

  const estadoGoogleNormalizado = normalizarTexto(estadoGoogle);

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  return (
    estadoGoogleNormalizado === estadoNormalizado ||
    estadoGoogleNormalizado.includes(estadoNormalizado) ||
    enderecoFormatado.includes(estadoNormalizado)
  );
}

/*
 * Calcula uma pontuação para cada resultado
 * retornado pelo Google Maps.
 *
 * Não utilizamos simplesmente results[0].
 *
 * O resultado que mais corresponde aos dados
 * fornecidos pelo cliente recebe maior prioridade.
 */
function pontuarResultado(resultado: ResultadoGeocodingGoogle, endereco: EnderecoConsulta) {
  let pontos = 0;

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  const cidade = normalizarTexto(endereco.cidade);

  const bairro = normalizarTexto(endereco.bairro);

  const rua = normalizarTexto(endereco.rua);

  const numero = normalizarTexto(endereco.numero);

  const cep = normalizarCep(endereco.cep);

  if (resultadoTemCidade(resultado, endereco.cidade)) {
    pontos += 40;
  }

  if (resultadoTemEstado(resultado, endereco.estado)) {
    pontos += 25;
  }

  if (cidade && enderecoFormatado.includes(cidade)) {
    pontos += 15;
  }

  if (bairro && enderecoFormatado.includes(bairro)) {
    pontos += 15;
  }

  if (rua && enderecoFormatado.includes(rua)) {
    pontos += 20;
  }

  if (numero && enderecoFormatado.includes(numero)) {
    pontos += 10;
  }

  /*
   * O CEP pode aparecer no endereço formatado
   * dependendo da resposta do Google.
   */
  if (cep && enderecoFormatado.replace(/\D/g, "").includes(cep)) {
    pontos += 50;
  }

  /*
   * Resultados do tipo endereço completo
   * são preferíveis a resultados genéricos
   * de cidade ou região.
   */
  if (resultado.types?.includes("street_address")) {
    pontos += 25;
  }

  if (resultado.types?.includes("premise")) {
    pontos += 20;
  }

  if (resultado.types?.includes("subpremise")) {
    pontos += 15;
  }

  if (resultado.types?.includes("route")) {
    pontos += 10;
  }

  return pontos;
}

function selecionarMelhorResultado(resultados: ResultadoGeocodingGoogle[], endereco: EnderecoConsulta) {
  const resultadosComCoordenadas = resultados.filter(
    (resultado) =>
      typeof resultado.geometry?.location?.lat === "number" && typeof resultado.geometry?.location?.lng === "number",
  );

  if (resultadosComCoordenadas.length === 0) {
    return null;
  }

  const candidatos = resultadosComCoordenadas
    .map((resultado) => ({
      resultado,
      pontos: pontuarResultado(resultado, endereco),
    }))
    .sort((a, b) => b.pontos - a.pontos);

  /*
   * Preferimos um resultado compatível
   * com cidade e estado informados.
   */
  const compativel = candidatos.find(
    ({ resultado }) => resultadoTemCidade(resultado, endereco.cidade) && resultadoTemEstado(resultado, endereco.estado),
  );

  return compativel?.resultado || candidatos[0]?.resultado || null;
}

async function consultarGoogleGeocoding(endereco: string, headers: Record<string, string>) {
  if (!endereco.trim()) {
    return [];
  }

  const url =
    `${GATEWAY_URL}/maps/api/geocode/json` +
    `?region=br` +
    `&components=country:BR` +
    `&address=${encodeURIComponent(endereco)}`;

  const resp = await fetch(url, {
    headers,
  });

  if (!resp.ok) {
    console.error(`Geocoding falhou [${resp.status}]: ${await resp.text()}`);

    return [];
  }

  const dados = (await resp.json()) as RespostaGeocodingGoogle;

  if (dados.status !== "OK" || !Array.isArray(dados.results)) {
    return [];
  }

  return dados.results;
}

/*
 * Geocodifica o endereço do cliente.
 *
 * Estratégia:
 *
 * 1. Tenta o endereço completo.
 * 2. Tenta novamente priorizando o CEP.
 * 3. Junta os resultados.
 * 4. Seleciona o resultado mais compatível.
 *
 * Isso evita depender simplesmente do
 * primeiro resultado retornado pelo Google.
 */
async function geocodificar(endereco: EnderecoConsulta, headers: Record<string, string>): Promise<Coordenadas | null> {
  const textoCompleto = enderecoCompleto(endereco);

  const textoCep = enderecoPorCep(endereco);

  const resultadosCompletos = await consultarGoogleGeocoding(textoCompleto, headers);

  let todosResultados = [...resultadosCompletos];

  /*
   * Caso o endereço completo não encontre
   * um resultado confiável, tentamos
   * uma busca priorizando o CEP.
   */
  const melhorInicial = selecionarMelhorResultado(todosResultados, endereco);

  const precisaTentarCep =
    !melhorInicial ||
    !resultadoTemCidade(melhorInicial, endereco.cidade) ||
    !resultadoTemEstado(melhorInicial, endereco.estado);

  if (precisaTentarCep && textoCep && textoCep !== textoCompleto) {
    const resultadosCep = await consultarGoogleGeocoding(textoCep, headers);

    todosResultados = [...todosResultados, ...resultadosCep];
  }

  const melhorResultado = selecionarMelhorResultado(todosResultados, endereco);

  const localizacao = melhorResultado?.geometry?.location;

  if (!localizacao || typeof localizacao.lat !== "number" || typeof localizacao.lng !== "number") {
    console.error("Não foi possível encontrar coordenadas para o endereço:", textoCompleto);

    return null;
  }

  return {
    lat: localizacao.lat,
    lon: localizacao.lng,
  };
}

async function matrizDeRotas(
  origem: Coordenadas,
  destinos: Unidade[],
  headers: Record<string, string>,
): Promise<Array<{
  indice: number;
  metros: number;
  segundos: number | null;
}> | null> {
  const resp = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
    method: "POST",

    headers: {
      ...headers,

      "Content-Type": "application/json",

      "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition,status",
    },

    body: JSON.stringify({
      origins: [
        {
          waypoint: {
            location: {
              latLng: {
                latitude: origem.lat,

                longitude: origem.lon,
              },
            },
          },
        },
      ],

      destinations: destinos.map((u) => ({
        waypoint: {
          location: {
            latLng: {
              latitude: u.latitude,

              longitude: u.longitude,
            },
          },
        },
      })),

      travelMode: "DRIVE",

      routingPreference: "TRAFFIC_AWARE",
    }),
  });

  if (!resp.ok) {
    console.error(`Route matrix falhou [${resp.status}]: ${await resp.text()}`);

    return null;
  }

  const dados = (await resp.json()) as Array<{
    destinationIndex?: number;
    distanceMeters?: number;
    duration?: string;
    condition?: string;
  }>;

  if (!Array.isArray(dados)) {
    return null;
  }

  const linhas = dados
    .filter(
      (d) =>
        typeof d.destinationIndex === "number" &&
        typeof d.distanceMeters === "number" &&
        d.condition !== "ROUTE_NOT_FOUND",
    )
    .map((d) => ({
      indice: d.destinationIndex as number,

      metros: d.distanceMeters as number,

      segundos: d.duration ? Number(String(d.duration).replace("s", "")) : null,
    }))
    .filter((linha) => Number.isFinite(linha.metros) && linha.metros >= 0);

  return linhas.length > 0 ? linhas : null;
}

function maisProximaLinhaReta(origem: Coordenadas, aviso: string | null): ResultadoUnidade | null {
  let melhor: ResultadoUnidade | null = null;

  for (const unidade of UNIDADES_ATIVAS) {
    const distancia = distanciaKm(origem.lat, origem.lon, unidade.latitude, unidade.longitude);

    if (!Number.isFinite(distancia)) {
      continue;
    }

    if (!melhor || distancia < melhor.distanciaKm) {
      melhor = {
        unidadeId: unidade.id,

        distanciaKm: distancia,

        duracaoMin: null,

        origem: "linha-reta",

        aviso,
      };
    }
  }

  return melhor;
}

/*
 * Resolve qual unidade ativa da Farmácia Francy
 * possui a rota mais próxima do endereço informado.
 *
 * O cálculo é feito para TODAS as unidades ativas.
 *
 * Não existe limitação por município.
 *
 * Portanto, endereços de:
 *
 * - João Pessoa
 * - Santa Rita
 * - Tibiri
 * - Cabedelo
 *
 * são processados normalmente pelo Google Maps,
 * desde que o endereço informado seja válido.
 */
export async function resolverUnidadeMaisProxima(endereco: EnderecoConsulta): Promise<ResultadoUnidade | null> {
  const chave = chaveCache(endereco);

  const emCache = lerCache(chave);

  if (emCache) {
    return emCache;
  }

  const headers = credenciais();

  if (!headers) {
    console.error("Credenciais do Google Maps ausentes.");

    return null;
  }

  /*
   * Localiza o endereço real do cliente.
   */
  const origem = await geocodificar(endereco, headers);

  if (!origem) {
    return null;
  }

  /*
   * Busca somente unidades ativas.
   *
   * Proteção adicional caso a lista
   * contenha alguma unidade desativada.
   */
  const unidadesAtivas = UNIDADES_ATIVAS.filter((unidade) => unidade.active);

  if (unidadesAtivas.length === 0) {
    console.error("Não existem unidades Francy ativas para calcular a rota.");

    return null;
  }

  /*
   * Calcula a rota do endereço do cliente
   * para TODAS as unidades ativas.
   */
  const linhas = await matrizDeRotas(origem, unidadesAtivas, headers);

  let resultado: ResultadoUnidade | null = null;

  if (linhas) {
    const melhor = linhas.reduce((atual, candidato) => (candidato.metros < atual.metros ? candidato : atual));

    const unidade = unidadesAtivas[melhor.indice];

    if (unidade) {
      resultado = {
        unidadeId: unidade.id,

        distanciaKm: melhor.metros / 1000,

        duracaoMin: melhor.segundos !== null ? Math.max(1, Math.round(melhor.segundos / 60)) : null,

        origem: "rota",

        aviso: null,
      };
    }
  }

  /*
   * Caso o Google Routes não consiga
   * calcular a rota, utilizamos a
   * distância geográfica como fallback.
   */
  if (!resultado) {
    resultado = maisProximaLinhaReta(
      origem,
      "Não foi possível calcular a rota pelo Google Maps. Utilizamos a distância aproximada em linha reta.",
    );
  }

  if (resultado) {
    guardarCache(chave, resultado);
  }

  return resultado;
}
