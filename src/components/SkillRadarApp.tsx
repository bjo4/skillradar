"use client";

import { useEffect, useMemo, useState } from "react";

import { seedSkills } from "../data/seedSkills";
import type { SkillResult } from "../server/github";

type ApiState = "loading" | "github" | "fallback";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function daysAgo(value: string): string {
  const diff = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (diff === 0) return "today";
  return `${diff} days ago`;
}

function localFilter(skills: SkillResult[], q: string, minStars: number, hideSlop: boolean, sort: string): SkillResult[] {
  const needle = q.toLowerCase().trim();
  return skills
    .filter((skill) => {
      if (!needle) return true;
      return [skill.name, skill.description, skill.repo, skill.categories.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .filter((skill) => skill.stars >= minStars)
    .filter((skill) => !hideSlop || skill.risk !== "high")
    .sort((a, b) => {
      if (sort === "stars") return b.stars - a.stars;
      if (sort === "recent") return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
      return b.score - a.score;
    });
}

export function SkillRadarApp() {
  const [q, setQ] = useState("");
  const [minStars, setMinStars] = useState(0);
  const [sort, setSort] = useState("quality");
  const [hideSlop, setHideSlop] = useState(true);
  const [skills, setSkills] = useState<SkillResult[]>(seedSkills);
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q,
      minStars: String(minStars),
      hideSlop: String(hideSlop),
      sort,
    });

    setApiState("loading");
    fetch(`/api/skills/search?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json() as Promise<{ skills: SkillResult[] }>;
      })
      .then((data) => {
        setSkills(data.skills);
        setApiState("github");
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setSkills(localFilter(seedSkills, q, minStars, hideSlop, sort));
        setApiState("fallback");
        setError(reason instanceof Error ? reason.message : "API unavailable");
      });

    return () => controller.abort();
  }, [q, minStars, hideSlop, sort]);

  const visibleSkills = useMemo(() => {
    return apiState === "github" || apiState === "loading" ? skills : localFilter(seedSkills, q, minStars, hideSlop, sort);
  }, [apiState, hideSlop, minStars, q, skills, sort]);

  return (
    <>
      <section className="hero">
        <span className="pill">SKILL.md ecosystem only · GitHub-backed MVP · No crawler farm</span>
        <h1>Agent Skills Directory with GitHub signals and anti-slop scoring.</h1>
        <p>
          skillradar 幫開發者搜尋 Cursor / Claude Code / Codex 可用的 Agent Skills，重點是 repo quality
          signals、維護狀態與 anti-slop scoring。
        </p>
      </section>

      <section className="panel">
        <div className="controls">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search skill, repo, category..." />
          <select value={minStars} onChange={(event) => setMinStars(Number(event.target.value))}>
            <option value="0">All stars</option>
            <option value="50">50+ stars</option>
            <option value="500">500+ stars</option>
            <option value="1000">1k+ stars</option>
            <option value="5000">5k+ stars</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="quality">Quality score</option>
            <option value="stars">GitHub stars</option>
            <option value="recent">Recently updated</option>
          </select>
          <label className="pill checkbox">
            <input checked={hideSlop} onChange={(event) => setHideSlop(event.target.checked)} type="checkbox" /> Hide likely
            slop
          </label>
        </div>
        <p className="muted">
          顯示 {visibleSkills.length} skills ·{" "}
          {apiState === "github" ? "Live GitHub search" : apiState === "loading" ? "Loading GitHub search..." : "Seed fallback"}
          {error ? ` · ${error}` : ""}
        </p>
      </section>

      <section className="grid">
        {visibleSkills.map((skill) => (
          <article className="card" key={skill.id}>
            <span className={`pill risk-${skill.risk}`}>{skill.risk.toUpperCase()} slop risk</span>
            <h2>{skill.name}</h2>
            <p>{skill.description}</p>
            <div>
              {skill.categories.map((category) => (
                <span className="tag" key={category}>
                  {category}
                </span>
              ))}
            </div>
            <div className="stats">
              <span className="muted">
                Stars<b>{compact.format(skill.stars)}</b>
              </span>
              <span className="muted">
                Forks<b>{compact.format(skill.forks)}</b>
              </span>
              <span className="muted">
                Quality<b>{skill.score}</b>
              </span>
            </div>
            <p>
              <a href={skill.repoUrl}>{skill.repo}</a>
              <br />
              <span className="muted">
                Last push {daysAgo(skill.pushedAt)} · License {skill.license}
              </span>
            </p>
            {skill.flags.length > 0 ? (
              <p className="flags muted">Signals: {skill.flags.slice(0, 4).join(", ")}</p>
            ) : null}
            <code>{skill.install}</code>
            <p>
              <a href={skill.htmlUrl}>Open SKILL.md</a>
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
