import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_HOSTS = new Set([
  'anubis.gr',
  'www.anubis.gr',
  'jemmacomics.com',
  'www.jemmacomics.com',
  'mamouthcomix.gr',
  'www.mamouthcomix.gr',
  'brainfood.gr',
  'www.brainfood.gr',
  'kaktos.gr',
  'www.kaktos.gr',
  'polarisekdoseis.gr',
  'www.polarisekdoseis.gr',
  'mikrosiros.gr',
  'www.mikrosiros.gr',
  'metaixmio.gr',
  'www.metaixmio.gr',
  'patakis.gr',
  'www.patakis.gr',
  'vivliopoleiopataki.gr',
  'www.vivliopoleiopataki.gr',
  'dioptra.gr',
  'www.dioptra.gr',
]);

const JSON_PREFIXES = ['/wp-json/wc/store/', '/wp-json/wp/v2/product', '/wp-json/wp/v2/media'];

const HTML_PREFIXES = [
  '/product-category/',
  '/product/',
  '/comics',
  '/index.php',
  '/el/categories/',
  '/en/categories/',
  '/el/products/',
  '/en/products/',
  '/vivlia/',
  '/books/',
  '/suggrafeas/',
  '/seires/',
  '/ekdoseis/',
  '/ekdotis/',
  '/proion/',
];

function isMikrosirosHost(host: string): boolean {
  return host === 'mikrosiros.gr' || host === 'www.mikrosiros.gr';
}

function isAllowedShopUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) return false;
    const path = url.pathname;
    if (isMikrosirosHost(host)) {
      if (/^\/(admin|index\.php\?route=account)/i.test(path)) return false;
      return true;
    }
    if (path === '/') return false;
    if (JSON_PREFIXES.some((p) => path.startsWith(p))) return true;
    if (HTML_PREFIXES.some((p) => path === p || path.startsWith(p))) return true;
    return false;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const target = new URL(req.url).searchParams.get('url') ?? '';
    if (!target || !isAllowedShopUrl(target)) {
      return new Response(JSON.stringify({ error: 'Invalid shop URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopRes = await fetch(target, {
      headers: {
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        'User-Agent': 'Comicsaki/1.0 (comicsaki@gmail.com)',
        'Accept-Language': 'el,en;q=0.8',
      },
      redirect: 'follow',
    });
    const body = await shopRes.text();
    const shopType = shopRes.headers.get('content-type') ?? 'text/plain; charset=utf-8';
    return new Response(body, {
      status: shopRes.status,
      headers: { ...corsHeaders, 'Content-Type': shopType },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
