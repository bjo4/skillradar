const ALLOWED_ORIGINS = new Set(["https://skills.kuroshimae.cc", "http://skills.kuroshimae.cc"]);

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders(request),
      ...(init.headers ?? {}),
    },
  });
}
