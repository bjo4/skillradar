import { describe, expect, it } from "vitest";

import { buildGitHubSkillSearchQuery, mapGitHubCodeItemToSkill } from "../src/server/github";
import { scoreSkillQuality } from "../src/server/quality";

describe("buildGitHubSkillSearchQuery", () => {
  it("builds a SKILL.md code-search query with path hints and user terms", () => {
    const query = buildGitHubSkillSearchQuery({ q: "tdd loop", minStars: 25 });

    expect(query).toContain("filename:SKILL.md");
    expect(query).toContain("tdd loop");
    expect(query).toContain("stars:>=25");
    expect(query).toContain("path:skills");
    expect(query).toContain("NOT is:fork");
  });

  it("sanitizes search refinements that could break the base SKILL.md search", () => {
    const query = buildGitHubSkillSearchQuery({
      q: "filename:README.md repo:spam/farm path:/tmp SEO agent",
    });

    expect(query).toContain("filename:SKILL.md");
    expect(query).toContain("SEO agent");
    expect(query).not.toContain("filename:README.md");
    expect(query).not.toContain("repo:spam/farm");
    expect(query).not.toContain("path:/tmp");
  });
});

describe("scoreSkillQuality", () => {
  it("rewards maintained repositories with README-like skill metadata", () => {
    const result = scoreSkillQuality({
      name: "Threat Model Starter",
      description: "Builds a lightweight threat model from feature scope and data flows.",
      repoStars: 250,
      repoForks: 30,
      pushedAt: "2026-09-10T00:00:00Z",
      license: "MIT",
      path: ".cursor/skills/threat-model/SKILL.md",
      content: [
        "---",
        "name: threat-model-starter",
        "description: Build threat models for product features",
        "---",
        "# Threat Model Starter",
        "Use when designing a feature that touches auth, data, or external integrations.",
      ].join("\n"),
      now: new Date("2026-09-20T00:00:00Z"),
    });

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.risk).toBe("low");
    expect(result.flags).toContain("has-frontmatter");
    expect(result.flags).toContain("recently-maintained");
  });

  it("penalizes likely slop dumps with low metadata and spammy names", () => {
    const result = scoreSkillQuality({
      name: "SEO AI Agent Skill Pack",
      description: "seo-ai-agent-skill-pack",
      repoStars: 0,
      repoForks: 0,
      pushedAt: "2025-01-01T00:00:00Z",
      license: "NOASSERTION",
      path: "bulk-ai-skill-dump/SKILL.md",
      content: "seo-ai-agent-skill-pack\nbest ai agent prompt seo marketing content viral",
      now: new Date("2026-09-20T00:00:00Z"),
    });

    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.risk).toBe("high");
    expect(result.flags).toEqual(
      expect.arrayContaining(["low-repo-signal", "stale-repository", "spammy-copy", "missing-license"]),
    );
  });
});

describe("mapGitHubCodeItemToSkill", () => {
  it("enriches a GitHub code result with repository signals and quality scoring", () => {
    const skill = mapGitHubCodeItemToSkill(
      {
        name: "SKILL.md",
        path: ".cursor/skills/pdf-analyst/SKILL.md",
        html_url: "https://github.com/acme/agent-skills/blob/main/.cursor/skills/pdf-analyst/SKILL.md",
        repository: {
          full_name: "acme/agent-skills",
          html_url: "https://github.com/acme/agent-skills",
          description: "Useful agent skills",
          stargazers_count: 1200,
          forks_count: 90,
          pushed_at: "2026-09-12T00:00:00Z",
          license: { spdx_id: "Apache-2.0" },
        },
      },
      "# PDF Analyst\nExtracts structured summaries and citations from PDF-heavy workflows.",
      new Date("2026-09-20T00:00:00Z"),
    );

    expect(skill).toMatchObject({
      name: "PDF Analyst",
      repo: "acme/agent-skills",
      stars: 1200,
      forks: 90,
      pushedAt: "2026-09-12T00:00:00Z",
      license: "Apache-2.0",
      htmlUrl: "https://github.com/acme/agent-skills/blob/main/.cursor/skills/pdf-analyst/SKILL.md",
      repoUrl: "https://github.com/acme/agent-skills",
      install: "npx skills add acme/agent-skills",
    });
    expect(skill.description).toContain("Extracts structured summaries");
    expect(skill.score).toBeGreaterThan(75);
    expect(skill.risk).toBe("low");
  });
});
