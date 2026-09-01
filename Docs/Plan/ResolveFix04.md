# Implementation Plan: Resolve Fix 04

This plan resolves the issues and feature updates described in [Docs/Fix/Fix04.md](../Fix/Fix04.md). It is written with explicit, step-by-step instructions and complete code snippets suitable for a low-cost AI agent or a junior developer.

---

## 1. Problem & Requirement Summary

### Problem 1: Clipped DEM Uses Full Source DEM Bounding Box Instead of Cropped Bounds
- **Current Behavior**:
  - `clipAndComputeStats(...)` in `src/lib/tha/watershed-delineation.ts` allocates a `Float32Array` of full raster dimensions (`width * height`). Cells not belonging to the selected basin are simply filled with `NoData`.
  - In `src/lib/geolibre/right-panel.ts`, the exported GeoTIFF blob is generated using `currentDem.width`, `currentDem.height`, and `currentDem.geotransform`.
  - As a result, the clipped DEM raster layer covers the entire geographic extent and bounding box of the original source DEM, carrying unnecessary raster padding outside the target basin.
- **Required Behavior**:
  - Find the tight minimum bounding box (minimum/maximum row and column indices) containing the cells of the selected basin ID.
  - Crop the raster dimensions to `clippedWidth = maxCol - minCol + 1` and `clippedHeight = maxRow - minRow + 1`.
  - Recalculate the `geotransform` spatial origin (`newOriginX`, `newOriginY`) so that the top-left corner matches `(minCol, minRow)` in world coordinates.
  - Generate the clipped GeoTIFF with the new dimensions (`clippedWidth`, `clippedHeight`) and new `geotransform`.

---

### Update 1: Add Basin Statistics: `Valid Cells`, `No-data cells`, and `Sum`
- **Current Behavior**:
  - `ElevationStatistics` interface and `clipAndComputeStats(...)` only calculate: `min`, `max`, `mean`, `stdDev`, and `count`.
  - The UI in `right-panel.ts` renders only `Min`, `Max`, `Mean`, and `Std dev`, each suffixed with ` m` (meters).
- **Required Behavior**:
  - Extend `ElevationStatistics` interface to include:
    - `sum: number` — total sum of valid elevation values inside the basin.
    - `validCells: number` — count of cells belonging to the selected basin that have valid (non-NoData) elevation values.
    - `noDataCells: number` — count of NoData cells within the clipped DEM bounding box (`clippedWidth * clippedHeight - validCells`).
    - `count: number` — preserved for backwards compatibility (equals `validCells`).
  - Update UI display in `right-panel.ts` to render:
    - `Min` (e.g. `123.45 m`)
    - `Max` (e.g. `678.90 m`)
    - `Mean` (e.g. `345.67 m`)
    - `Std dev` (e.g. `45.67 m`)
    - `Sum` (e.g. `12,345.67 m`)
    - `Valid Cells` (e.g. `1,250` — count formatting, no `m` suffix)
    - `No-data cells` (e.g. `350` — count formatting, no `m` suffix)

---

## 2. Scope of Changes

1. **`src/lib/tha/watershed-delineation.ts`**:
   - Update `ElevationStatistics` interface with `validCells`, `noDataCells`, `sum`.
   - Define `ClippedBasinResult` interface containing `clippedElevation`, `width`, `height`, `geotransform`, and `statistics`.
   - Update `clipAndComputeStats(...)` to accept `geotransform`, calculate minimum bounding box, crop the raster array, compute new spatial origin geotransform, and compute `validCells`, `noDataCells`, and `sum`.
2. **`src/lib/geolibre/right-panel.ts`**:
   - Update the `clipButton` event listener to pass `currentDem.geotransform` into `clipAndComputeStats`.
   - Render the new stats (`Min`, `Max`, `Mean`, `Std dev`, `Sum`, `Valid Cells`, `No-data cells`) with appropriate formatting (unit suffix for elevation vs. integer counts for cells).
   - Generate and add the COG layer using `clipped.width`, `clipped.height`, and `clipped.geotransform`.
