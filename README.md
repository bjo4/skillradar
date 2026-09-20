# skillradar

Deployable static handoff for SkillRadar.

The repository contains a self-contained static export in `out/` so it can be cloned without Origin access and served directly.

## Clone

```bash
git clone https://github.com/bjo4/skillradar.git
cd skillradar
```

## Serve production locally

Recommended port: `8790`.

```bash
cd out
python3 -m http.server 8790 --bind 0.0.0.0
```

Open:

```text
http://127.0.0.1:8790
```

## Notes

- `out/index.html` is a self-contained static SkillRadar handoff page with catalog cards, search, min-star filter, sort, and hide-likely-slop toggle.
- The full Next.js source remains on the Origin branch; this GitHub repo is the public deployable handoff for Cloudflare/static hosting.
