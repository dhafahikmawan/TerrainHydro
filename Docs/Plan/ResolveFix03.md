# Implementation Plan: Resolve Fix 03

This plan resolves the issues described in [Docs/Fix/Fix03.md](../Fix/Fix03.md). It is written with explicit, step-by-step instructions suitable for a junior developer or a cost-effective AI agent.

---

## 1. Problem Summary & Root Causes

### Problem 1: MIME Type Error on Module Script (`video/mp2t`)
- **Error message**:
  ```text
  Failed to load module script: The server responded with a non-JavaScript MIME type of "video/mp2t". Strict MIME type checking is enforced for module scripts per HTML spec.
  ```
- **Root Cause**:
  1. In `scripts/serve-geolibre-plugin.mjs`, the development server's MIME type lookup table does not include TypeScript files (`.ts`) or ES module variants (`.mjs`, `.cjs`).
  2. When the browser or Web Worker tries to fetch uncompiled TypeScript files such as `delineation.worker.ts` directly over HTTP, standard Windows / media type handlers associate `.ts` with MPEG-2 Transport Stream (`video/mp2t`).
  3. Strict MIME type checking in modern browsers immediately rejects module/script execution when the MIME type is not `text/javascript` or `application/javascript`.
  4. In addition, when worker initialization fails in certain browser environments or CSP restrictions, `runDelineation` should gracefully degrade to direct in-thread execution instead of crashing the analysis flow.

### Problem 2: Watershed Delineation Slider Overlaps Stream Threshold Input
- **Symptom**: The stream threshold range slider and the numeric input field overlap visually.
- **Root Cause**:
  1. In `src/lib/styles/right-panel-styles.ts`, `styleRightPanelTree` maps all generic `<input>` elements (except range, checkbox, radio) to `right-panel-control`.
  2. `right-panel-control` forces `width: 100%`.
  3. When `styleRightPanelTree` runs during panel rendering, it overrides the inline `82px` width on the number input with `width: 100%`. Since both the slider and the number input are inside a flex container (`wd-slider-control`), two full-width elements collide and push over each other.

---

## 2. Scope of Changes

The changes are strictly limited to:
1. `scripts/serve-geolibre-plugin.mjs` (dev server MIME types)
2. `src/lib/styles/right-panel-styles.ts` (slider & number input styling rules)
3. `src/lib/geolibre/right-panel.ts` (assigning `wd-number-input` class to threshold number input)
4. `src/lib/tha/watershed-delineation.ts` (worker fallback to direct execution)
5. `tests/right-panel.test.ts` (regression tests)

---

## 3. Step-by-Step Implementation Instructions

### Step 1: Update Server MIME Types in `scripts/serve-geolibre-plugin.mjs`

Locate `mimeTypes` in `scripts/serve-geolibre-plugin.mjs` (lines 19-27) and update it to include `.ts`, `.mjs`, `.cjs`, `.tif`, `.tiff`, and `.geojson`:

```javascript
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".cjs", "text/javascript; charset=utf-8"],
  [".ts", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".zip", "application/zip"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".geojson", "application/geo+json; charset=utf-8"],
]);
```

---

### Step 2: Update Input Styles in `src/lib/styles/right-panel-styles.ts`

1. In `RIGHT_PANEL_STYLES`, update `wd-slider-control` and `wd-slider`, and add `wd-number-input`:
```typescript
  "wd-slider-control": {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
  },
  "wd-slider": {
    flex: "1 1 auto",
    minWidth: "0",
  },
  "wd-number-input": {
    boxSizing: "border-box",
    width: "82px",
    minWidth: "82px",
    maxWidth: "82px",
    minHeight: "36px",
    padding: "6px 8px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
    textAlign: "right",
    flex: "0 0 82px",
  },
```

2. In `getRightPanelStyleRoles`, prevent `<input>` with class `wd-number-input` from receiving `right-panel-control` (which sets `width: 100%`):
```typescript
  } else if (tagName === "input") {
    const input = element as HTMLInputElement;
    if (input.type === "range" || classNames.includes("wd-slider")) {
      roles.push("wd-slider");
    } else if (input.type === "checkbox" || input.type === "radio") {
      roles.push("right-panel-checkbox");
    } else if (classNames.includes("wd-number-input")) {
      roles.push("wd-number-input");
    } else {
      roles.push("right-panel-control");
    }
  }
```

---

### Step 3: Assign Class Names in `src/lib/geolibre/right-panel.ts`

In the `Watershed Delineation` form block (around lines 838-842), assign the CSS classes explicitly to both inputs:

