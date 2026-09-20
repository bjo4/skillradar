import { scoreSkillQuality, type SlopRisk } from "./quality";

export type SkillSort = "quality" | "stars" | "recent";

export type SkillSearchParams = {
  q?: string | null;
  minStars?: number | null;
  hideSlop?: boolean;
  sort?: SkillSort | string | null;
};

export type SkillResult = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  repo: string;
  stars: number;
  forks: number;
  pushedAt: string;
  license: string;
  score: number;
  risk: SlopRisk;
  flags: string[];
  install: string;
  htmlUrl: string;
  repoUrl: string;
};

type GitHubLicense = {
  spdx_id?: string | null;
} | null;

export type GitHubRepo = {
  full_name: string;
  html_url: string;
  description?: string | null;
  stargazers_count?: number | null;
  forks_count?: number | null;
  pushed_at?: string | null;
  license?: GitHubLicense;
  default_branch?: string | null;
};

export type GitHubCodeItem = {
  name: string;
  path: string;
  html_url: string;
  url?: string;
  repository: GitHubRepo;
};

type GitHubCodeSearchResponse = {
  total_count: number;
  items: GitHubCodeItem[];
};

type FetchLike = typeof fetch;

const CACHE_TTL_MS = Number(process.env.SKILLRADAR_CACHE_TTL_MS ?? 10 * 60 * 1_000);
const SEARCH_PER_PAGE = 24;
const cache = new Map<string, { expiresAt: number; value: SkillResult[] }>();

function sanitizeUserQuery(q?: string | null): string {
  return (q ?? "")
    .split(/\s+/)
    .filter((token) => token && !/^(filename|path|repo|org|user|language|extension|stars|fork|is):/i.test(token))
    .join(" ")
    .trim();
}

export function buildGitHubSkillSearchQuery(params: SkillSearchParams = {}): string {
  const parts = [
    "filename:SKILL.md",
    "(path:skills OR path:.cursor/skills OR path:.claude/skills)",
    "NOT is:fork",
  ];
  const userQuery = sanitizeUserQuery(params.q);
  const minStars = Number(params.minStars ?? 0);

  if (userQuery) parts.push(userQuery);
  if (Number.isFinite(minStars) && minStars > 0) parts.push(`stars:>=${Math.floor(minStars)}`);

  return parts.join(" ");
}

function githubHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "skillradar",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  return match[1].split("\n").reduce<Record<string, string>>((acc, line) => {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (field) acc[field[1].toLowerCase()] = field[2].replace(/^["']|["']$/g, "").trim();
    return acc;
  }, {});
}

function titleCaseSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function skillNameFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const directory = parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? "Agent Skill";
  return titleCaseSlug(directory.replace(/\.md$/i, ""));
}

