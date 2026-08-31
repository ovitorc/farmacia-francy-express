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
      lat?: number;
      lng?: number;
    };
  };

  address_components?: ComponenteEnderecoGoogle[];

  types?: string[];
};

type RespostaGeocodingGoogle = {
  status?: string;
  error_message?: string;
  results?: ResultadoGeocodingGoogle[];
};

type ResultadoRota = {
  indice: number;
  metros: number;
  segundos: number | null;
};

const cache = new Map<string, ResultadoUnidade>();

const CACHE_MAX = 500;

/* =========================================================
   NORMALIZAÇÃO
========================================================= */

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

/* =========================================================
   CACHE
========================================================= */

export function chaveCache(endereco: EnderecoConsulta) {
  return [
    normalizarCep(endereco.cep),
    normalizarTexto(endereco.rua),
    normalizarTexto(endereco.numero),
    normalizarTexto(endereco.bairro),
    normalizarTexto(endereco.cidade),
    normalizarTexto(endereco.estado),
  ].join("|");
}

export function lerCache(chave: string) {
  return cache.get(chave) ?? null;
}

function guardarCache(chave: string, resultado: ResultadoUnidade) {
  if (cache.size >= CACHE_MAX) {
    const primeiraChave = cache.keys().next().value;

    if (primeiraChave) {
      cache.delete(primeiraChave);
    }
  }

  cache.set(chave, resultado);
}

/* =========================================================
   CREDENCIAIS
========================================================= */

function credenciais(): Record<string, string> | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];

  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];

  if (!lovableKey && !mapsKey) {
    console.error("[GEO] Nenhuma credencial do Google Maps/Lovable foi encontrada.");

    return null;
  }

  const headers: Record<string, string> = {};

  if (lovableKey) {
    headers.Authorization = `Bearer ${lovableKey}`;
  }

  if (mapsKey) {
    headers["X-Connection-Api-Key"] = mapsKey;
  }

  return headers;
}

/* =========================================================
   MONTAGEM DO ENDEREÇO
========================================================= */

/*
 * Endereço completo.
 *
 * Não existe limitação para João Pessoa.
 *
 * Pode funcionar com:
 *
 * João Pessoa
 * Santa Rita
 * Tibiri
 * Cabedelo
 *
 * e demais cidades brasileiras.
 */
function montarEnderecoCompleto(endereco: EnderecoConsulta) {
  const ruaNumero = [endereco.rua.trim(), endereco.numero.trim()].filter(Boolean).join(", ");

  const partes = [
    ruaNumero,
    endereco.bairro.trim(),
    endereco.cidade.trim(),
    endereco.estado.trim(),
    normalizarCep(endereco.cep),
    "Brasil",
  ].filter(Boolean);

  return partes.join(", ");
}

/*
 * Consulta alternativa priorizando CEP.
 */
function montarEnderecoComCep(endereco: EnderecoConsulta) {
  const cep = normalizarCep(endereco.cep);

  if (!cep) {
    return "";
  }

  const partes = [
    cep,
    endereco.rua.trim(),
    endereco.numero.trim(),
    endereco.bairro.trim(),
    endereco.cidade.trim(),
    endereco.estado.trim(),
    "Brasil",
  ].filter(Boolean);

  return partes.join(", ");
}

/*
 * Consulta alternativa simplificada.
 *
 * Útil quando existem divergências no nome
 * do bairro ou no preenchimento do CEP.
 */
function montarEnderecoSimplificado(endereco: EnderecoConsulta) {
  const ruaNumero = [endereco.rua.trim(), endereco.numero.trim()].filter(Boolean).join(", ");

  const partes = [ruaNumero, endereco.cidade.trim(), endereco.estado.trim(), "Brasil"].filter(Boolean);

  return partes.join(", ");
}

/* =========================================================
   COMPONENTES DO GOOGLE
========================================================= */

function obterComponente(componentes: ComponenteEnderecoGoogle[] | undefined, tipos: string[]) {
  if (!componentes) {
    return "";
  }

  const componente = componentes.find((item) => tipos.some((tipo) => item.types?.includes(tipo)));

  return componente?.long_name || componente?.short_name || "";
}