```typescript
    const thresholdRow = document.createElement("div");
    thresholdRow.className = "wd-slider-control";

    const threshold = document.createElement("input");
    threshold.type = "range";
    threshold.className = "wd-slider";
    threshold.min = "0";
    threshold.max = "5000";
    threshold.value = "500";

    const thresholdNumber = document.createElement("input");
    thresholdNumber.type = "number";
    thresholdNumber.className = "wd-number-input";
    thresholdNumber.min = "0";
    thresholdNumber.max = "5000";
    thresholdNumber.value = "500";

    threshold.addEventListener("input", () => {
      thresholdNumber.value = threshold.value;
    });
    thresholdNumber.addEventListener("input", () => {
      threshold.value = thresholdNumber.value;
    });

    thresholdRow.append(threshold, thresholdNumber);
    parameterSection.append(label("Stream threshold"), thresholdRow);
```

---

### Step 4: Ensure Direct Execution Fallback in `src/lib/tha/watershed-delineation.ts`

1. Extract direct computation into `runDelineationDirect`:
```typescript
export function runDelineationDirect(
  dem: DemData,
  params: DelineationParams,
  onProgress?: ProgressCallback
): DelineationResult {
  onProgress?.(2, "Sink-filling DEM...");
  const filledElevation = sinkFill(
    dem.width,
    dem.height,
    dem.data,
    dem.noDataValue,
    params.zLimit > 0 ? params.zLimit : Infinity
  );
  onProgress?.(3, "Computing flow direction and accumulation...");
  const flow = computeD8AndAccumulation(
    dem.width,
    dem.height,
    filledElevation,
    dem.noDataValue
  );
  onProgress?.(4, "Extracting channels and junctions...");
  const channels = extractChannels(
    dem.width,
    dem.height,
    flow.flowDirection,
    flow.flowAccumulation,
    params.threshold,
    dem.geotransform,
    dem.crsCode
  );
  onProgress?.(5, "Delineating subbasins...");
  const basinIdArray = delineateBasins(
    dem.width,
    dem.height,
    flow.flowDirection,
    channels.junctionPoints
  );
  onProgress?.(6, "Vectorizing watershed basins...");
  const basinPolygons = vectorizeBasins(
    dem.width,
    dem.height,
    basinIdArray,
    dem.geotransform,
    dem.crsCode
  );
  return { filledElevation, ...flow, ...channels, basinIdArray, basinPolygons };
}
```

2. Wrap worker instantiation inside `runDelineation` to fall back to `runDelineationDirect` if the worker encounters an initialization or script loading error:
```typescript
export async function runDelineation(
  dem: DemData,
  params: DelineationParams,
  onProgress?: ProgressCallback
): Promise<DelineationResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await new Promise<DelineationResult>((resolve, reject) => {
        let worker: Worker;
        try {
          worker = createDelineationWorker();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        activeWorker = worker;
        worker.onmessage = (event: MessageEvent) => {
          if (event.data.type === "PROGRESS") onProgress?.(event.data.step, event.data.msg);
          if (event.data.type === "COMPLETE") {
            worker.terminate();
            activeWorker = null;
            resolve(event.data.payload as DelineationResult);
          }
          if (event.data.type === "ERROR") {
            worker.terminate();
            activeWorker = null;
            reject(new Error(event.data.error));
          }
        };
        worker.onerror = (event) => {
          worker.terminate();
          activeWorker = null;
          reject(new Error(event.message || "Worker initialization/runtime error"));
        };
        worker.postMessage({
          type: "RUN_DELINEATION",
          payload: {
            ...dem,
            elevation: dem.data,
            zLimit: params.zLimit,
            threshold: params.threshold,
          },
        });
      });
    } catch (workerErr) {
      console.warn("Worker failed, falling back to direct computation:", workerErr);
      return runDelineationDirect(dem, params, onProgress);
    }
  }

  return runDelineationDirect(dem, params, onProgress);
}
```

---

### Step 5: Add Unit Tests in `tests/right-panel.test.ts`

Add tests verifying:
1. Stream threshold slider and number input elements retain their assigned layout properties (`width: 82px` on number input and `flex: 1` on slider) after `styleRightPanelTree` execution.
2. `runDelineation` falls back cleanly to direct execution when Worker constructor throws an error or MIME type fails.

---

## 4. Verification Plan

### Automated Tests
Run tests targeting right-panel and watershed delineation:
```bash
npx vitest tests/right-panel.test.ts tests/watershed-delineation.test.ts
```

### Manual Verification
1. Start the server:
   ```bash
   npm run serve:geolibre
   ```
2. Open GeoLibre and install/open the plugin.
3. Switch to **Watershed Delineation**.
4. Check that the **Stream threshold** slider and numeric box sit side-by-side cleanly without any overlap.
5. Upload a DEM GeoTIFF and click **Run Analysis**.
6. Verify analysis completes without any MIME type or module loading error, and outputs the channel network and watershed basin layers.
