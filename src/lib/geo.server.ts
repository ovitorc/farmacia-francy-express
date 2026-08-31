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
   CREDENCIAIS GOOGLE MAPS / LOVABLE
========================================================= */

function credenciais(): Record<string, string> | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];

  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];

  /*
   * Mantemos a compatibilidade com a integração
   * existente do Lovable.
   */

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
   ENDEREÇOS DE CONSULTA
========================================================= */

/*
 * Endereço completo informado pelo cliente.
 *
 * Não existe nenhuma limitação para João Pessoa.
 *
 * A cidade informada pode ser:
 * - João Pessoa
 * - Santa Rita
 * - Cabedelo
 * - qualquer outra cidade válida.
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
 * Busca alternativa utilizando CEP.
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
 * Busca alternativa mais simples.
 *
 * Útil quando o Google não reconhece
 * imediatamente o endereço completo.
 */
function montarEnderecoSimplificado(endereco: EnderecoConsulta) {
  const partes = [
    endereco.rua.trim(),
    endereco.numero.trim(),
    endereco.cidade.trim(),
    endereco.estado.trim(),
    "Brasil",
  ].filter(Boolean);

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
   VALIDAÇÃO DE RESULTADOS
========================================================= */

function resultadoCorrespondeCidade(resultado: ResultadoGeocodingGoogle, cidadeInformada: string) {
  const cidade = normalizarTexto(cidadeInformada);

  if (!cidade) {
    return true;
  }

  const formattedAddress = normalizarTexto(resultado.formatted_address || "");

  /*
   * O Google pode utilizar diferentes
   * componentes dependendo da região.
   */
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
    formattedAddress.includes(cidade)
  );
}

function resultadoCorrespondeEstado(resultado: ResultadoGeocodingGoogle, estadoInformado: string) {
  const estado = normalizarTexto(estadoInformado);

  if (!estado) {
    return true;
  }

  const estadoGoogle = normalizarTexto(obterComponente(resultado.address_components, ["administrative_area_level_1"]));

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  /*
   * PB pode aparecer como:
   * - PB
   * - Paraíba
   * - Paraiba
   */
  const estadoCompativel =
    estadoGoogle === estado || estadoGoogle.includes(estado) || enderecoFormatado.includes(estado);

  if (estado === "pb") {
    return estadoCompativel || estadoGoogle.includes("paraiba") || enderecoFormatado.includes("paraiba");
  }

  return estadoCompativel;
}

/* =========================================================
   PONTUAÇÃO DOS RESULTADOS
========================================================= */

function pontuarResultado(resultado: ResultadoGeocodingGoogle, endereco: EnderecoConsulta) {
  let pontos = 0;

  const enderecoFormatado = normalizarTexto(resultado.formatted_address || "");

  const rua = normalizarTexto(endereco.rua);

  const numero = normalizarTexto(endereco.numero);

  const bairro = normalizarTexto(endereco.bairro);

  const cidade = normalizarTexto(endereco.cidade);

  /*
   * Cidade
   */
  if (resultadoCorrespondeCidade(resultado, endereco.cidade)) {
    pontos += 50;
  }

  /*
   * Estado
   */
  if (resultadoCorrespondeEstado(resultado, endereco.estado)) {
    pontos += 30;
  }

  /*
   * Rua
   */
  if (rua && enderecoFormatado.includes(rua)) {
    pontos += 35;
  }

  /*
   * Número
   */
  if (numero && enderecoFormatado.includes(numero)) {
    pontos += 15;
  }

  /*
   * Bairro
   */
  if (bairro && enderecoFormatado.includes(bairro)) {
    pontos += 20;
  }

  /*
   * Cidade no endereço formatado
   */
  if (cidade && enderecoFormatado.includes(cidade)) {
    pontos += 15;
  }

  /*
   * Tipos de resultado preferidos
   */
  if (resultado.types?.includes("street_address")) {
    pontos += 30;
  }

  if (resultado.types?.includes("premise")) {
    pontos += 25;
  }

  if (resultado.types?.includes("route")) {
    pontos += 15;
  }

  return pontos;
}

/* =========================================================
   ESCOLHER MELHOR RESULTADO
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

  return (
    validos
      .map((resultado) => ({
        resultado,
        pontos: pontuarResultado(resultado, endereco),
      }))
      .sort((a, b) => b.pontos - a.pontos)[0]?.resultado ?? null
  );
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
   GEOCODIFICAR ENDEREÇO
========================================================= */

/*
 * Aqui está a parte mais importante.
 *
 * Tentamos mais de uma forma de encontrar
 * o endereço do cliente.
 *
 * Isso permite encontrar corretamente ruas
 * em João Pessoa, Santa Rita e Cabedelo,
 * inclusive regiões como Tibiri.
 */
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
   * Fazemos todas as tentativas disponíveis.
   */
  for (const consulta of consultas) {
    const encontrados = await consultarGoogleGeocoding(consulta, headers);

    resultados.push(...encontrados);

    /*
     * Se encontramos um endereço com alta
     * correspondência, podemos continuar
     * avaliando todos os resultados.
     */
  }

  /*
   * Remove duplicados.
   */
  const unicos = resultados.filter((resultado, indice, array) => {
    const lat = resultado.geometry?.location?.lat;

    const lng = resultado.geometry?.location?.lng;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return false;
    }

    const chave = `${lat},${lng}`;

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

  console.log("[GEO] Endereço localizado:", {
    enderecoOriginal: endereco,
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
   GOOGLE ROUTES
========================================================= */

function converterDuracaoParaSegundos(duracao?: string) {
  if (!duracao) {
    return null;
  }

  const segundos = Number(String(duracao).replace("s", ""));

  return Number.isFinite(segundos) ? segundos : null;
}

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
         * Rota real de carro.
         */
        travelMode: "DRIVE",

        /*
         * Considera as condições
         * atuais do trânsito.
         */
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();

      console.error(`[GEO] Google Routes falhou (${resposta.status}):`, texto);

      return null;
    }

    const dados = (await resposta.json()) as unknown;

    /*
     * Normalmente a integração retorna
     * um array de rotas.
     */
    if (!Array.isArray(dados)) {
      console.error("[GEO] Formato inesperado da resposta do Google Routes:", dados);

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

        segundos: converterDuracaoParaSegundos(item.duration),
      }))
      .filter((rota) => Number.isFinite(rota.metros) && rota.metros >= 0);

    if (rotas.length === 0) {
      return null;
    }

    console.log("[GEO] Rotas calculadas:", rotas);

    return rotas;
  } catch (erro) {
    console.error("[GEO] Erro ao calcular rotas:", erro);

    return null;
  }
}

