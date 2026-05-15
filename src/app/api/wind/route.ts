import 'server-only';
import finca from '@config/finca.json';

// /api/wind — proxy to Open-Meteo for the Tarifa coordinates in finca.json.
//
// Why a route instead of fetching Open-Meteo from the Footer directly:
//   1. Cache. Next's `fetch` cache holds the upstream response for 15 min
//      so we don't hammer Open-Meteo on every page view.
//   2. Failure mode. The Footer's wind ticker is decorative — if Open-Meteo
//      is down, this route returns the last known values (or a sane
//      default) rather than letting a fetch error bubble into the UI.
//   3. CORS / vendor lock-in. The Footer talks to our own domain; swapping
//      Open-Meteo for Windy later only touches this file.
//
// Response shape (stable):
//   { speed: number, deg: number, source: 'open-meteo' | 'fallback' }
//   speed is in knots (we ask Open-Meteo for kn directly).

export const dynamic = 'force-dynamic'; // route handler — re-evaluate every call
export const revalidate = 0;            // but rely on the inner fetch cache below

type WindResponse = { speed: number; deg: number; source: 'open-meteo' | 'fallback' };

const FALLBACK: WindResponse = { speed: 22, deg: 270, source: 'fallback' };

export async function GET(): Promise<Response> {
  const { lat, lon } = finca.location.coords;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;

  try {
    // 15-min revalidate — Open-Meteo updates hourly, this is plenty fresh.
    const r = await fetch(url, { next: { revalidate: 900 } });
    if (!r.ok) return Response.json(FALLBACK);

    const data = (await r.json()) as {
      current?: { wind_speed_10m?: number; wind_direction_10m?: number };
    };
    const speed = data.current?.wind_speed_10m;
    const deg = data.current?.wind_direction_10m;
    if (typeof speed !== 'number' || typeof deg !== 'number') {
      return Response.json(FALLBACK);
    }
    return Response.json({
      speed: Number(speed.toFixed(1)),
      deg: Math.round(deg),
      source: 'open-meteo',
    } satisfies WindResponse);
  } catch {
    return Response.json(FALLBACK);
  }
}
