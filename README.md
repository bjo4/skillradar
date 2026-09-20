# skillradar

GitHub-backed Agent Skills radar.

SkillRadar searches GitHub for Agent Skills (`SKILL.md`) and combines repository signals with anti-slop scoring so the UI can rank likely useful skills above generated dumps.

## Clone

```bash
git clone https://github.com/bjo4/skillradar.git
cd skillradar
npm install
```

## Environment

`GITHUB_TOKEN` is optional for very small local experiments, but required for production. GitHub Code Search is rate-limited and may reject unauthenticated requests.

```bash
export GITHUB_TOKEN=github_pat_...
```

Optional cache tuning:

```bash
export SKILLRADAR_CACHE_TTL_MS=600000
```

## Run locally

Development server:

```bash
GITHUB_TOKEN=... npm run dev
```

Production build and server on port `8790`:

```bash
npm run build
GITHUB_TOKEN=... npm start
```

Open:

```text
http://127.0.0.1:8790
```

## API

```text
GET /api/skills/search?q=&minStars=&hideSlop=&sort=
GET /api/skills/health
```

Search behavior:

- Builds a GitHub Code Search query around `filename:SKILL.md`.
- Adds skill-path hints such as `path:skills`, `.cursor/skills`, and `.claude/skills`.
- Accepts user text through `q` while stripping unsafe GitHub qualifiers that would override the base skill search.
- Enriches results with repo stars, forks, pushed date, license, description, and URLs.
- Applies quality score `0-100` plus slop-risk flags.
- Caches search results in memory using `SKILLRADAR_CACHE_TTL_MS`.

Sort values:

- `quality` (default)
- `stars`
- `recent`

## Tests

```bash
npm test
npm run build
```

## Deploy on warren-tpe-01 behind Cloudflare Tunnel

Run the Node server on the host:

```bash
cd /srv/skillradar
npm ci
npm run build
GITHUB_TOKEN=... npm start
```

Example Cloudflare Tunnel ingress:

```yaml
tunnel: skillradar
credentials-file: /etc/cloudflared/skillradar.json

ingress:
  - hostname: skills.kuroshimae.cc
    service: http://127.0.0.1:8790
  - service: http_status:404
```

Then run:

```bash
cloudflared tunnel run skillradar
```

## Notes

- `out/` is retained only as the previous static handoff artifact. Runtime deploys should use the Next.js Node server because `/api/*` is now required.
- The frontend calls `/api/skills/search` and falls back to bundled seed skills if the API is unavailable.
