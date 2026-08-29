import { Platform } from 'react-native';

import { env } from '@/lib/env';
import { supabaseFunctionHeaders } from '@/lib/supabase';

const REQUEST_TIMEOUT_MS = 28_000;

function isJsonPayload(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('[') || trimmed.startsWith('{');
}

async function fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Public shop catalog via Supabase proxy (CORS / Cloudflare), then direct.
 * Returns the raw body so callers can parse JSON or HTML.
 */
export async function greekShopFetchText(url: string): Promise<string> {
  if (env.supabaseUrl) {
    const proxyUrl = `${env.supabaseUrl}/functions/v1/greek-shop-proxy?url=${encodeURIComponent(url)}`;
    try {
      const res = await fetchWithTimeout(proxyUrl, await supabaseFunctionHeaders());
      const text = await res.text();
      if (res.ok && text.trim()) return text;
    } catch {
      // Native can still try the shop directly.
    }
  }

  if (Platform.OS === 'web') {
    throw new Error('Shop blocked the request');
  }

  const res = await fetchWithTimeout(url, {
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
  });
  if (!res.ok) throw new Error(`Shop error ${res.status}`);
  return res.text();
}

/**
 * WooCommerce / WP JSON via proxy, then direct.
 */
export async function greekShopFetch(url: string): Promise<unknown> {
  const text = await greekShopFetchText(url);
  if (!isJsonPayload(text)) throw new Error('Shop blocked the request');
  return JSON.parse(text);
}
