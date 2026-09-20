import { corsHeaders, jsonResponse } from "../../../../src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  return jsonResponse(request, {
    ok: true,
    service: "skillradar",
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    cacheTtlSeconds: Number(process.env.SKILLRADAR_CACHE_TTL_MS ?? 10 * 60 * 1_000) / 1_000,
  });
}
