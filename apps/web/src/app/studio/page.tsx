"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Group,
  Rect,
  Text as KText,
  Image as KImage,
  Transformer,
} from "react-konva";
import useImage from "use-image";

// Option A (recommended when workspace types resolve):
// import { evaluateCreative, getFormat, getRules, type FormatKey, type GuardianIssue, type LayerModel } from "@brandcanvas/policy";

// Option B (unblocks immediately if TS can't find @brandcanvas/policy):
// Adjust this path only if your monorepo layout differs.
import {
  evaluateCreative,
  getFormat,
  getRules,
  type FormatKey,
  type GuardianIssue,
  type LayerModel,
} from "../../../../../packages/policy/src";

type BaseLayer = {
  id: string;
  x: number;
  y: number;
  rotation: number;
};

type ImgLayer = BaseLayer & {
  kind: "image";
  src: string;
  width: number;
  height: number;
};

type TextLayer = BaseLayer & {
  kind: "text" | "disclaimer";
  text: string;
  fontSize: number;
  fill: string; // hex
  width: number;
};

type AnyLayer = ImgLayer | TextLayer;

type TabKey = "guardian" | "properties" | "layers";

type Toast = { kind: "ok" | "warn" | "bad"; msg: string } | null;

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

// Axis-aligned bbox for a rect rotated around its top-left (Konva default offset)
function rotatedBBox(x: number, y: number, w: number, h: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const rot = (px: number, py: number) => {
    const dx = px - x;
    const dy = py - y;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return { x: x + rx, y: y + ry };
  };

  const p1 = rot(x, y);
  const p2 = rot(x + w, y);
  const p3 = rot(x, y + h);
  const p4 = rot(x + w, y + h);

  const xs = [p1.x, p2.x, p3.x, p4.x];
  const ys = [p1.y, p2.y, p3.y, p4.y];

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function statusBadge(status: "PASS" | "WARN" | "FAIL") {
  if (status === "PASS") return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-700/50";
  if (status === "WARN") return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-700/50";
  return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-700/50";
}

function tabBtn(active: boolean) {
  return active
    ? "bg-slate-950 text-slate-50 ring-1 ring-slate-700"
    : "bg-slate-900 text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800";
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n));
}

