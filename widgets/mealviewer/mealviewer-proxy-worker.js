/**
 * mealviewer-proxy-worker.js
 * ===========================
 * A minimal Cloudflare Worker that proxies requests to api.mealviewer.com
 * and adds permissive CORS headers, so the DakBoard widget's browser-side
 * fetch() can read the response even if MealViewer itself doesn't send
 * CORS headers.
 *
 * DEPLOY (free tier is plenty):
 * 1. Sign up at https://workers.cloudflare.com (free).
 * 2. Create a new Worker, paste this file's contents in as the script.
 * 3. Deploy — you'll get a URL like:
 *      https://mealviewer-proxy.<your-subdomain>.workers.dev
 * 4. Paste that URL into PROXY_URL in dakboard-mealviewer-widget.html.
 *
 * USAGE:
 *   GET https://<your-worker>.workers.dev/?path=/api/v4/school/SchoolName/02-15-2026/02-15-2026/
 *   -> proxies to https://api.mealviewer.com/api/v4/school/SchoolName/02-15-2026/02-15-2026/
 *      and returns the response with Access-Control-Allow-Origin: *
 */

const UPSTREAM_HOST = "https://api.mealviewer.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const path = url.searchParams.get("path");
    if (!path || !path.startsWith("/")) {
      return new Response("Missing or invalid 'path' query parameter.", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const upstreamUrl = UPSTREAM_HOST + path;

    try {
      const upstreamResp = await fetch(upstreamUrl, {
        headers: { "Accept": "application/xml, text/xml, */*" },
      });

      const body = await upstreamResp.text();

      return new Response(body, {
        status: upstreamResp.status,
        headers: {
          ...corsHeaders(),
          "Content-Type": upstreamResp.headers.get("Content-Type") || "application/xml",
          "Cache-Control": "public, max-age=3600", // menus don't change often
        },
      });
    } catch (err) {
      return new Response("Proxy fetch failed: " + err.message, {
        status: 502,
        headers: corsHeaders(),
      });
    }
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
