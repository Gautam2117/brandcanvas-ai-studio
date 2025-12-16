# BrandCanvas AI

I built this prototype for the Tesco Retail Media InnovAItion Jam. It is a small creative builder that helps a supplier (even a non-designer) make a clean social media creative, while the app checks a few key Tesco-style rules in real time.

It is not a full product. The goal is a solid, working demo that shows:
- Create a layout quickly
- See FAIL or WARN when something breaks the rules
- Fix it with one click
- Export the same design in 3 formats, under 500 KB

## What you can do in the Studio

- Choose a format: 1:1, 9:16, 1.91:1
- Upload a packshot (background removal happens on upload if the remove-bg API is running)
- Add headline text and move/resize/rotate elements
- See a safe zone overlay and a Guardian panel that shows PASS, WARN, or FAIL
- Click an issue to jump to the problem layer
- Use quick fixes (auto-fit safe zone, add disclaimer, fix minimum font, fix contrast)
- Export JPEG/PNG for all three formats under 500 KB

## Built with

- Next.js (App Router) + React + TypeScript
- Konva / react-konva (canvas editor)
- Tailwind CSS (UI)
- A small policy module that evaluates layout rules and returns Guardian issues

## Run locally

From the repo root:

1) Install
- pnpm install

2) Start the app
- pnpm dev

3) Open the Studio
- http://localhost:3000/studio

Packshot background removal calls a local API endpoint:
- POST http://localhost:8000/remove-bg

If that API is not running, you can still use the Studio and the demo flow (just skip the upload part).

## Quick demo flow (2 to 4 minutes)

This is the simple story I show on screen:

1) Open /studio and load a demo that intentionally fails
- Point to Guardian status = FAIL and the issues list

2) Fix the safe zone fail
- Click the OUTSIDE_SAFE_ZONE issue (it selects the layer)
- Click Auto-fit safe zone

3) Fix the missing alcohol disclaimer (when alcohol is ON)
- Toggle Alcohol product ON if needed
- Click the MISSING_DISCLAIMER issue to add it

4) Fix minimum font (WARN)
- Click Fix min font
- Show PASS

5) Export proof
- Export JPEG (3 sizes)
- Point out the exported file sizes are under 500 KB

## Notes

- The rule checks in this prototype focus on a few high-signal items (safe zone, minimum font, contrast, and alcohol disclaimer).
- The export step is designed to hit the file size requirement reliably for social formats.
