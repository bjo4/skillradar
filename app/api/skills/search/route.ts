import { type NextRequest } from "next/server";

import { searchGitHubSkills } from "../../../../src/server/github";
import { corsHeaders, jsonResponse } from "../../../../src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const minStars = Number(searchParams.get("minStars") ?? 0);

  try {
    const skills = await searchGitHubSkills({
      q: searchParams.get("q"),
      minStars: Number.isFinite(minStars) ? minStars : 0,
      hideSlop: searchParams.get("hideSlop") === "true",
      sort: searchParams.get("sort"),
    });

    return jsonResponse(request, {
      source: "github",
      count: skills.length,
      skills,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown GitHub search error";
    return jsonResponse(
      request,
      {
        source: "github",
        error: "github_search_failed",
        message,
        tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
      },
      { status: 502 },
    );
  }
}
