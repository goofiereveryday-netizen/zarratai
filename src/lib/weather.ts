import { getWeatherCache, setWeatherCache } from "@/lib/offline/database";
import { isNetworkAvailable } from "@/lib/offline/identity";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const REQUEST_TIMEOUT_MS = 5000;
const FORECAST_DAYS = 5;

export type CurrentWeather = {
  temperatureC: number;
  condition: string;
  humidityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
};

export type DailyForecast = {
  date: string;
  minTempC: number;
  maxTempC: number;
  condition: string;
  rainChancePercent: number | null;
};

export type FarmWeather = {
  locationName: string;
  current: CurrentWeather;
  forecast: DailyForecast[];
};

type GeocodedPlace = {
  latitude: number;
  longitude: number;
  name: string;
};

type GeocodingResponse = {
  results?: Array<{ latitude: number; longitude: number; name: string }>;
};

type ForecastResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
  };
};

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code === 61 || code === 80) return "Light rain";
  if (code === 63 || code === 81) return "Rain";
  if (code === 65 || code === 82) return "Heavy rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Variable";
}

function degreesToCompass(degrees: number): string {
  return COMPASS_POINTS[Math.round(degrees / 45) % 8];
}

async function geocodePlace(name: string): Promise<GeocodedPlace | null> {
  const params = new URLSearchParams({
    name,
    count: "1",
    language: "en",
    format: "json",
    countryCode: "PK",
  });

  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeocodingResponse;
  const result = data.results?.[0];
  if (!result) {
    return null;
  }

  return { latitude: result.latitude, longitude: result.longitude, name: result.name };
}

async function fetchForecast(place: GeocodedPlace): Promise<FarmWeather> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: String(FORECAST_DAYS),
  });

  const response = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Forecast request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ForecastResponse;

  const current = data.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.relative_humidity_2m !== "number" ||
    typeof current.wind_speed_10m !== "number"
  ) {
    throw new Error("Forecast response is missing current weather data");
  }

  const times = data.daily?.time ?? [];
  const codes = data.daily?.weather_code ?? [];
  const maxTemps = data.daily?.temperature_2m_max ?? [];
  const minTemps = data.daily?.temperature_2m_min ?? [];
  const rainChances = data.daily?.precipitation_probability_max ?? [];

  const forecast: DailyForecast[] = [];
  for (let index = 0; index < times.length; index += 1) {
    const maxTemp = maxTemps[index];
    const minTemp = minTemps[index];
    if (typeof maxTemp !== "number" || typeof minTemp !== "number") {
      continue;
    }
    const code = codes[index];
    forecast.push({
      date: times[index],
      minTempC: Math.round(minTemp),
      maxTempC: Math.round(maxTemp),
      condition: describeWeatherCode(typeof code === "number" ? code : -1),
      rainChancePercent: typeof rainChances[index] === "number" ? rainChances[index] : null,
    });
  }

  if (forecast.length === 0) {
    throw new Error("Forecast response is missing daily data");
  }

  return {
    locationName: place.name,
    current: {
      temperatureC: Math.round(current.temperature_2m),
      condition: describeWeatherCode(
        typeof current.weather_code === "number" ? current.weather_code : -1,
      ),
      humidityPercent: Math.round(current.relative_humidity_2m),
      windSpeedKmh: Math.round(current.wind_speed_10m),
      windDirection:
        typeof current.wind_direction_10m === "number"
          ? degreesToCompass(current.wind_direction_10m)
          : "",
    },
    forecast,
  };
}

export async function getFarmWeather(
  district: string,
  tehsil: string,
): Promise<FarmWeather | null> {
  const candidates = [tehsil.trim(), district.trim()].filter(
    (name, index, list) => name !== "" && list.indexOf(name) === index,
  );

  if (candidates.length === 0) {
    return null;
  }

  const cacheKey = `farm-weather:${candidates.map((name) => name.toLowerCase()).join("|")}`;
  let cached: Awaited<ReturnType<typeof getWeatherCache<FarmWeather>>> = null;
  try {
    cached = await getWeatherCache<FarmWeather>(cacheKey);
    if (cached && cached.expires_at > Date.now()) return cached.data;
  } catch (error) {
    console.warn("Could not read the local weather cache:", error);
  }

  if (!isNetworkAvailable()) return cached?.data ?? null;

  try {
    let place: GeocodedPlace | null = null;
    for (const candidate of candidates) {
      place = await geocodePlace(candidate);
      if (place) {
        break;
      }
    }
    if (!place) {
      return null;
    }
    const weather = await fetchForecast(place);
    try {
      await setWeatherCache(cacheKey, weather);
    } catch (error) {
      console.warn("Could not save the local weather cache:", error);
    }
    return weather;
  } catch (err) {
    console.error(
      "Farm weather unavailable:",
      err instanceof Error ? err.message : err,
    );
    return cached?.data ?? null;
  }
}
