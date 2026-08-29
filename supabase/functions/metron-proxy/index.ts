import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  adminClient,
  copyRateLimitHeaders,
  corsHeaders,
  metronFetchOnce,
} from '../_shared/metronRateLimit.ts';

function isAllowedCoverHost(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase();
    return (
      host === 'metron.cloud' ||
      host.endsWith('.metron.cloud') ||
      host === 'static.metron.cloud' ||
      host.endsWith('.amazonaws.com') ||
      host.endsWith('.cloudfront.net')
    );
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const metronPath = url.searchParams.get('path') ?? '/issue/';

    // Cover CDN — not the Metron API, so it does not use the API gate.
    if (metronPath === '/_image') {
      const src = url.searchParams.get('src') ?? '';
      if (!src || !isAllowedCoverHost(src)) {
        return new Response(JSON.stringify({ error: 'Invalid image src' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const imgRes = await fetch(src, {
        headers: { 'User-Agent': 'Comicsaki/1.0 (comicsaki@gmail.com)' },
      });
      if (!imgRes.ok) {
        return new Response(JSON.stringify({ error: `Image fetch ${imgRes.status}` }), {
          status: imgRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const bytes = await imgRes.arrayBuffer();
      return new Response(bytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const metronParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'path') metronParams[key] = value;
    }

    const sb = adminClient();
    const metronRes = await metronFetchOnce(sb, metronPath, metronParams);
    const body = await metronRes.text();

    return new Response(body, {
      status: metronRes.status,
      headers: {
        ...corsHeaders,
        'Content-Type': metronRes.headers.get('Content-Type') || 'application/json',
        ...copyRateLimitHeaders(metronRes.headers),
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