function firstHeading(content: string): string | null {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function firstParagraph(content: string): string | null {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?\n---/, "");
  return (
    withoutFrontmatter
      .split(/\n{2,}/)
      .map((block) => block.replace(/^#+\s+.+$/gm, "").trim())
      .find((block) => block.length > 20) ?? null
  );
}

function categoriesFrom(path: string, content: string): string[] {
  const lowered = `${path} ${content}`.toLowerCase();
  const categories = new Set<string>();

  for (const part of path.split("/").slice(0, -1)) {
    if (![".cursor", ".claude", "skills", "skill"].includes(part.toLowerCase())) {
      categories.add(part.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
    }
  }

  if (/next|react|frontend|ui/.test(lowered)) categories.add("frontend");
  if (/test|tdd|quality|lint/.test(lowered)) categories.add("quality");
  if (/security|threat|auth/.test(lowered)) categories.add("security");
  if (/data|python|notebook|pdf|research/.test(lowered)) categories.add("research");
  if (/agent|skill/.test(lowered)) categories.add("agent-skills");

  return Array.from(categories).filter(Boolean).slice(0, 5);
}

function stableId(repo: string, path: string): string {
  return `${repo}:${path}`.toLowerCase();
}

export function mapGitHubCodeItemToSkill(
  item: GitHubCodeItem,
  content = "",
  now = new Date(),
  repoDetails?: Partial<GitHubRepo>,
): SkillResult {
  const repo = { ...item.repository, ...repoDetails };
  const frontmatter = parseFrontmatter(content);
  const name = frontmatter.name ?? firstHeading(content) ?? skillNameFromPath(item.path);
  const description =
    frontmatter.description ??
    firstParagraph(content) ??
    repo.description ??
    `Agent Skill discovered at ${item.path}.`;
  const license = repo.license?.spdx_id || "Unknown";
  const pushedAt = repo.pushed_at || now.toISOString();
  const stars = repo.stargazers_count ?? 0;
  const forks = repo.forks_count ?? 0;
  const quality = scoreSkillQuality({
    name,
    description,
    repoStars: stars,
    repoForks: forks,
    pushedAt,
    license,
    path: item.path,
    content,
    now,
  });

  return {
    id: stableId(repo.full_name, item.path),
    name,
    description,
    categories: categoriesFrom(item.path, content),
    repo: repo.full_name,
    stars,
    forks,
    pushedAt,
    license,
    score: quality.score,
    risk: quality.risk,
    flags: quality.flags,
    install: `npx skills add ${repo.full_name}`,
    htmlUrl: item.html_url,
    repoUrl: repo.html_url,
  };
}

async function fetchJson<T>(fetchImpl: FetchLike, url: string): Promise<T> {
  const response = await fetchImpl(url, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchRepoDetails(fetchImpl: FetchLike, fullName: string): Promise<Partial<GitHubRepo>> {
  return fetchJson<GitHubRepo>(fetchImpl, `https://api.github.com/repos/${fullName}`);
}

async function fetchSkillContent(fetchImpl: FetchLike, item: GitHubCodeItem): Promise<string> {
  if (!item.url) return "";
  const data = await fetchJson<{ content?: string; encoding?: string }>(fetchImpl, item.url);
  if (!data.content) return "";
  if (data.encoding === "base64") {
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  return data.content;
}

function normalizeSort(sort?: string | null): SkillSort {
  if (sort === "stars" || sort === "recent") return sort;
  return "quality";
}

function sortSkills(skills: SkillResult[], sort?: string | null): SkillResult[] {
  const mode = normalizeSort(sort);
  return [...skills].sort((a, b) => {
    if (mode === "stars") return b.stars - a.stars || b.score - a.score;
    if (mode === "recent") return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
    return b.score - a.score || b.stars - a.stars;
  });
}

export async function searchGitHubSkills(
  params: SkillSearchParams = {},
  options: { fetch?: FetchLike; now?: Date } = {},
): Promise<SkillResult[]> {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? new Date();
  const cacheKey = JSON.stringify({
    q: params.q ?? "",
    minStars: params.minStars ?? 0,
    hideSlop: Boolean(params.hideSlop),
    sort: normalizeSort(params.sort),
  });
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const query = buildGitHubSkillSearchQuery(params);
  const url = new URL("https://api.github.com/search/code");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(SEARCH_PER_PAGE));

  const search = await fetchJson<GitHubCodeSearchResponse>(fetchImpl, url.toString());
  const mapped = await Promise.all(
    search.items.map(async (item) => {
      const [repoDetails, content] = await Promise.all([
        fetchRepoDetails(fetchImpl, item.repository.full_name).catch(() => ({})),
        fetchSkillContent(fetchImpl, item).catch(() => ""),
      ]);
      return mapGitHubCodeItemToSkill(item, content, now, repoDetails);
    }),
  );

  const minStars = Number(params.minStars ?? 0);
  const filtered = mapped
    .filter((skill) => skill.stars >= minStars)
    .filter((skill) => !params.hideSlop || skill.risk !== "high");
  const value = sortSkills(filtered, params.sort);

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

export function clearSkillSearchCache(): void {
  cache.clear();
}