export default function StudioPage() {
  const rules = getRules();

  const [tab, setTab] = useState<TabKey>("guardian");

  const [formatKey, setFormatKey] = useState<FormatKey>("SQUARE_1_1");
  const format = useMemo(() => getFormat(formatKey), [formatKey]);

  const [layers, setLayers] = useState<AnyLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isAlcohol, setIsAlcohol] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ w: 900, h: 650 });

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<any>(null);

  function showToast(t: Toast, ms = 2200) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  // Stage export
  const stageRef = useRef<any>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingBusy, setExportingBusy] = useState(false);
  const [exportLog, setExportLog] = useState<string[]>([]);

  // Keep latest computed values available during async export loop
  const exportParamsRef = useRef({ formatKey, format, scale: 1, offset: { x: 0, y: 0 } });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      setViewport({
        w: Math.max(320, rect.width),
        h: Math.max(420, rect.height),
      });
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = useMemo(
    () => Math.min(1, Math.min(viewport.w / format.w, viewport.h / format.h)),
    [viewport, format]
  );

  const offset = useMemo(
    () => ({ x: (viewport.w - format.w * scale) / 2, y: (viewport.h - format.h * scale) / 2 }),
    [viewport, format, scale]
  );

  useEffect(() => {
    exportParamsRef.current = { formatKey, format, scale, offset };
  }, [formatKey, format, scale, offset]);

  // Policy layers
  const policyLayers: LayerModel[] = useMemo(() => {
    return layers.map((l) => {
      if (l.kind === "image") {
        const bb = rotatedBBox(l.x, l.y, l.width, l.height, l.rotation);
        return { id: l.id, type: "image", bbox: bb };
      }
      const approxH = Math.max(1, l.fontSize * 1.25 * 2);
      const bb = rotatedBBox(l.x, l.y, l.width, approxH, l.rotation);
      return {
        id: l.id,
        type: l.kind === "disclaimer" ? "disclaimer" : "text",
        bbox: bb,
        textMeta: { fontPx: l.fontSize, fillHex: l.fill },
      };
    });
  }, [layers]);

  const guardian = useMemo(() => {
    return evaluateCreative({
      format: formatKey,
      layers: policyLayers,
      isAlcohol,
      canvasBgHex: "#FFFFFF",
    });
  }, [formatKey, policyLayers, isAlcohol]);

  // Fixes
  function updateLayer(id: string, patch: Partial<AnyLayer>) {
    setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as AnyLayer) : l)));
  }

  function removeLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }

  function bringToFront(id: string) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.push(it);
      return copy;
    });
  }

  function sendToBack(id: string) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.unshift(it);
      return copy;
    });
  }

  function selectedLayer() {
    return layers.find((l) => l.id === selectedId) || null;
  }

  async function onUploadRemoveBg(file: File) {
    const fd = new FormData();
    fd.append("file", file);

    // Keep your current endpoint. Make sure your backend is running.
    const res = await fetch("http://localhost:8000/remove-bg", { method: "POST", body: fd });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`remove-bg failed: ${res.status} ${text}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const baseW = Math.round(format.w * 0.55);
    const imgLayer: ImgLayer = {
      id: uid(),
      kind: "image",
      src: url,
      x: Math.round((format.w - baseW) / 2),
      y: Math.round(format.h * 0.22),
      width: baseW,
      height: baseW,
      rotation: 0,
    };

    setLayers((prev) => [...prev, imgLayer]);
    setSelectedId(imgLayer.id);
    setTab("properties");
    showToast({ kind: "ok", msg: "Packshot added" });
  }

  function addHeadline() {
    const id = uid();
    const l: TextLayer = {
      id,
      kind: "text",
      text: "New Year Offers",
      x: format.safeMargin,
      y: format.safeMargin,
      rotation: 0,
      fontSize: 44,
      fill: "#0f172a",
      width: Math.round(format.w * 0.75),
    };
    setLayers((p) => [...p, l]);
    setSelectedId(id);
    setTab("properties");
  }

  function addSubtext() {
    const id = uid();
    const l: TextLayer = {
      id,
      kind: "text",
      text: "Limited time only",
      x: format.safeMargin,
      y: format.safeMargin + 64,
      rotation: 0,
      fontSize: Math.max(rules.minFontPx, 26),
      fill: "#0f172a",
      width: Math.round(format.w * 0.7),
    };
    setLayers((p) => [...p, l]);
    setSelectedId(id);
    setTab("properties");
  }

  function addDisclaimer() {
    const id = uid();
    const l: TextLayer = {
      id,
      kind: "disclaimer",
      text: rules.alcoholDisclaimerText,
      x: format.safeMargin,
      y: format.h - format.safeMargin - 40,
      rotation: 0,
      fontSize: Math.max(rules.minFontPx, 26),
      fill: "#0f172a",
      width: Math.round(format.w * 0.7),
    };
    setLayers((p) => [...p, l]);
    setSelectedId(id);
    setTab("properties");
  }

  function fitSelectedToSafeZone() {
    const sel = selectedLayer();
    if (!sel) return;
    const safe = guardian.safeRect;

    if (sel.kind === "image") {
      let nx = sel.x;
      let ny = sel.y;
      let nw = sel.width;
      let nh = sel.height;

      const maxW = safe.w;
      const maxH = safe.h;
      const scaleDown = Math.min(1, maxW / nw, maxH / nh);
      nw = Math.floor(nw * scaleDown);
      nh = Math.floor(nh * scaleDown);

      nx = Math.min(Math.max(nx, safe.x), safe.x + safe.w - nw);
      ny = Math.min(Math.max(ny, safe.y), safe.y + safe.h - nh);

      updateLayer(sel.id, { x: nx, y: ny, width: nw, height: nh });
      showToast({ kind: "ok", msg: "Auto-fit applied" });
      return;
    }

    let nx = sel.x;
    let ny = sel.y;
    nx = Math.min(Math.max(nx, safe.x), safe.x + safe.w - sel.width);
    ny = Math.min(Math.max(ny, safe.y), safe.y + safe.h - 60);
    updateLayer(sel.id, { x: nx, y: ny });
    showToast({ kind: "ok", msg: "Auto-fit applied" });
  }

  function fixMinFont() {
    const sel = selectedLayer();
    if (!sel || sel.kind === "image") return;
    updateLayer(sel.id, { fontSize: Math.max(sel.fontSize, rules.minFontPx) });
    showToast({ kind: "ok", msg: "Min font fixed" });
  }

  function fixContrast() {
    const sel = selectedLayer();
    if (!sel || sel.kind === "image") return;
    updateLayer(sel.id, { fill: "#0f172a" });
    showToast({ kind: "ok", msg: "Contrast fixed" });
  }

  function clickIssue(issue: GuardianIssue) {
    if (issue.layerId) {
      setSelectedId(issue.layerId);
      setTab("properties");
    }
    if (issue.code === "MISSING_DISCLAIMER") addDisclaimer();
  }

  function resetCanvas() {
    setLayers([]);
    setSelectedId(null);
    setIsAlcohol(false);
    setExportLog([]);
    showToast({ kind: "ok", msg: "Canvas reset" });
  }

  // Demo: FAIL -> Fix -> PASS
  function loadDemoFail() {
    setFormatKey("SQUARE_1_1");
    setIsAlcohol(true);

    const base = getFormat("SQUARE_1_1");

    const id = uid();
    const demo: TextLayer = {
      id,
      kind: "text",
      text: "Mega Offer",
      x: 0, // outside safe
      y: 0, // outside safe
      rotation: 0,
      fontSize: Math.max(10, rules.minFontPx - 6), // trigger min font issue
      fill: "#9ca3af",
      width: Math.round(base.w * 0.85),
    };

    setLayers([demo]);
    setSelectedId(id);
    setTab("guardian");
    showToast({ kind: "warn", msg: "Demo loaded: expect FAIL, then Fix -> PASS" }, 2600);
  }

  // Hotkeys: Delete / Backspace
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeLayer(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  // Konva selection + transformer
  const trRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, any>>({});

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;

    if (!selectedId || isExporting) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const node = nodeRefs.current[selectedId];
    if (!node) return;
    tr.nodes([node]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, layers, isExporting]);

  // Export: under 500KB for all 3 formats
  const MAX_BYTES = 500 * 1024;

  function bytesLabel(n: number) {
    return `${Math.round(n / 1024)} KB`;
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function dataUrlToBlob(dataUrl: string) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  function nextFrame() {
    return new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  async function settleUI() {
    await nextFrame();
    await nextFrame();
  }

  async function exportWithLimit(
    requested: "image/png" | "image/jpeg"
  ): Promise<{
    blob: Blob;
    mimeUsed: "image/png" | "image/jpeg";
    qualityUsed?: number;
  }> {
    const stage = stageRef.current;
    if (!stage) throw new Error("Stage ref not ready");

    const { format: fmt, scale: sc, offset: off } = exportParamsRef.current;

    const cropX = off.x;
    const cropY = off.y;
    const cropW = fmt.w * sc;
    const cropH = fmt.h * sc;
    const pixelRatio = 1 / sc;

    if (requested === "image/png") {
      const url = stage.toDataURL({
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        pixelRatio,
        mimeType: "image/png",
      });
      const blob = await dataUrlToBlob(url);
      if (blob.size <= MAX_BYTES) return { blob, mimeUsed: "image/png" };

      // PNG often exceeds 500KB. Fallback to JPEG automatically.
      return await exportWithLimit("image/jpeg");
    }

    let quality = 0.92;
    while (quality >= 0.2) {
      const url = stage.toDataURL({
        x: cropX,
        y: cropY,
        width: cropW,
        height: cropH,
        pixelRatio,
        mimeType: "image/jpeg",
        quality,
      });
      const blob = await dataUrlToBlob(url);
      if (blob.size <= MAX_BYTES) return { blob, mimeUsed: "image/jpeg", qualityUsed: quality };
      quality = Math.round((quality - 0.06) * 100) / 100;
    }

    const url = stage.toDataURL({
      x: cropX,
      y: cropY,
      width: cropW,
      height: cropH,
      pixelRatio,
      mimeType: "image/jpeg",
      quality: 0.2,
    });
    const blob = await dataUrlToBlob(url);
    return { blob, mimeUsed: "image/jpeg", qualityUsed: 0.2 };
  }

  async function exportAll3(requested: "image/png" | "image/jpeg") {
    if (exportingBusy) return;
    setExportingBusy(true);
    setExportLog([]);

    const keys: FormatKey[] = ["SQUARE_1_1", "STORY_9_16", "LANDSCAPE_1_91_1"];
    const original = exportParamsRef.current.formatKey;

    try {
      setIsExporting(true);
      await settleUI();

      const lines: string[] = [];

      for (const k of keys) {
        setFormatKey(k);
        await settleUI();

        const out = await exportWithLimit(requested);
        const ext = out.mimeUsed === "image/png" ? "png" : "jpg";
        const name = `BrandCanvasAI_${k}.${ext}`;

        downloadBlob(out.blob, name);

        const over = out.blob.size > MAX_BYTES ? "OVER" : "OK";
        const q = out.qualityUsed ? ` q=${out.qualityUsed}` : "";
        lines.push(`${k}: ${bytesLabel(out.blob.size)} ${over}${q}`);
        setExportLog((p) => [...p, `${k}: ${bytesLabel(out.blob.size)} ${over}${q}`]);
      }

      showToast({ kind: "ok", msg: "Export complete (3 sizes)" }, 2400);
      // Keep a simple summary popup for demo proof
      alert(`Export complete\n${lines.join("\n")}`);
    } finally {
      setFormatKey(original);
      await settleUI();
      setIsExporting(false);
      setExportingBusy(false);
    }
  }

  const sel = selectedLayer();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800/70 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-9 w-9 rounded-xl bg-slate-900 ring-1 ring-slate-800 grid place-items-center">
                <span className="text-sm font-bold text-slate-100">BC</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold leading-6">BrandCanvas AI Studio</h1>
                  <span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${statusBadge(guardian.status)}`}>
                    {guardian.status}
                  </span>
                  <span className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-slate-800">
                    Export target: under 500 KB
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300">
                  Drag elements, trigger FAIL, apply fixes, export 3 formats.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md bg-slate-900 px-3 py-2 text-sm outline-none ring-1 ring-slate-800"
                value={formatKey}
                onChange={(e) => setFormatKey(e.target.value as FormatKey)}
                disabled={exportingBusy}
              >
                <option value="SQUARE_1_1">1:1 (1080x1080)</option>
                <option value="STORY_9_16">9:16 (1080x1920)</option>
                <option value="LANDSCAPE_1_91_1">1.91:1 (1200x628)</option>
              </select>

              <label className="cursor-pointer rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-white">
                Upload packshot
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    onUploadRemoveBg(f).catch((err) => showToast({ kind: "bad", msg: err.message }, 3200));
                    e.currentTarget.value = "";
                  }}
                  disabled={exportingBusy}
                />
              </label>

              <button
                onClick={addHeadline}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-800"
                disabled={exportingBusy}
              >
                Add headline
              </button>

              <button
                onClick={addSubtext}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-800"
                disabled={exportingBusy}
              >
                Add subtext
              </button>

              <button
                onClick={() => exportAll3("image/jpeg").catch((e) => showToast({ kind: "bad", msg: e.message }, 3200))}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-50"
                disabled={exportingBusy}
              >
                Export JPEG (3)
              </button>

              <button
                onClick={() => exportAll3("image/png").catch((e) => showToast({ kind: "bad", msg: e.message }, 3200))}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-50"
                disabled={exportingBusy}
              >
                Export PNG (3)
              </button>

              <button
                onClick={loadDemoFail}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
                disabled={exportingBusy}
              >
                Load Demo FAIL
              </button>

              <button
                onClick={resetCanvas}
                className="rounded-md bg-slate-950 px-3 py-2 text-sm ring-1 ring-slate-800 hover:bg-slate-900"
                disabled={exportingBusy}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={[
              "max-w-sm rounded-xl px-4 py-3 text-sm ring-1 backdrop-blur",
              toast.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-700/40"
                : toast.kind === "warn"
                ? "bg-amber-500/10 text-amber-200 ring-amber-700/40"
                : "bg-rose-500/10 text-rose-200 ring-rose-700/40",
            ].join(" ")}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-4 md:grid-cols-[1fr_360px]">
          {/* Canvas */}
          <div className="relative">
            <div
              ref={wrapRef}
              className="relative h-[74vh] overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-800"
            >
              {/* Export overlay */}
              {isExporting && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/40 backdrop-blur-sm">
                  <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm ring-1 ring-slate-800">
                    Exporting… downloading 3 files
                  </div>
                </div>
              )}

              <Stage
                ref={stageRef}
                width={viewport.w}
                height={viewport.h}
                onMouseDown={(e) => {
                  const clickedEmpty = e.target === e.target.getStage();
                  if (clickedEmpty) setSelectedId(null);
                }}
                onTouchStart={(e) => {
                  const clickedEmpty = e.target === e.target.getStage();
                  if (clickedEmpty) setSelectedId(null);
                }}
              >
                <Layer>
                  <Group x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
                    <Rect x={0} y={0} width={format.w} height={format.h} fill="#ffffff" />

                    {/* Optional frame (kept subtle) */}
                    {!isExporting && (
                      <Rect
                        x={0}
                        y={0}
                        width={format.w}
                        height={format.h}
                        stroke="#94a3b8"
                        strokeWidth={2}
                        opacity={0.6}
                      />
                    )}

                    {/* Safe zone overlay (hide on export) */}
                    {!isExporting && (
                      <Rect
                        x={guardian.safeRect.x}
                        y={guardian.safeRect.y}
                        width={guardian.safeRect.w}
                        height={guardian.safeRect.h}
                        stroke="#22c55e"
                        dash={[10, 8]}
                        strokeWidth={3}
                        opacity={0.9}
                      />
                    )}

                    {layers.map((l) => {
                      if (l.kind === "image") {
                        return (
                          <ImageNode
                            key={l.id}
                            layer={l}
                            nodeRefs={nodeRefs}
                            onSelect={() => setSelectedId(l.id)}
                            onChange={(p) => updateLayer(l.id, p)}
                          />
                        );
                      }
                      return (
                        <TextNode
                          key={l.id}
                          layer={l}
                          nodeRefs={nodeRefs}
                          onSelect={() => setSelectedId(l.id)}
                          onChange={(p) => updateLayer(l.id, p)}
                        />
                      );
                    })}

                    {/* Hide transformer on export to avoid handles in PNG/JPEG */}
                    {!isExporting && (
                      <Transformer
                        ref={trRef}
                        rotateEnabled={true}
                        boundBoxFunc={(oldBox, newBox) =>
                          newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
                        }
                      />
                    )}
                  </Group>
                </Layer>
              </Stage>

              {/* Small HUD */}
              <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-slate-950/55 px-3 py-2 text-xs text-slate-200 ring-1 ring-slate-800 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Format</span>
                  <span className="text-slate-300">
                    {formatKey === "SQUARE_1_1"
                      ? "1:1"
                      : formatKey === "STORY_9_16"
                      ? "9:16"
                      : "1.91:1"}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300">
                    {format.w}x{format.h}
                  </span>
                </div>
                <div className="mt-1 text-slate-400">
                  Selected:{" "}
                  <span className="text-slate-200">
                    {sel ? (sel.kind === "image" ? "Image" : sel.kind === "disclaimer" ? "Disclaimer" : "Text") : "None"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick actions row */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={fitSelectedToSafeZone}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-50"
                disabled={!selectedId}
              >
                Auto-fit safe zone
              </button>
              <button
                onClick={addDisclaimer}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800"
              >
                Add disclaimer
              </button>
              <button
                onClick={fixMinFont}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-50"
                disabled={!selectedId}
              >
                Fix min font
              </button>
              <button
                onClick={fixContrast}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-50"
                disabled={!selectedId}
              >
                Fix contrast
              </button>
              <button
                onClick={() => selectedId && bringToFront(selectedId)}
                className="rounded-md bg-slate-950 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-50"
                disabled={!selectedId}
              >
                Bring front
              </button>
              <button
                onClick={() => selectedId && sendToBack(selectedId)}
                className="rounded-md bg-slate-950 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-50"
                disabled={!selectedId}
              >
                Send back
              </button>
              <button
                onClick={() => selectedId && removeLayer(selectedId)}
                className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-700/40 hover:bg-rose-500/15 disabled:opacity-50"
                disabled={!selectedId}
              >
                Delete (Del)
              </button>
            </div>
          </div>

          {/* Right panel */}
          <div className="rounded-2xl bg-slate-900 ring-1 ring-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Control Panel</div>
                <div className="text-xs text-slate-400">Compliance + edit + export proof.</div>
              </div>
              <div className={`rounded-lg px-2 py-1 text-xs font-semibold ${statusBadge(guardian.status)}`}>
                {guardian.status}
              </div>
            </div>

            <div className="px-4 pt-3">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setTab("guardian")} className={`rounded-md px-3 py-2 text-xs ${tabBtn(tab === "guardian")}`}>
                  Guardian
                </button>
                <button onClick={() => setTab("properties")} className={`rounded-md px-3 py-2 text-xs ${tabBtn(tab === "properties")}`}>
                  Properties
                </button>
                <button onClick={() => setTab("layers")} className={`rounded-md px-3 py-2 text-xs ${tabBtn(tab === "layers")}`}>
                  Layers
                </button>
              </div>

              {/* Alcohol toggle */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950 p-3 ring-1 ring-slate-800">
                <div className="text-sm">
                  Alcohol product
                  <div className="text-xs text-slate-400">Requires disclaimer</div>
                </div>
                <input
                  type="checkbox"
                  checked={isAlcohol}
                  onChange={(e) => setIsAlcohol(e.target.checked)}
                  className="h-5 w-5 accent-emerald-500"
                />
              </div>
            </div>

            {/* Tab content */}
            <div className="px-4 pb-4 pt-3">
              {tab === "guardian" && (
                <>
                  <div className="text-sm font-semibold">Issues</div>
                  <div className="mt-2 space-y-2">
                    {guardian.issues.length === 0 ? (
                      <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-200 ring-1 ring-slate-800">
                        No issues. Creative is compliant.
                      </div>
                    ) : (
                      guardian.issues.map((i: GuardianIssue, idx: number) => (
                        <button
                          key={`${i.code}-${idx}`}
                          onClick={() => clickIssue(i)}
                          className="w-full rounded-xl bg-slate-950 p-3 text-left text-sm ring-1 ring-slate-800 hover:bg-slate-800"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{i.code}</span>
                            <span className={`text-xs ${i.severity === "FAIL" ? "text-rose-300" : "text-amber-300"}`}>
                              {i.severity}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-300">{i.message}</div>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-950 p-3 text-xs text-slate-400 ring-1 ring-slate-800">
                    Demo flow: Load Demo FAIL -&gt click issue -&gt Auto-fit -&gt Add disclaimer -&gt Fix min font -&gt PASS -&gt Export JPEG (3)
                  </div>
                </>
              )}

              {tab === "properties" && (
                <>
                  <div className="text-sm font-semibold">Selected</div>
                  <div className="mt-2 rounded-xl bg-slate-950 p-3 ring-1 ring-slate-800">
                    {!sel ? (
                      <div className="text-sm text-slate-300">Nothing selected. Click a layer.</div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">
                            {sel.kind === "image" ? "Image" : sel.kind === "disclaimer" ? "Disclaimer" : "Text"}
                          </div>
                          <div className="text-xs text-slate-400">id: {sel.id.slice(0, 8)}…</div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                            <div className="text-slate-400">X</div>
                            <input
                              type="number"
                              value={Math.round(sel.x)}
                              onChange={(e) => updateLayer(sel.id, { x: Number(e.target.value) })}
                              className="mt-1 w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 ring-1 ring-slate-800 outline-none"
                            />
                          </div>
                          <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                            <div className="text-slate-400">Y</div>
                            <input
                              type="number"
                              value={Math.round(sel.y)}
                              onChange={(e) => updateLayer(sel.id, { y: Number(e.target.value) })}
                              className="mt-1 w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 ring-1 ring-slate-800 outline-none"
                            />
                          </div>
                          <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800 col-span-2">
                            <div className="flex items-center justify-between">
                              <div className="text-slate-400">Rotation</div>
                              <div className="text-slate-300">{Math.round(sel.rotation)}°</div>
                            </div>
                            <input
                              type="range"
                              min={-45}
                              max={45}
                              value={sel.rotation}
                              onChange={(e) => updateLayer(sel.id, { rotation: Number(e.target.value) })}
                              className="mt-2 w-full"
                            />
                          </div>
                        </div>

                        {sel.kind === "image" ? (
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                              <div className="text-slate-400">Width</div>
                              <input
                                type="number"
                                value={Math.round(sel.width)}
                                onChange={(e) =>
                                  updateLayer(sel.id, { width: clamp(Number(e.target.value), 20, format.w) })
                                }
                                className="mt-1 w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 ring-1 ring-slate-800 outline-none"
                              />
                            </div>
                            <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                              <div className="text-slate-400">Height</div>
                              <input
                                type="number"
                                value={Math.round(sel.height)}
                                onChange={(e) =>
                                  updateLayer(sel.id, { height: clamp(Number(e.target.value), 20, format.h) })
                                }
                                className="mt-1 w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 ring-1 ring-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="text-xs text-slate-400">Text</div>
                            <textarea
                              value={sel.text}
                              onChange={(e) => updateLayer(sel.id, { text: e.target.value })}
                              rows={3}
                              className="mt-1 w-full resize-none rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-100 ring-1 ring-slate-800 outline-none"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                                <div className="text-slate-400">Font size</div>
                                <input
                                  type="number"
                                  value={sel.fontSize}
                                  onChange={(e) =>
                                    updateLayer(sel.id, { fontSize: clamp(Number(e.target.value), 8, 140) })
                                  }
                                  className="mt-1 w-full rounded-md bg-slate-950 px-2 py-1 text-slate-100 ring-1 ring-slate-800 outline-none"
                                />
                              </div>
                              <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800">
                                <div className="text-slate-400">Color</div>
                                <input
                                  type="color"
                                  value={sel.fill}
                                  onChange={(e) => updateLayer(sel.id, { fill: e.target.value })}
                                  className="mt-2 h-9 w-full rounded-md bg-slate-950 ring-1 ring-slate-800"
                                />
                              </div>
                              <div className="rounded-lg bg-slate-900 p-2 ring-1 ring-slate-800 col-span-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-slate-400">Text width</div>
                                  <div className="text-slate-300">{Math.round(sel.width)} px</div>
                                </div>
                                <input
                                  type="range"
                                  min={80}
                                  max={format.w}
                                  value={sel.width}
                                  onChange={(e) => updateLayer(sel.id, { width: Number(e.target.value) })}
                                  className="mt-2 w-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => bringToFront(sel.id)}
                            className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800"
                          >
                            Bring front
                          </button>
                          <button
                            onClick={() => sendToBack(sel.id)}
                            className="rounded-md bg-slate-900 px-3 py-2 text-xs ring-1 ring-slate-800 hover:bg-slate-800"
                          >
                            Send back
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {tab === "layers" && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Layers</div>
                    <div className="text-xs text-slate-400">{layers.length} total</div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {layers.length === 0 ? (
                      <div className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300 ring-1 ring-slate-800">
                        No layers yet. Upload a packshot or add text.
                      </div>
                    ) : (
                      [...layers].reverse().map((l) => (
                        <button
                          key={l.id}
                          onClick={() => {
                            setSelectedId(l.id);
                            setTab("properties");
                          }}
                          className={[
                            "w-full rounded-xl p-3 text-left ring-1",
                            l.id === selectedId
                              ? "bg-slate-800 ring-slate-600"
                              : "bg-slate-950 ring-slate-800 hover:bg-slate-800",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">
                              {l.kind === "image" ? "Image" : l.kind === "disclaimer" ? "Disclaimer" : "Text"}
                            </div>
                            <div className="text-xs text-slate-400">{l.id.slice(0, 8)}…</div>
                          </div>
                          <div className="mt-1 text-xs text-slate-300">
                            {l.kind === "image"
                              ? `${Math.round(l.width)}x${Math.round(l.height)}`
                              : (l.text || "").slice(0, 42) + ((l.text || "").length > 42 ? "…" : "")}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {exportLog.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-950 p-3 ring-1 ring-slate-800">
                      <div className="text-sm font-semibold">Last export</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-300">
                        {exportLog.map((l, idx) => (
                          <div key={idx}>{l}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-6 text-xs text-slate-500">
          Tip: Drag a layer outside the dashed safe zone to trigger FAIL. Then use Auto-fit + Add disclaimer + Fix min font to reach PASS.
        </div>
      </div>
    </div>
  );
}

function ImageNode(props: {
  layer: ImgLayer;
  nodeRefs: React.MutableRefObject<Record<string, any>>;
  onSelect: () => void;
  onChange: (patch: Partial<ImgLayer>) => void;
}) {
  const { layer, nodeRefs, onSelect, onChange } = props;
  const [img] = useImage(layer.src);

  return (
    <KImage
      image={img}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      draggable
      ref={(node) => {
        if (node) nodeRefs.current[layer.id] = node;
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);

        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(20, node.width() * scaleX),
          height: Math.max(20, node.height() * scaleY),
        });
      }}
    />
  );
}

function TextNode(props: {
  layer: TextLayer;
  nodeRefs: React.MutableRefObject<Record<string, any>>;
  onSelect: () => void;
  onChange: (patch: Partial<TextLayer>) => void;
}) {
  const { layer, nodeRefs, onSelect, onChange } = props;

  return (
    <KText
      text={layer.text}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      fontSize={layer.fontSize}
      fill={layer.fill}
      rotation={layer.rotation}
      draggable
      ref={(node) => {
        if (node) nodeRefs.current[layer.id] = node;
      }}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        node.scaleX(1);

        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: Math.max(80, node.width() * scaleX),
        });
      }}
    />
  );
}