/* =========================================================
   VALIDAÇÃO DE CIDADE
========================================================= */

function resultadoCorrespondeCidade(resultado: ResultadoGeocodingGoogle, cidadeInformada: string) {
  const cidade = normalizarTexto(cidadeInformada);

  if (!cidade) {
    return true;
  }

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  const candidatos = [
    obterComponente(resultado.address_components, ["locality"]),

    obterComponente(resultado.address_components, ["administrative_area_level_2"]),

    obterComponente(resultado.address_components, ["sublocality"]),

    obterComponente(resultado.address_components, ["sublocality_level_1"]),
  ]
    .filter(Boolean)
    .map(normalizarTexto);

  return (
    candidatos.some((valor) => valor === cidade || valor.includes(cidade) || cidade.includes(valor)) ||
    enderecoFormatado.includes(cidade)
  );
}

/* =========================================================
   VALIDAÇÃO DE ESTADO
========================================================= */

function resultadoCorrespondeEstado(resultado: ResultadoGeocodingGoogle, estadoInformado: string) {
  const estado = normalizarTexto(estadoInformado);

  if (!estado) {
    return true;
  }

  const estadoGoogle = normalizarTexto(obterComponente(resultado.address_components, ["administrative_area_level_1"]));

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  const compativel = estadoGoogle === estado || estadoGoogle.includes(estado) || enderecoFormatado.includes(estado);

  /*
   * Tratamento específico para PB / Paraíba.
   */
  if (estado === "pb") {
    return compativel || estadoGoogle.includes("paraiba") || enderecoFormatado.includes("paraiba");
  }

  return compativel;
}

/* =========================================================
   PONTUAÇÃO DO RESULTADO
========================================================= */

function pontuarResultado(resultado: ResultadoGeocodingGoogle, endereco: EnderecoConsulta) {
  let pontos = 0;

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  const rua = normalizarTexto(endereco.rua);

  const numero = normalizarTexto(endereco.numero);

  const bairro = normalizarTexto(endereco.bairro);

  const cidade = normalizarTexto(endereco.cidade);

  const cep = normalizarCep(endereco.cep);

  /*
   * Cidade.
   */
  if (resultadoCorrespondeCidade(resultado, endereco.cidade)) {
    pontos += 50;
  }

  /*
   * Estado.
   */
  if (resultadoCorrespondeEstado(resultado, endereco.estado)) {
    pontos += 30;
  }

  /*
   * Rua.
   */
  if (rua && enderecoFormatado.includes(rua)) {
    pontos += 40;
  }

  /*
   * Número.
   */
  if (numero && enderecoFormatado.includes(numero)) {
    pontos += 25;
  }

  /*
   * Bairro.
   */
  if (bairro && enderecoFormatado.includes(bairro)) {
    pontos += 20;
  }

  /*
   * Cidade escrita no endereço.
   */
  if (cidade && enderecoFormatado.includes(cidade)) {
    pontos += 15;
  }

  /*
   * CEP.
   */
  if (cep && enderecoFormatado.replace(/\D/g, "").includes(cep)) {
    pontos += 60;
  }

  /*
   * Preferência por resultados mais específicos.
   */
  if (resultado.types?.includes("street_address")) {
    pontos += 40;
  }

  if (resultado.types?.includes("premise")) {
    pontos += 30;
  }

  if (resultado.types?.includes("subpremise")) {
    pontos += 25;
  }

  if (resultado.types?.includes("route")) {
    pontos += 15;
  }

  return pontos;
}

/* =========================================================
   ESCOLHER MELHOR RESULTADO DO GEOCODING
========================================================= */

function selecionarMelhorResultado(resultados: ResultadoGeocodingGoogle[], endereco: EnderecoConsulta) {
  const validos = resultados.filter((resultado) => {
    const lat = resultado.geometry?.location?.lat;

    const lng = resultado.geometry?.location?.lng;

    return typeof lat === "number" && typeof lng === "number";
  });

  if (validos.length === 0) {
    return null;
  }

  const candidatos = validos
    .map((resultado) => ({
      resultado,
      pontos: pontuarResultado(resultado, endereco),
    }))
    .sort((a, b) => b.pontos - a.pontos);

  /*
   * Primeiro tentamos pegar um resultado
   * compatível com cidade e estado.
   */
  const compativel = candidatos.find(
    ({ resultado }) =>
      resultadoCorrespondeCidade(resultado, endereco.cidade) && resultadoCorrespondeEstado(resultado, endereco.estado),
  );

  return compativel?.resultado || candidatos[0]?.resultado || null;
}

