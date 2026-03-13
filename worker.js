// Cloudflare Worker — EEG Classifier API Proxy with Rate Limiting
//
// Setup:
//   1. npx wrangler init eeg-proxy
//   2. Copy this file as the worker entry (src/index.js)
//   3. npx wrangler secret put ANTHROPIC_API_KEY
//   4. Create KV namespace:  npx wrangler kv namespace create RATE_LIMIT
//   5. Add KV binding to wrangler.toml:
//      [[kv_namespaces]]
//      binding = "RATE_LIMIT"
//      id = "<id from step 4>"
//   6. npx wrangler deploy

const ALLOWED_ORIGIN = 'https://mgalovic.github.io';
const DAILY_LIMIT = 5;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' }, request);
    }

    // Check origin
    const origin = request.headers.get('Origin') || '';
    if (!origin.startsWith(ALLOWED_ORIGIN)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse(500, { error: 'API key not configured' }, request);
    }

    // --- Rate limiting by IP ---
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rateLimitKey = `rate:${ip}:${today}`;

    let count = 0;
    if (env.RATE_LIMIT) {
      const stored = await env.RATE_LIMIT.get(rateLimitKey);
      count = stored ? parseInt(stored, 10) : 0;
    }

    if (count >= DAILY_LIMIT) {
      return jsonResponse(429, {
        error: 'Daily limit reached',
        message: `You have used all ${DAILY_LIMIT} analyses for today. Please try again tomorrow.`,
        limit: DAILY_LIMIT,
        used: count
      }, request);
    }

    // --- Forward to Anthropic ---
    try {
      const body = await request.text();

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body,
      });

      const responseBody = await anthropicRes.text();

      // Only count successful API calls against the limit
      if (anthropicRes.ok && env.RATE_LIMIT) {
        await env.RATE_LIMIT.put(rateLimitKey, String(count + 1), {
          expirationTtl: 86400 // auto-expire after 24h
        });
      }

      const remaining = DAILY_LIMIT - count - (anthropicRes.ok ? 1 : 0);

      return new Response(responseBody, {
        status: anthropicRes.status,
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(DAILY_LIMIT),
          'X-RateLimit-Remaining': String(Math.max(0, remaining)),
        },
      });
    } catch (err) {
      return jsonResponse(500, { error: err.message }, request);
    }
  },
};

function jsonResponse(status, data, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = origin.startsWith(ALLOWED_ORIGIN) ? origin : ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining',
  };
}
