# Implementation Plan: Resolve Fix 02

This plan resolves the issues described in [Docs/Fix/Fix02.md](../Fix/Fix02.md). It is intentionally written for a low-cost AI agent or a junior developer: small, explicit steps, focused validation, and no broad refactor.

---

## 1. Problem Summary

The watershed delineation form has three concrete problems:

1. The stream threshold slider overlaps the numeric field, making the control difficult or impossible to use.
2. The `Run Analysis` button remains disabled even after a valid DEM file has already been uploaded.
3. When the button is manually enabled in the browser, clicking it throws `Failed to construct 'URL': Invalid URL` during the analysis startup path.

These are not all the same bug. The first is a layout issue; the second is a state issue; the third is a worker/bootstrap URL issue.

---

## 2. Root Causes to Fix

### A. Layout overlap in the threshold row

The form for "Watershed Delineation" is built in [src/lib/geolibre/right-panel.ts](../../src/lib/geolibre/right-panel.ts).

The slider/number input row is created as a flex container, but the child range element is not given a stable layout contract. The result is that the slider and numeric input compete for the same horizontal space and visually collide.

Likely fix:

- apply a consistent width to the parent row
- give the range input a proper flex ratio
- fix the numeric field width so it cannot push over the slider
- keep the button in a separate, stable layout block after the row

### B. Button stays disabled after file upload

The file upload listener and the enable/disable listener are both attached to the same input, but they do not share the same state update logic.

In the current flow, one listener runs immediately when the file change event fires, while the async DEM load finishes later. The button state is checked before `currentDem` is set, so it remains disabled permanently.

Likely fix:

- move the button state update into a single helper such as `updateRunButtonState()`
- call it after `currentDem = dem` is assigned
- also call it after failed uploads so the button does not remain in a stale disabled state

### C. Invalid URL from worker startup

The analysis startup path reaches the worker creation in [src/lib/tha/watershed-delineation.ts](../../src/lib/tha/watershed-delineation.ts):

```ts
const worker = new Worker(new URL("./delineation.worker.ts", import.meta.url), { type: "module" });
```

When the button is forced on, this constructor can throw the browser error `Failed to construct 'URL': Invalid URL` in the app runtime/build context. This means the issue is not in the watershed algorithm itself; the problem is the worker URL construction before processing actually starts.

Likely fix:

- validate that `import.meta.url` is usable before constructing the worker URL
- avoid relying on a fragile worker path in the browser runtime if it is invalid in this environment
- if necessary, use a safer worker-loading strategy or a confirmed static asset path for the worker file

---

## 3. Scope and Constraints

Keep the change limited to:

- the watershed form setup in [src/lib/geolibre/right-panel.ts](../../src/lib/geolibre/right-panel.ts)
- the watershed worker bootstrap in [src/lib/tha/watershed-delineation.ts](../../src/lib/tha/watershed-delineation.ts)
- minor style tuning in [src/lib/styles/right-panel-styles.ts](../../src/lib/styles/right-panel-styles.ts) if needed

Do not:

- refactor unrelated panels
- rewrite the delineation algorithm without evidence
- broaden the fix into a general UI redesign

---

## 4. Implementation Steps

### Step 1: Reproduce the three issues in the browser

1. Open the plugin.
2. Select "Watershed Delineation".
3. Load a valid DEM file.
4. Confirm the threshold controls overlap.
5. Confirm the `Run Analysis` button stays disabled after upload.
6. Force-enable the button and click it.
7. Confirm the `Invalid URL` error occurs in the worker creation path.

This confirms the issue is a combination of UI layout, stale button state, and worker bootstrap.

### Step 2: Fix the threshold row layout

Edit the watershed form setup in [src/lib/geolibre/right-panel.ts](../../src/lib/geolibre/right-panel.ts):

- keep the row as a flex container with `width: 100%`
- make the slider `flex: 1` and allow it to shrink safely
- set the numeric input to a fixed width such as `82px`
- keep `Run Analysis` in a separate block after the threshold controls

Example structure:

```ts
const thresholdRow = document.createElement("div");
thresholdRow.className = "wd-slider-control";
thresholdRow.style.width = "100%";

const threshold = document.createElement("input");
threshold.type = "range";
threshold.className = "wd-slider";
threshold.style.flex = "1";

const thresholdNumber = document.createElement("input");
thresholdNumber.type = "number";
thresholdNumber.style.width = "82px";
thresholdNumber.style.minWidth = "82px";
```

### Step 3: Fix the stale disabled state

Replace the current ad hoc state logic with one shared update function.

Recommended pattern:

```ts
const updateRunButtonState = () => {
  runButton.disabled = !currentDem;
};

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    currentDem = null;
    updateRunButtonState();
    return;
  }

  try {
    const dem = await readRasterFromFile(file);
    currentDem = dem;
    updateRunButtonState();
    setStatus("DEM loaded. Ready to run analysis.");
  } catch (error) {
    currentDem = null;
    updateRunButtonState();
    setStatus(error instanceof Error ? error.message : "Unable to read DEM.", true);
  }
});
```

This avoids the current race where `currentDem` is still null when the event listener runs.

### Step 4: Fix the worker URL construction

In [src/lib/tha/watershed-delineation.ts](../../src/lib/tha/watershed-delineation.ts), isolate the worker creation so it fails gracefully and clearly.

Suggested approach:

```ts
function createDelineationWorker(): Worker {
  const workerUrl = new URL("./delineation.worker.ts", import.meta.url);
  return new Worker(workerUrl, { type: "module" });
}
```

Then wrap the call in a try/catch and reject with a clear error if the runtime cannot construct the worker URL.

If the environment still reports an invalid URL, replace the runtime URL approach with a safe worker loading method that the app build actually supports. The key is to fix the startup failure before the processing code is considered valid.

### Step 5: Recheck the layout after state is fixed

Once the button state and worker path are corrected, reload the app and verify that:

- the threshold controls do not overlap
- the button becomes enabled after the DEM loads
- clicking the button starts analysis without a URL exception

---

## 5. Styling Update (If Needed)

If the layout still does not behave consistently, adjust [src/lib/styles/right-panel-styles.ts](../../src/lib/styles/right-panel-styles.ts) with small, targeted rules:

```ts
"wd-slider-control": {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  minWidth: "0"
},
"wd-slider": {
  flex: "1",
  minWidth: "0"
}
```

This is intentionally narrow and should not change the overall styling system.

---

## 6. Acceptance Criteria

The task is complete when all of the following are true:

- The stream threshold slider and numeric input sit in the same row without overlap.
- The `Run Analysis` button becomes enabled after a valid DEM upload.
- The button stays clickable when enabled.
- Clicking the button does not throw `Failed to construct 'URL': Invalid URL`.
- The watershed analysis begins successfully for a valid DEM.
- No unrelated panel or raster-analysis behavior regresses.

---

## 7. Suggested Manual Verification Checklist

1. Open the plugin.
2. Select "Watershed Delineation".
3. Load a valid DEM file.
4. Confirm the threshold controls are aligned and usable.
5. Confirm the `Run Analysis` button is enabled.
6. Click the button and verify the analysis starts without a browser URL exception.
7. Verify the result layer or status text appears after processing.

---

## 8. Delegation Guidance for a Junior Developer or Cheap AI Agent

This task is still a good candidate for a small, isolated fix because the bugs are clustered and the likely root causes are narrow:

- UI layout in the watershed form
- stale state logic on the DEM upload
- worker startup URL construction before analysis begins

Do not broaden the task into a full review of the terrain processing engine. The safest path is to fix the three root causes directly and verify the form works end-to-end before stopping.