/* =========================================================
   CONSULTA GOOGLE GEOCODING
========================================================= */

async function consultarGoogleGeocoding(endereco: string, headers: Record<string, string>) {
  if (!endereco.trim()) {
    return [];
  }

  const url =
    `${GATEWAY_URL}/maps/api/geocode/json` +
    `?address=${encodeURIComponent(endereco)}` +
    `&region=br` +
    `&components=country:BR`;

  try {
    const resposta = await fetch(url, {
      headers,
    });

    if (!resposta.ok) {
      const texto = await resposta.text();

      console.error(`[GEO] Google Geocoding falhou (${resposta.status}):`, texto);

      return [];
    }

    const dados = (await resposta.json()) as RespostaGeocodingGoogle;

    if (dados.status !== "OK" || !Array.isArray(dados.results)) {
      console.error("[GEO] Google não encontrou o endereço:", {
        endereco,
        status: dados.status,
        erro: dados.error_message,
      });

      return [];
    }

    return dados.results;
  } catch (erro) {
    console.error("[GEO] Erro ao consultar Google Geocoding:", erro);

    return [];
  }
}

/* =========================================================
   GEOCODIFICAR ENDEREÇO DO CLIENTE
========================================================= */

async function geocodificarEndereco(
  endereco: EnderecoConsulta,
  headers: Record<string, string>,
): Promise<Coordenadas | null> {
  const consultas = [
    montarEnderecoCompleto(endereco),

    montarEnderecoComCep(endereco),

    montarEnderecoSimplificado(endereco),
  ]
    .filter(Boolean)
    .filter((valor, indice, array) => array.indexOf(valor) === indice);

  let resultados: ResultadoGeocodingGoogle[] = [];

  /*
   * Testamos todas as formas de consulta.
   */
  for (const consulta of consultas) {
    const encontrados = await consultarGoogleGeocoding(consulta, headers);

    resultados.push(...encontrados);
  }

  /*
   * Remove resultados duplicados.
   */
  const unicos = resultados.filter((resultado, indice, array) => {
    const lat = resultado.geometry?.location?.lat;

    const lng = resultado.geometry?.location?.lng;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return false;
    }

    return (
      array.findIndex((item) => {
        const itemLat = item.geometry?.location?.lat;

        const itemLng = item.geometry?.location?.lng;

        return itemLat === lat && itemLng === lng;
      }) === indice
    );
  });

  const melhorResultado = selecionarMelhorResultado(unicos, endereco);

  const localizacao = melhorResultado?.geometry?.location;

  if (!localizacao || typeof localizacao.lat !== "number" || typeof localizacao.lng !== "number") {
    console.error("[GEO] Não foi possível transformar o endereço em coordenadas.", {
      endereco,
      consultasTentadas: consultas,
    });

    return null;
  }

  console.log("[GEO] Endereço localizado pelo Google:", {
    enderecoInformado: endereco,

    enderecoGoogle: melhorResultado.formatted_address,

    latitude: localizacao.lat,

    longitude: localizacao.lng,
  });

  return {
    lat: localizacao.lat,

    lon: localizacao.lng,
  };
}

/* =========================================================
   CONVERTER DURAÇÃO
========================================================= */

function converterDuracaoParaSegundos(duracao?: string) {
  if (!duracao) {
    return null;
  }

  /*
   * Exemplo retornado pelo Google:
   *
   * "240s"
   */
  const segundos = Number(String(duracao).replace("s", ""));

  return Number.isFinite(segundos) ? segundos : null;
}

/* =========================================================
   GOOGLE ROUTE MATRIX
========================================================= */

