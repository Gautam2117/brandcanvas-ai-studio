# BrandCanvas AI

BrandCanvas AI is a guideline-aware creative builder for Tesco Retail Media. It helps advertisers (especially small and mid-sized suppliers) create clean, compliant, multi-format social creatives faster, with live checks that prevent rejections.

## What problem this solves

Retail media creatives often fail for simple reasons:
- Elements placed outside safe zones
- Missing required disclaimers for regulated categories (example: alcohol)
- Text too small to be readable
- Low contrast text that hurts readability

These issues cause back-and-forth, delays, and wasted budget. BrandCanvas AI makes those issues visible early and helps fix them in one click.

## What this prototype does

In the Studio you can:
- Upload a packshot and remove the background via an API endpoint
- Drag, resize, and rotate elements on a canvas
- Switch between three formats:
  - 1:1 (1080x1080)
  - 9:16 (1080x1920)
  - 1.91:1 (1200x628)
- See real-time Guideline Guardian results:
  - PASS, WARN, FAIL with an issues list
- Click an issue to jump to the problematic layer
- Use one-click fixes:
  - Auto-fit safe zone
  - Add disclaimer
  - Fix minimum font size
  - Fix contrast
- Export JPEG or PNG for all three formats under 500 KB

## Demo flow (2 to 4 minutes)

Use this as your judge-ready walkthrough:
- 0:00 to 0:20
  - Open the Studio
  - Click "Load Demo FAIL"
  - Point to Guardian status = FAIL and the issues list
- 0:20 to 1:10
  - Click OUTSIDE_SAFE_ZONE (it selects the layer)
  - Click "Auto-fit safe zone"
  - Status improves, but may still FAIL if disclaimer is missing
- 1:10 to 1:40
  - Toggle "Alcohol product" ON (if not already)
  - Guardian shows MISSING_DISCLAIMER
  - Click the issue to auto-add the disclaimer
- 1:40 to 2:10
  - If you see a WARN for font size, click "Fix min font"
  - Show PASS
- 2:10 to 3:00
  - Click "Export JPEG (3 sizes)"
  - Show the size results are under 500 KB
  - Mention it exports all formats from one design

## Project structure

This repo is a pnpm workspace (monorepo):
- apps/web
  - Next.js app with the Studio UI (React + Konva)
- apps/api (or similar)
  - Background removal endpoint used by the Studio
- packages/policy
  - Guideline Guardian rule helpers and evaluation logic

If your folder names differ, update this section to match your repo.

## Tech used

- Next.js (App Router)
- React
- Tailwind CSS
- Konva + react-konva (canvas editing)
- pnpm workspaces
- Node.js for the web app
- Python service for background removal (prototype endpoint)

## Setup

### Prerequisites
- Node.js 18+ (recommended)
- pnpm 9+
- Python 3.10+ (if you are running the background removal service)

### Install dependencies (from repo root)
```bash
pnpm install
```

### Run the web app
```bash
pnpm -C apps/web dev
```

The Studio will be available at:
- http://localhost:3000

### Run the background removal API

The Studio expects a local endpoint:
- http://localhost:8000/remove-bg

If you already have the API wired up, run it from its app folder. Example:
```bash
pnpm -C apps/api dev
```

If your API is Python-based, run it using your existing command (FastAPI, Flask, etc.).

## Notes on exports under 500 KB

The export step should:
- Render each format at the correct dimensions
- Encode to JPEG or PNG
- Reduce quality (and if needed downscale slightly) until each file is under 500 KB

If you change export logic, keep the size printout visible so judges can verify quickly.

## Troubleshooting

- Cannot find module "@brandcanvas/policy"
  - Confirm the package exists under packages/policy
  - From repo root run:
    - pnpm install
  - In apps/web/next.config.ts ensure:
    - experimental.externalDir = true
    - transpilePackages includes "@brandcanvas/policy"
  - Restart the dev server after changes

- Background removal fails
  - Confirm the API is running on port 8000
  - Confirm the route is POST /remove-bg and returns an image blob
  - For local development, CORS may be needed depending on your setup

## What I would build next

If continued after the hackathon:
- A policy dashboard for Tesco teams to edit rules without code changes
- Collaboration: comments, approvals, version history
- One-brief to full creative set generation
- Performance-informed layout suggestions using campaign signals
- More formats beyond social, including in-store and on-site placements

## License

This is a hackathon prototype. Add a license if you plan to open-source it.