3. **`tests/watershed-delineation.test.ts`**:
   - Add unit tests validating cropped bounding box dimensions, geotransform calculations, and the new statistics (`validCells`, `noDataCells`, `sum`).

---

## 3. Step-by-Step Implementation Instructions

### Step 1: Update Interfaces and `clipAndComputeStats` in `src/lib/tha/watershed-delineation.ts`

1. Locate `ElevationStatistics` around line 7 in `src/lib/tha/watershed-delineation.ts` and update it:

```typescript
export interface ElevationStatistics {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  count: number;
  validCells: number;
  noDataCells: number;
  sum: number;
}

export interface ClippedBasinResult {
  clippedElevation: Float32Array;
  width: number;
  height: number;
  geotransform: [number, number, number, number, number, number];
  statistics: ElevationStatistics;
}
```

2. Replace `clipAndComputeStats` (around lines 190–200) with the following bounding-box cropping implementation:

```typescript
/**
 * Clips DEM data to the bounding box of the selected basin ID and computes elevation statistics.
 *
 * @param width - Full DEM width in pixels
 * @param height - Full DEM height in pixels
 * @param filledElevation - Full DEM elevation array (Float32Array)
 * @param basinIdArray - Full basin IDs array (Int32Array)
 * @param selectedBasinId - The target basin ID to clip
 * @param noDataValue - NoData marker value from source DEM
 * @param geotransform - Spatial geotransform [originX, pixelWidth, skewX, originY, skewY, pixelHeight]
 * @returns ClippedBasinResult with cropped elevation raster, new bounding dimensions, new geotransform, and statistics.
 */
export function clipAndComputeStats(
  width: number,
  height: number,
  filledElevation: Float32Array,
  basinIdArray: Int32Array,
  selectedBasinId: number,
  noDataValue: number,
  geotransform: [number, number, number, number, number, number] = [0, 1, 0, 0, 0, -1]
): ClippedBasinResult {
  const outputNoData = canonicalNoData(noDataValue);

  // 1. Find the bounding box (min/max col and row) of the selected basin
  let minCol = width;
  let maxCol = -1;
  let minRow = height;
  let maxRow = -1;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      if (basinIdArray[idx] === selectedBasinId) {
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
      }
    }
  }

  // Handle case where basin ID is not found
  if (maxCol === -1 || maxRow === -1) {
    return {
      clippedElevation: new Float32Array(0),
      width: 0,
      height: 0,
      geotransform: [...geotransform],
      statistics: {
        min: outputNoData,
        max: outputNoData,
        mean: 0,
        stdDev: 0,
        count: 0,
        validCells: 0,
        noDataCells: 0,
        sum: 0,
      },
    };
  }

  const clippedWidth = maxCol - minCol + 1;
  const clippedHeight = maxRow - minRow + 1;

  // 2. Compute new geotransform with origin adjusted to the cropped bounding box top-left corner
  // originX' = originX + minCol * pixelWidth + minRow * skewX
  // originY' = originY + minCol * skewY + minRow * pixelHeight
  const newOriginX = geotransform[0] + minCol * geotransform[1] + minRow * geotransform[2];
  const newOriginY = geotransform[3] + minCol * geotransform[4] + minRow * geotransform[5];
  const newGeotransform: [number, number, number, number, number, number] = [
    newOriginX,
    geotransform[1],
    geotransform[2],
    newOriginY,
    geotransform[4],
    geotransform[5],
  ];

  // 3. Populate cropped elevation raster and compute valid cell stats
  const clippedElevation = new Float32Array(clippedWidth * clippedHeight);
  clippedElevation.fill(outputNoData);

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let validCells = 0;

  for (let r = 0; r < clippedHeight; r++) {
    for (let c = 0; c < clippedWidth; c++) {
      const srcRow = minRow + r;
      const srcCol = minCol + c;
      const srcIndex = srcRow * width + srcCol;
      const dstIndex = r * clippedWidth + c;

      if (basinIdArray[srcIndex] === selectedBasinId) {
        const val = filledElevation[srcIndex];
        if (!isNoData(val, noDataValue)) {
          clippedElevation[dstIndex] = val;
          if (val < min) min = val;
          if (val > max) max = val;
          sum += val;
          validCells++;
        }
      }
    }
  }

  const totalClippedCells = clippedWidth * clippedHeight;
  const noDataCells = totalClippedCells - validCells;
  const mean = validCells > 0 ? sum / validCells : 0;

  // 4. Compute standard deviation
  let squaredDiffSum = 0;
  if (validCells > 0) {
    for (let i = 0; i < clippedElevation.length; i++) {
      const val = clippedElevation[i];
      if (!isNoData(val, outputNoData)) {
        squaredDiffSum += (val - mean) ** 2;
      }
    }
  }
  const stdDev = validCells > 0 ? Math.sqrt(squaredDiffSum / validCells) : 0;

  return {
    clippedElevation,
    width: clippedWidth,
    height: clippedHeight,
    geotransform: newGeotransform,
    statistics: {
      min: validCells > 0 ? min : outputNoData,
      max: validCells > 0 ? max : outputNoData,
      mean,
      stdDev,
      count: validCells,
      validCells,
      noDataCells,
      sum,
    },
  };
}
```

