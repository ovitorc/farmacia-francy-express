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

const cache = new Map<string, ResultadoUnidade>();
const CACHE_MAX = 500;

export function chaveCache(e: EnderecoConsulta) {
  return [e.cep, e.rua, e.numero, e.bairro, e.cidade, e.estado]
    .map((v) => v.trim().toLowerCase())
    .join("|");
}

function guardarCache(chave: string, valor: ResultadoUnidade) {
  if (cache.size >= CACHE_MAX) {
    const primeira = cache.keys().next().value;
    if (primeira) cache.delete(primeira);
  }
  cache.set(chave, valor);
}

export function lerCache(chave: string) {
  return cache.get(chave) ?? null;
}

function credenciais() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": mapsKey,
  } as Record<string, string>;
}

function enderecoTexto(e: EnderecoConsulta) {
  const partes = [
    [e.rua, e.numero].filter(Boolean).join(", "),
    e.bairro,
    `${e.cidade} - ${e.estado}`,
    e.cep,
    "Brasil",
  ].filter((p) => p && p.trim());
  return partes.join(", ");
}

async function geocodificar(
  e: EnderecoConsulta,
  headers: Record<string, string>,
): Promise<{ lat: number; lon: number } | null> {
  const url = `${GATEWAY_URL}/maps/api/geocode/json?region=br&components=country:BR&address=${encodeURIComponent(
    enderecoTexto(e),
  )}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    console.error(`Geocoding falhou [${resp.status}]: ${await resp.text()}`);
    return null;
  }
  const dados = (await resp.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
  };
  const loc = dados.results?.[0]?.geometry?.location;
  if (dados.status !== "OK" || !loc) return null;
  return { lat: loc.lat, lon: loc.lng };
}

async function matrizDeRotas(
  origem: { lat: number; lon: number },
  destinos: Unidade[],
  headers: Record<string, string>,
): Promise<Array<{ indice: number; metros: number; segundos: number | null }> | null> {
  const resp = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "originIndex,destinationIndex,distanceMeters,duration,condition,status",
    },
    body: JSON.stringify({
      origins: [
        {
          waypoint: {
            location: { latLng: { latitude: origem.lat, longitude: origem.lon } },
          },
        },
      ],
      destinations: destinos.map((u) => ({
        waypoint: {
          location: { latLng: { latitude: u.latitude, longitude: u.longitude } },
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

  if (!Array.isArray(dados)) return null;

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
    }));

  return linhas.length > 0 ? linhas : null;
}

function maisProximaLinhaReta(origem: { lat: number; lon: number }, aviso: string | null) {
  let melhor: ResultadoUnidade | null = null;
  for (const u of UNIDADES_ATIVAS) {
    const d = distanciaKm(origem.lat, origem.lon, u.latitude, u.longitude);
    if (!melhor || d < melhor.distanciaKm) {
      melhor = {
        unidadeId: u.id,
        distanciaKm: d,
        duracaoMin: null,
        origem: "linha-reta",
        aviso,
      };
    }
  }
  return melhor;
}

export async function resolverUnidadeMaisProxima(
  endereco: EnderecoConsulta,
): Promise<ResultadoUnidade | null> {
  const chave = chaveCache(endereco);
  const emCache = lerCache(chave);
  if (emCache) return emCache;

  const headers = credenciais();
  if (!headers) {
    console.error("Credenciais do Google Maps ausentes.");
    return null;
  }

  const origem = await geocodificar(endereco, headers);
  if (!origem) return null;

  const linhas = await matrizDeRotas(origem, UNIDADES_ATIVAS, headers);

  let resultado: ResultadoUnidade | null = null;

  if (linhas) {
    const melhor = linhas.reduce((a, b) => (b.metros < a.metros ? b : a));
    const unidade = UNIDADES_ATIVAS[melhor.indice];
    if (unidade) {
      resultado = {
        unidadeId: unidade.id,
        distanciaKm: melhor.metros / 1000,
        duracaoMin: melhor.segundos !== null ? Math.round(melhor.segundos / 60) : null,
        origem: "rota",
        aviso: null,
      };
    }
  }

  if (!resultado) {
    resultado = maisProximaLinhaReta(
      origem,
      "Não foi possível calcular a rota; usamos a distância em linha reta.",
    );
  }

  if (resultado) guardarCache(chave, resultado);
  return resultado;
}
