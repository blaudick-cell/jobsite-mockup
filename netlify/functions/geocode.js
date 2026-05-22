// Geocoding proxy. The browser can't call api.census.gov directly (no CORS
// headers) and api.allorigins.win turned out to be too slow / flaky to rely
// on. So we proxy through a Netlify Function on our own origin — same-origin
// fetches, no third-party in the path, 24h edge cache since the address →
// coordinate mapping is stable.
//
// Usage:
//   GET /api/geocode?source=census&q=<address>
//   GET /api/geocode?source=photon&q=<address>
//
// Returns the upstream JSON body verbatim so the frontend can parse it the
// same way it would a direct call.

export default async (request) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const source = url.searchParams.get('source') || 'census';

  if (q.length < 6) {
    return new Response(JSON.stringify({ matches: [] }), {
      headers: {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      },
    });
  }

  try {
    let upstream;
    if (source === 'census') {
      upstream =
        'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=' +
        encodeURIComponent(q) +
        '&benchmark=Public_AR_Current&format=json';
    } else if (source === 'photon') {
      upstream =
        'https://photon.komoot.io/api/?q=' +
        encodeURIComponent(q) +
        '&limit=6&lang=en';
    } else {
      return new Response(JSON.stringify({ error: 'unknown source' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const r = await fetch(upstream, {
      headers: {
        'user-agent': 'jobsite-mockup-demo/1.0 (robert@laudickeng.com)',
      },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        'content-type': r.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
