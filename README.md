# BrandCanvas AI
Guideline-aware creative studio for Tesco Retail Media.

BrandCanvas AI is a prototype web app that helps a non-designer go from a simple brief and a packshot to a professional-looking social creative, while checking key retailer and brand rules in real time. The point of the prototype is to reduce back-and-forth, reduce rejections, and make it faster for smaller suppliers to produce compliant assets without relying on an agency for every variation.

## What this prototype demonstrates
- Visual creative editor (drag, resize, rotate) built around a simple canvas workflow
- Packshot upload with background removal (via a small remove-bg API)
- Multi-format creative support from one design:
  - 1:1 (1080x1080)
  - 9:16 (1080x1920)
  - 1.91:1 (1200x628)
- Guideline Guardian, a live validator with clear PASS / WARN / FAIL feedback
- One-click fixes that turn common issues into a guided flow
- Export to JPEG/PNG under 500 KB for each format (prototype goal for campaign constraints)

## Guideline Guardian checks included
This prototype focuses on a few high-signal checks that are easy for judges and stakeholders to verify quickly:
- Safe zone compliance: highlights a safe area and flags any element that goes outside it
- Minimum font size: warns or fails if text is too small
- Contrast: warns if text readability is likely to be poor
- Alcohol disclaimer: if the creative is marked as alcohol-related, a disclaimer is required

These checks are implemented as a small policy module so rules are easy to extend later.

## Demo flow for judges (2 to 4 minutes)
This is the loop the prototype is designed to showcase:

1) Open Studio and click **Load Demo FAIL**
- Guardian status shows FAIL
- Issues list is populated

2) Fix safe zone
- Click the **OUTSIDE_SAFE_ZONE** issue to auto-select the problematic layer
- Click **Auto-fit safe zone**
- Status improves

3) Fix missing disclaimer (alcohol flow)
- Toggle **Alcohol product** ON (if not already)
- Guardian shows **MISSING_DISCLAIMER**
- Click the issue to auto-add the disclaimer
- Status moves toward WARN or PASS

4) Fix minimum font
- Click **Fix min font**
- Status becomes PASS

5) Export proof
- Click **Export JPEG (3 sizes)**
- Show the exported file sizes are under 500 KB
- Mention that all three formats are exported from one design

## Tech stack
- Web: Next.js (App Router) + React + Tailwind CSS
- Canvas editing: react-konva + Konva
- Monorepo: pnpm workspaces (apps/*, packages/*)
- Policy engine: a local workspace package used by the web app
- Background removal: lightweight HTTP endpoint used by the packshot upload flow

## Local setup
Prerequisites:
- Node.js 18+ recommended
- pnpm 9+

Install dependencies from the repo root:
```bash
pnpm install
```

Run the project (monorepo):
```bash
pnpm dev
```

Background removal service:
- The Studio expects a remove-bg endpoint available at:
  - http://localhost:8000/remove-bg
- Start the remove-bg server provided in this repo (see the backend folder/service in the codebase).

Open the app:
- Visit the Studio route in your browser (for example /studio).
- Upload a packshot and test the Guardian checks and export flow.

## Project scope and what is intentionally minimal
This is a hackathon prototype optimized for judging:
- The editor supports the core operations needed for a clean demo: place assets, edit text, validate, fix, export.
- The policy rules are a starting set that can be expanded into a fuller guideline system.
- The goal is to prove the workflow end-to-end rather than cover every possible retail guideline in the first version.

## Roadmap after the campaign
If extended beyond the hackathon, the next steps are clear:
- Policy dashboard so Tesco can update rules without code changes
- More guideline coverage (logo placement, mandatory tiles, spacing rules, channel-specific constraints)
- Collaborative review (comments, approvals, version history)
- Template recommendations based on past high-performing creatives
- More output formats beyond social, including onsite and in-store placements

## About the author
Built as a solo project by Gautam Govind for the Tesco Retail Media InnovAItion Jam prototype phase.