---

### Step 2: Update UI Clipping & Statistics in `src/lib/geolibre/right-panel.ts`

Locate the `Clip & Elevation Statistics` section listener around lines 863–886 in `src/lib/geolibre/right-panel.ts` and replace it with:

```typescript
    const statsSection = section("Clip & Elevation Statistics");
    const basinInput = document.createElement("input");
    basinInput.type = "number";
    basinInput.min = "1";
    basinInput.placeholder = "Basin ID";
    const clipButton = document.createElement("button");
    clipButton.textContent = "Clip Basin";
    const statsGrid = document.createElement("div");
    statsGrid.className = "wd-stats-grid";
    statsSection.append(label("Target basin ID"), basinInput, clipButton, statsGrid);

    clipButton.addEventListener("click", () => {
      if (!currentDem || !currentResult) return;
      const selected = Number(basinInput.value);
      if (!selected || isNaN(selected)) return;

      const clipped = clipAndComputeStats(
        currentDem.width,
        currentDem.height,
        currentResult.filledElevation,
        currentResult.basinIdArray,
        selected,
        currentDem.noDataValue,
        currentDem.geotransform
      );

      statsGrid.textContent = "";

      const statItems: [string, string][] = [
        ["Min", `${clipped.statistics.min.toFixed(2)} m`],
        ["Max", `${clipped.statistics.max.toFixed(2)} m`],
        ["Mean", `${clipped.statistics.mean.toFixed(2)} m`],
        ["Std dev", `${clipped.statistics.stdDev.toFixed(2)} m`],
        ["Sum", `${clipped.statistics.sum.toFixed(2)} m`],
        ["Valid Cells", `${clipped.statistics.validCells.toLocaleString()}`],
        ["No-data cells", `${clipped.statistics.noDataCells.toLocaleString()}`],
      ];

      for (const [name, displayValue] of statItems) {
        const item = document.createElement("div");
        item.className = "wd-stat-item";
        const itemLabel = document.createElement("span");
        itemLabel.className = "wd-stat-label";
        itemLabel.textContent = name;
        const itemValue = document.createElement("span");
        itemValue.className = "wd-stat-value";
        itemValue.textContent = displayValue;
        item.append(itemLabel, itemValue);
        statsGrid.appendChild(item);
      }

      if (_app.addCogLayer && clipped.width > 0 && clipped.height > 0) {
        const clippedBlob = new Blob(
          [
            writeFloat32TiledGeoTIFF(
              clipped.width,
              clipped.height,
              clipped.clippedElevation,
              clipped.geotransform,
              currentDem.crsCode,
              1
            ),
          ],
          { type: "image/tiff" }
        );

        void _app.addCogLayer(
          `Clipped Basin DEM ${selected}`,
          URL.createObjectURL(clippedBlob),
          { colormap: "terrain", nodata: currentDem.noDataValue }
        );
      }
    });
```