/*
 * Calcula a rota REAL de carro entre:
 *
 * ENDEREÇO DO CLIENTE
 *
 * e
 *
 * TODAS AS UNIDADES DA FARMÁCIA FRANCY.
 *
 * A distância retornada pelo Google é
 * utilizada diretamente.
 */
async function calcularMatrizDeRotas(
  origem: Coordenadas,
  destinos: Unidade[],
  headers: Record<string, string>,
): Promise<ResultadoRota[] | null> {
  if (destinos.length === 0) {
    return null;
  }

  try {
    const resposta = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
      method: "POST",

      headers: {
        ...headers,

        "Content-Type": "application/json",

        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,staticDuration,condition,status",
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

        destinations: destinos.map((unidade) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: unidade.latitude,

                longitude: unidade.longitude,
              },
            },
          },
        })),

        /*
         * ROTA DE CARRO.
         */
        travelMode: "DRIVE",

        /*
         * Preferência padrão de rota.
         *
         * O tempo de trânsito pode variar,
         * mas a distância retornada continua
         * sendo usada como critério principal.
         */
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();

      console.error(`[GEO] Google Routes falhou (${resposta.status}):`, texto);

      return null;
    }

    const dados = (await resposta.json()) as unknown;

    if (!Array.isArray(dados)) {
      console.error("[GEO] Formato inesperado do Google Routes:", dados);

      return null;
    }

    const rotas = dados
      .filter(
        (
          item,
        ): item is {
          destinationIndex?: number;
          distanceMeters?: number;
          duration?: string;
          staticDuration?: string;
          condition?: string;
        } => typeof item === "object" && item !== null,
      )
      .filter(
        (item) =>
          typeof item.destinationIndex === "number" &&
          typeof item.distanceMeters === "number" &&
          item.condition !== "ROUTE_NOT_FOUND",
      )
      .map((item) => ({
        indice: item.destinationIndex as number,

        metros: item.distanceMeters as number,

        /*
         * Usamos duration quando disponível.
         *
         * staticDuration fica como alternativa.
         */
        segundos: converterDuracaoParaSegundos(item.duration || item.staticDuration),
      }))
      .filter((rota) => Number.isFinite(rota.metros) && rota.metros >= 0);

    if (rotas.length === 0) {
      console.error("[GEO] Nenhuma rota válida foi retornada.");

      return null;
    }

    console.log("[GEO] Rotas reais retornadas pelo Google:", rotas);

    return rotas;
  } catch (erro) {
    console.error("[GEO] Erro ao calcular rotas:", erro);

    return null;
  }
}

/* =========================================================
   ESCOLHER A UNIDADE MAIS PRÓXIMA
========================================================= */

/*
 * ESTA É A PARTE MAIS IMPORTANTE.
 *
 * PRIORIDADE:
 *
 * 1. MENOR DISTÂNCIA REAL DA ROTA
 *
 * 2. MENOR TEMPO APENAS EM CASO DE EMPATE
 *
 * Portanto:
 *
 * NÃO escolhemos mais pela rota mais rápida.
 *
 * Escolhemos pela unidade realmente mais próxima
 * utilizando os metros retornados pelo
 * Google Routes.
 */
function escolherMelhorRota(rotas: ResultadoRota[]) {
  return [...rotas].sort((a, b) => {
    /*
     * PRIMEIRO CRITÉRIO:
     *
     * MENOR DISTÂNCIA.
     */
    if (a.metros !== b.metros) {
      return a.metros - b.metros;
    }

    /*
     * SEGUNDO CRITÉRIO:
     *
     * MENOR TEMPO.
     */
    if (a.segundos !== null && b.segundos !== null) {
      return a.segundos - b.segundos;
    }

    if (a.segundos !== null && b.segundos === null) {
      return -1;
    }

    if (a.segundos === null && b.segundos !== null) {
      return 1;
    }

    return 0;
  })[0];
}

/* =========================================================
   FALLBACK: LINHA RETA
========================================================= */

/*
 * Só é utilizado se o Google Routes
 * não retornar nenhuma rota.
 */