/* =========================================================
   ESCOLHER MELHOR ROTA
========================================================= */

/*
 * A prioridade é:
 *
 * 1. Menor tempo de deslocamento.
 * 2. Em caso de empate, menor distância.
 *
 * Dessa forma, não escolhemos simplesmente
 * a loja em linha reta.
 *
 * Escolhemos a unidade mais rápida para
 * chegar ao endereço do cliente.
 */
function escolherMelhorRota(rotas: ResultadoRota[]) {
  return [...rotas].sort((a, b) => {
    /*
     * Se as duas rotas possuem duração,
     * priorizamos a mais rápida.
     */
    if (a.segundos !== null && b.segundos !== null) {
      if (a.segundos !== b.segundos) {
        return a.segundos - b.segundos;
      }
    }

    /*
     * Se apenas uma possui duração,
     * priorizamos a que possui cálculo.
     */
    if (a.segundos !== null && b.segundos === null) {
      return -1;
    }

    if (a.segundos === null && b.segundos !== null) {
      return 1;
    }

    /*
     * Critério secundário:
     * menor distância.
     */
    return a.metros - b.metros;
  })[0];
}

/* =========================================================
   FALLBACK LINHA RETA
========================================================= */

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
 * FLUXO COMPLETO:
 *
 * ENDEREÇO DO CLIENTE
 *        ↓
 * GOOGLE GEOCODING
 *        ↓
 * COORDENADAS EXATAS
 *        ↓
 * GOOGLE ROUTES
 *        ↓
 * CALCULA TODAS AS UNIDADES
 *        ↓
 * COMPARA TEMPO E DISTÂNCIA
 *        ↓
 * ESCOLHE A MELHOR UNIDADE
 *        ↓
 * WHATSAPP DA UNIDADE CORRETA
 */
export async function resolverUnidadeMaisProxima(endereco: EnderecoConsulta): Promise<ResultadoUnidade | null> {
  const chave = chaveCache(endereco);

  /*
   * Verifica o cache primeiro.
   */
  const resultadoCache = lerCache(chave);

  if (resultadoCache) {
    console.log("[GEO] Resultado encontrado no cache:", resultadoCache);

    return resultadoCache;
  }

  /*
   * Credenciais.
   */
  const headers = credenciais();

  if (!headers) {
    return null;
  }

  /*
   * IMPORTANTE:
   *
   * UNIDADES_ATIVAS já é a lista de
   * unidades que o sistema deve utilizar.
   *
   * NÃO filtramos novamente por `.active`,
   * pois isso poderia deixar a lista vazia
   * dependendo da estrutura do objeto.
   */
  const unidades = [...UNIDADES_ATIVAS];

  if (unidades.length === 0) {
    console.error("[GEO] Nenhuma unidade Francy está disponível para cálculo.");

    return null;
  }

  /*
   * 1. Descobre a localização exata
   * do endereço informado pelo cliente.
   */
  const origem = await geocodificarEndereco(endereco, headers);

  if (!origem) {
    console.error("[GEO] Não foi possível localizar o endereço do cliente.", endereco);

    return null;
  }

  /*
   * 2. Calcula as rotas para TODAS
   * as unidades Francy.
   */
  const rotas = await calcularMatrizDeRotas(origem, unidades, headers);

  let resultado: ResultadoUnidade | null = null;

  /*
   * 3. Escolhe a rota mais rápida.
   */
  if (rotas && rotas.length > 0) {
    const melhorRota = escolherMelhorRota(rotas);

    const unidade = unidades[melhorRota.indice];

    if (unidade) {
      resultado = {
        unidadeId: unidade.id,

        distanciaKm: melhorRota.metros / 1000,

        duracaoMin: melhorRota.segundos !== null ? Math.max(1, Math.round(melhorRota.segundos / 60)) : null,

        origem: "rota",

        aviso: null,
      };

      console.log("[GEO] Melhor unidade encontrada:", {
        unidade: unidade.name,

        distanciaKm: resultado.distanciaKm,

        duracaoMin: resultado.duracaoMin,
      });
    }
  }

  /*
   * 4. Fallback somente se o Google Routes
   * não conseguir calcular nenhuma rota.
   *
   * Mesmo nesse caso, o endereço do cliente
   * continua sendo geocodificado corretamente.
   */
  if (!resultado) {
    console.warn("[GEO] Nenhuma rota disponível. Usando distância em linha reta.");

    resultado = calcularMaisProximaLinhaReta(origem);
  }

  /*
   * 5. Guarda o resultado.
   */
  if (resultado) {
    guardarCache(chave, resultado);
  }

  return resultado;
}