---

### Step 3: Add Tests in `tests/watershed-delineation.test.ts`

Add test cases in `tests/watershed-delineation.test.ts` to test bounding box calculation, new geotransform, and all statistics:

```typescript
  it("clips DEM to tight bounding box and computes complete statistics including Valid Cells, No-data cells, and Sum", () => {
    // 5x5 grid with 10m cell size, origin (100, 500)
    const width = 5;
    const height = 5;
    const geotransform: [number, number, number, number, number, number] = [100, 10, 0, 500, 0, -10];
    const noDataValue = -9999;

    // Basin array with Basin ID = 2 occupying row 1..2, col 2..3 (a 2x2 sub-grid)
    const basinIdArray = new Int32Array([
      1, 1, 1, 1, 1,
      1, 1, 2, 2, 1,
      1, 1, 2, 2, 1,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
    ]);

    const filledElevation = new Float32Array([
      10, 10, 10, 10, 10,
      10, 10, 50, 60, 10,
      10, 10, 70, -9999, 10, // one cell in basin is NoData
      10, 10, 10, 10, 10,
      10, 10, 10, 10, 10,
    ]);

    const result = clipAndComputeStats(
      width,
      height,
      filledElevation,
      basinIdArray,
      2,
      noDataValue,
      geotransform
    );

    // Bounding box checks
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.geotransform[0]).toBe(100 + 2 * 10); // newOriginX = 120
    expect(result.geotransform[3]).toBe(500 + 1 * (-10)); // newOriginY = 490
    expect(result.clippedElevation.length).toBe(4);

    // Raster data checks
    expect(result.clippedElevation[0]).toBe(50);
    expect(result.clippedElevation[1]).toBe(60);
    expect(result.clippedElevation[2]).toBe(70);
    expect(result.clippedElevation[3]).toBe(noDataValue);

    // Statistics checks
    expect(result.statistics.validCells).toBe(3);
    expect(result.statistics.noDataCells).toBe(1);
    expect(result.statistics.sum).toBe(180);
    expect(result.statistics.min).toBe(50);
    expect(result.statistics.max).toBe(70);
    expect(result.statistics.mean).toBe(60);
  });
```

---

## 4. Verification Plan

### Automated Tests
Run Vitest on the watershed test suite:
```bash
npx vitest run tests/watershed-delineation.test.ts tests/right-panel.test.ts
```

### Manual Verification
1. Run the local dev server:
   ```bash
   npm run serve:geolibre
   ```
2. Open GeoLibre in the browser, navigate to the **Watershed Delineation** tab, and upload `Docs/Samples/Data/dem.tif`.
3. Click **Run Analysis**.
4. In the **Clip & Elevation Statistics** section, enter a Basin ID (e.g. `1`) and click **Clip Basin**.
5. Verify in the stats grid that the following entries appear:
   - `Min`, `Max`, `Mean`, `Std dev`, `Sum` (formatted with `m`)
   - `Valid Cells`, `No-data cells` (formatted as pure numbers with thousands separators, without `m`)
6. Verify that the newly added `Clipped Basin DEM <id>` raster layer zooms/renders tightly around the selected basin instead of spanning the entire source DEM extent.

---

## 5. Delegation Guidance for Junior Developer / Low-Cost AI Agent

- Do **not** modify the core delineation algorithms (`sinkFill`, `computeD8AndAccumulation`, `extractChannels`, `delineateBasins`, `vectorizeBasins`).
- Ensure `ClippedBasinResult` includes `width`, `height`, and `geotransform` so that `writeFloat32TiledGeoTIFF` receives the cropped raster dimensions rather than `currentDem.width` and `currentDem.height`.
- Remember that `Valid Cells` and `No-data cells` represent unitless integer counts; do not append the ` m` unit suffix to them.
