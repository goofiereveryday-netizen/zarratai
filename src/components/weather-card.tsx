import { WeatherIcon } from "@/components/icons";
import { getFarmWeather, type DailyForecast } from "@/lib/weather";

/**
 * Compact current-conditions and short-forecast card for the selected farm.
 * Async server component — renders behind its own Suspense boundary on the
 * dashboard so the rest of the page never waits on the weather service.
 */
export async function WeatherCard({
  district,
  tehsil,
}: {
  district: string;
  tehsil: string;
}) {
  const weather = await getFarmWeather(district, tehsil);

  if (!weather) {
    return (
      <section
        id="farm-weather"
        aria-label="Farm weather"
        className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
      >
        <div className="flex items-center gap-2 text-sm text-forest-floor">
          <WeatherIcon />
          <span className="font-medium">Farm Weather</span>
        </div>
        <p className="mt-2 text-sm text-forest-floor/60">
          Weather is unavailable for this location right now. Please check
          again later.
        </p>
      </section>
    );
  }

  const windLabel = weather.current.windDirection
    ? `${weather.current.windSpeedKmh} km/h ${weather.current.windDirection}`
    : `${weather.current.windSpeedKmh} km/h`;
  const todayRainChance = weather.forecast[0]?.rainChancePercent ?? null;
  const todayRainLabel =
    todayRainChance == null ? "n/a" : `${todayRainChance}%`;

  return (
    <section
      id="farm-weather"
      aria-label="Farm weather"
      className="mb-6 rounded-lg border border-forest-floor/20 bg-wheat-cream-light px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm text-forest-floor">
        <WeatherIcon />
        <span className="font-medium">Farm Weather</span>
        <span className="truncate text-forest-floor/60">
          · {weather.locationName}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-deep-moss">
          {weather.current.temperatureC}°C
        </span>
        <span className="text-sm font-medium text-forest-floor">
          {weather.current.condition}
        </span>
      </div>

      <p className="mt-1 text-sm text-forest-floor/80">
        Humidity {weather.current.humidityPercent}% · Wind {windLabel} · Rain
        chance today {todayRainLabel}
      </p>

      <ul className="mt-3 border-t border-forest-floor/10">
        {weather.forecast.map((day, index) => (
          <li
            key={day.date}
            className="flex items-center justify-between gap-2 border-b border-forest-floor/10 py-1.5 text-sm last:border-b-0"
          >
            <span className="w-14 shrink-0 font-medium text-forest-floor">
              {forecastDayLabel(day, index)}
            </span>
            <span className="min-w-0 flex-1 truncate text-forest-floor/80">
              {day.condition}
            </span>
            <span className="shrink-0 text-deep-moss">
              {day.minTempC}–{day.maxTempC}°C
            </span>
            <span className="w-12 shrink-0 text-right text-forest-floor/60">
              {day.rainChancePercent == null ? "—" : `${day.rainChancePercent}%`}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-forest-floor/50">
        Weather data: Open-Meteo
      </p>
    </section>
  );
}

function forecastDayLabel(day: DailyForecast, index: number): string {
  if (index === 0) {
    return "Today";
  }
  // Parsed at noon so the calendar date can never shift across time zones.
  return new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
  });
}