function calcularMaisProximaLinhaReta(origem: Coordenadas): ResultadoUnidade | null {
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

        aviso: "Não foi possível calcular a rota pelo Google Maps. Utilizamos a distância aproximada em linha reta.",
      };
    }
  }

  return melhor;
}

/* =========================================================
   FUNÇÃO PRINCIPAL
========================================================= */

/*
 * FLUXO:
 *
 * CLIENTE INFORMA ENDEREÇO
 *
 *          ↓
 *
 * GOOGLE GEOCODING
 *
 *          ↓
 *
 * LOCALIZAÇÃO EXATA DO CLIENTE
 *
 *          ↓
 *
 * GOOGLE ROUTE MATRIX
 *
 *          ↓
 *
 * CALCULA TODAS AS UNIDADES FRANCY
 *
 *          ↓
 *
 * MENOR DISTÂNCIA REAL DE CARRO
 *
 *          ↓
 *
 * EM EMPATE:
 * MENOR TEMPO
 *
 *          ↓
 *
 * ESCOLHE A UNIDADE
 *
 *          ↓
 *
 * SISTEMA UTILIZA O WHATSAPP
 * DA UNIDADE CORRETA
 */
export async function resolverUnidadeMaisProxima(endereco: EnderecoConsulta): Promise<ResultadoUnidade | null> {
  const chave = chaveCache(endereco);

  /*
   * CACHE.
   */
  const resultadoCache = lerCache(chave);

  if (resultadoCache) {
    console.log("[GEO] Resultado encontrado no cache:", resultadoCache);

    return resultadoCache;
  }

  /*
   * CREDENCIAIS.
   */
  const headers = credenciais();

  if (!headers) {
    return null;
  }

  /*
   * TODAS AS UNIDADES ATIVAS.
   *
   * Não existe filtro por cidade.
   *
   * Portanto são comparadas unidades de:
   *
   * João Pessoa
   * Santa Rita / Tibiri
   * Cabedelo
   */
  const unidades = [...UNIDADES_ATIVAS];

  if (unidades.length === 0) {
    console.error("[GEO] Nenhuma unidade Francy está disponível.");

    return null;
  }

  /*
   * 1.
   *
   * LOCALIZA O ENDEREÇO DO CLIENTE.
   */
  const origem = await geocodificarEndereco(endereco, headers);

  if (!origem) {
    console.error("[GEO] Não foi possível localizar o endereço:", endereco);

    return null;
  }

  /*
   * 2.
   *
   * CALCULA A ROTA REAL PARA
   * TODAS AS UNIDADES.
   */
  const rotas = await calcularMatrizDeRotas(origem, unidades, headers);

  let resultado: ResultadoUnidade | null = null;

  /*
   * 3.
   *
   * ESCOLHE A MENOR DISTÂNCIA REAL.
   */
  if (rotas && rotas.length > 0) {
    const melhorRota = escolherMelhorRota(rotas);

    const unidade = unidades[melhorRota.indice];

    if (unidade) {
      resultado = {
        unidadeId: unidade.id,

        /*
         * Distância REAL retornada
         * pelo Google Routes.
         */
        distanciaKm: melhorRota.metros / 1000,

        duracaoMin: melhorRota.segundos !== null ? Math.max(1, Math.round(melhorRota.segundos / 60)) : null,

        origem: "rota",

        aviso: null,
      };

      console.log("[GEO] UNIDADE MAIS PRÓXIMA ENCONTRADA:", {
        unidade: unidade.name,

        enderecoCliente: endereco,

        distanciaMetros: melhorRota.metros,

        distanciaKm: resultado.distanciaKm,

        duracaoMin: resultado.duracaoMin,

        criterio: "MENOR DISTÂNCIA REAL DE CARRO",
      });
    }
  }

  /*
   * 4.
   *
   * FALLBACK.
   *
   * Só acontece se o Google Routes
   * falhar completamente.
   */
  if (!resultado) {
    console.warn("[GEO] Google Routes não retornou rota. Utilizando linha reta.");

    resultado = calcularMaisProximaLinhaReta(origem);
  }

  /*
   * 5.
   *
   * SALVA NO CACHE.
   */
  if (resultado) {
    guardarCache(chave, resultado);
  }

  return resultado;
}
