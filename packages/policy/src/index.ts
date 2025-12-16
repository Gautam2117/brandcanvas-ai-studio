export type FormatKey = "SQUARE_1_1" | "STORY_9_16" | "LANDSCAPE_1_91_1";

export type GuardianSeverity = "PASS" | "WARN" | "FAIL";

export type GuardianIssue = {
  code: string;
  message: string;
  severity: Exclude<GuardianSeverity, "PASS">;
  layerId?: string;
};

export type BBox = { x: number; y: number; w: number; h: number };

export type LayerModel = {
  id: string;
  type: "image" | "text" | "disclaimer";
  bbox: BBox;
  textMeta?: { fontPx?: number; fillHex?: string };
};

export function getRules() {
  return {
    minFontPx: 24,
    alcoholDisclaimerText: "Please drink responsibly.",
  };
}

export function getFormat(format: FormatKey) {
  if (format === "SQUARE_1_1") return { key: format, w: 1080, h: 1080, safeMargin: 60 };
  if (format === "STORY_9_16") return { key: format, w: 1080, h: 1920, safeMargin: 80 };
  return { key: format, w: 1200, h: 628, safeMargin: 50 };
}

function inside(a: BBox, b: BBox) {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

export function evaluateCreative(args: {
  format: FormatKey;
  layers: LayerModel[];
  isAlcohol: boolean;
  canvasBgHex: string;
}) {
  const fmt = getFormat(args.format);
  const safeRect: BBox = {
    x: fmt.safeMargin,
    y: fmt.safeMargin,
    w: fmt.w - 2 * fmt.safeMargin,
    h: fmt.h - 2 * fmt.safeMargin,
  };

  const issues: GuardianIssue[] = [];

  for (const l of args.layers) {
    if (!inside(l.bbox, safeRect)) {
      issues.push({
        code: "OUTSIDE_SAFE_ZONE",
        message: "Layer is outside safe zone.",
        severity: "FAIL",
        layerId: l.id,
      });
    }
    if ((l.type === "text" || l.type === "disclaimer") && (l.textMeta?.fontPx ?? 0) < getRules().minFontPx) {
      issues.push({
        code: "MIN_FONT",
        message: `Font size must be >= ${getRules().minFontPx}px.`,
        severity: "WARN",
        layerId: l.id,
      });
    }
  }

  if (args.isAlcohol) {
    const hasDisclaimer = args.layers.some((l) => l.type === "disclaimer");
    if (!hasDisclaimer) {
      issues.push({
        code: "MISSING_DISCLAIMER",
        message: "Alcohol creative requires a disclaimer.",
        severity: "FAIL",
      });
    }
  }

  const status: GuardianSeverity =
    issues.some((i) => i.severity === "FAIL") ? "FAIL" : issues.length ? "WARN" : "PASS";

  return { status, safeRect, issues };
}
