export type SlopRisk = "low" | "medium" | "high";

export type QualityInput = {
  name: string;
  description?: string | null;
  repoStars?: number | null;
  repoForks?: number | null;
  pushedAt?: string | null;
  license?: string | null;
  path?: string | null;
  content?: string | null;
  now?: Date;
};

export type QualityScore = {
  score: number;
  risk: SlopRisk;
  flags: string[];
};

const SPAMMY_TERMS = [
  "seo",
  "viral",
  "growth hack",
  "make money",
  "prompt pack",
  "skill pack",
  "bulk",
  "dump",
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function daysSince(date: string, now: Date): number {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86_400_000));
}

function isMissingLicense(license?: string | null): boolean {
  if (!license) return true;
  return ["unknown", "noassertion", "none", "unlicensed"].includes(license.toLowerCase());
}

function looksLikeSlug(value?: string | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return /^[a-z0-9-_/]+$/.test(trimmed) && !trimmed.includes(" ");
}

export function scoreSkillQuality(input: QualityInput): QualityScore {
  const now = input.now ?? new Date();
  const flags = new Set<string>();
  const content = input.content ?? "";
  const description = input.description ?? "";
  const searchable = `${input.name} ${description} ${input.path ?? ""} ${content}`.toLowerCase();
  let score = 50;

  const stars = input.repoStars ?? 0;
  const forks = input.repoForks ?? 0;

  if (stars >= 1_000) score += 22;
  else if (stars >= 100) score += 16;
  else if (stars >= 10) score += 8;
  else {
    score -= 18;
    flags.add("low-repo-signal");
  }

  if (forks >= 50) score += 6;
  else if (forks === 0 && stars < 10) score -= 4;

  const ageDays = input.pushedAt ? daysSince(input.pushedAt, now) : Number.POSITIVE_INFINITY;
  if (ageDays <= 120) {
    score += 18;
    flags.add("recently-maintained");
  } else if (ageDays <= 365) {
    score += 8;
  } else {
    score -= 18;
    flags.add("stale-repository");
  }

  if (isMissingLicense(input.license)) {
    score -= 12;
    flags.add("missing-license");
  } else {
    score += 8;
  }

  if (/^---[\s\S]*?\n---/.test(content)) {
    score += 10;
    flags.add("has-frontmatter");
  } else {
    score -= 5;
  }

  if (/use when|##\s+usage|#\s+\w+/i.test(content)) score += 6;

  if (description.length >= 40 && !looksLikeSlug(description)) {
    score += 8;
    flags.add("clear-description");
  } else {
    score -= 8;
  }

  const spamHits = SPAMMY_TERMS.filter((term) => searchable.includes(term));
  if (spamHits.length >= 2) {
    score -= 24;
    flags.add("spammy-copy");
  }

  if (/bulk|dump|generated|fixtures?/i.test(input.path ?? "")) {
    score -= 14;
    flags.add("likely-bulk-dump");
  }

  const finalScore = clampScore(score);
  const risk: SlopRisk = finalScore < 45 ? "high" : finalScore < 75 ? "medium" : "low";

  return {
    score: finalScore,
    risk,
    flags: Array.from(flags).sort(),
  };
}
