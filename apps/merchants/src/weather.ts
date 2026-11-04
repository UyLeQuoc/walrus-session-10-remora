/**
 * ADR-0106 `weather`: a city's next three days from Open-Meteo (geocoding, then the forecast; no key).
 * The forecast is read before the payment (`sourceFirst`): a city it can't find answers 400 and a
 * source that doesn't answer 502, both before anything is charged. Ten minutes' cache per city.
 */
import {
  type PaidContext,
  SourceInputError,
  sourceFirst,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

/** WMO weather codes, in a few words. */
const SKY: [number, string][] = [
  [0, "clear"],
  [3, "partly cloudy"],
  [48, "fog"],
  [57, "drizzle"],
  [67, "rain"],
  [77, "snow"],
  [82, "rain showers"],
  [86, "snow showers"],
  [99, "thunderstorms"],
];
export const sky = (code: number) => SKY.find(([max]) => code <= max)?.[1] ?? "unknown";

export interface Forecast {
  source: "Open-Meteo";
  place: string;
  timezone: string;
  days: { date: string; sky: string; minC: number; maxC: number; rainChance: number | null }[];
}

const cache = new Map<string, { at: number; value: Forecast }>();

export async function forecastFor(city: string, http: typeof fetch = fetch, now = Date.now()) {
  const key = city.toLowerCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < 600_000) return hit.value;
  const geo = await http(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
  );
  if (!geo.ok) throw new Error(`Open-Meteo geocoding answered ${geo.status}`);
  const place = (
    (await geo.json()) as {
      results?: { name: string; country?: string; latitude: number; longitude: number }[];
    }
  ).results?.[0];
  if (!place) throw new SourceInputError("unknown_city", `No place called "${city}".`);
  const res = await http(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=3`,
  );
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const body = (await res.json()) as {
    timezone: string;
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max?: (number | null)[];
      weather_code: number[];
    };
  };
  const d = body.daily;
  const value: Forecast = {
    source: "Open-Meteo",
    place: [place.name, place.country].filter(Boolean).join(", "),
    timezone: body.timezone,
    days: d.time.map((date, i) => ({
      date,
      sky: sky(d.weather_code[i] ?? -1),
      minC: d.temperature_2m_min[i] ?? 0,
      maxC: d.temperature_2m_max[i] ?? 0,
      rainChance: d.precipitation_probability_max?.[i] ?? null,
    })),
  };
  cache.set(key, { at: now, value });
  return value;
}

export function createWeatherApp(o: { pay: X402Options; fetch?: typeof fetch }) {
  const app = new Hono<{ Variables: { x402: PaidContext; source: Forecast } }>();
  const city = (q: string | undefined) => (q ?? "").trim();
  app.get(
    "/weather",
    sourceFirst(
      async (c) => forecastFor(city(c.req.query("city")), o.fetch),
      (c) => {
        const name = city(c.req.query("city"));
        if (!name || name.length > 80)
          throw new SourceInputError("bad_city", "Name a city, up to 80 characters.");
      },
    ),
    x402(o.pay),
    (c) => c.json({ ...c.get("source"), paid: c.get("x402") }),
  );
  return app;
}
