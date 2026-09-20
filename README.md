# skillradar handoff

Public handoff stub for SkillRadar.

The complete deployment artifacts were generated in the Cursor environment:

- `/opt/cursor/artifacts/skillradar-src.tar.gz` - full source without `node_modules`, `.git`, `.next`, or `out`
- `/opt/cursor/artifacts/skillradar-standalone.tar.gz` - standalone static export containing `out/` plus a runbook

## Static production run

The app is configured with Next.js `output: "export"`, so `npm run build` emits `out/`.

Recommended production port: `8790`.

```bash
tar -xzf skillradar-standalone.tar.gz
cd out
python3 -m http.server 8790 --bind 0.0.0.0
```

Open `http://127.0.0.1:8790`.

## Build from source

```bash
tar -xzf skillradar-src.tar.gz -C skillradar-src
cd skillradar-src
npm install
npm run build
cd out
python3 -m http.server 8790 --bind 0.0.0.0
```

Note: direct HTTPS git push from this environment to GitHub was unavailable, so the full source handoff is provided via the artifacts above.
