# Implementation Plan: Fix Watershed Delineation Result Difference

This implementation plan provides step-by-step instructions to fix the issue analyzed in [`Docs/Analysis/WatershedResDiff.md`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/Docs/Analysis/WatershedResDiff.md), where the current watershed delineation creates 1,437 fragmented subbasins instead of the expected 18 subbasins when tested on `Docs/Samples/Data/dem.tif` with parameters `Z-limit = 1` and `Stream threshold = 100`.

---

## 1. Problem Overview & Root Cause

### What went wrong
1. **Self-referential loop on `flowDirection === 0`**:
   In D8 flow modeling, sink/flat cells (which occur naturally or when `Z-limit` prevents full depression filling) have flow direction code `0`.
   In [`src/lib/tha/watershed-delineation.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/src/lib/tha/watershed-delineation.ts), `neighbor(index, 0, width, height)` does not guard against `code === 0`. It returns `index` (the pixel itself).

2. **False Confluence Junctions in `extractChannels()`**:
   Because `neighbor(index, 0, ...)` returns `index`, channel cells with `code === 0` set `nextCell[index] = index` and increment `incoming[index]++` on themselves.
   When actual upstream tributaries also flow into the cell, `incoming[index]` becomes $\ge 2$. This falsely flags **1,419 flat/sink pixels as stream confluence junctions**, inflating the junction count from 18 to 1,437.

3. **Over-Segmentation in `delineateBasins()`**:
   Each detected junction is treated as a subbasin pour point. As a result, 1,437 micro-basins are generated instead of the true 18 hydrologically meaningful drainage subcatchments.

---

## 2. Target Files to Modify

| File | Purpose of Change |
| :--- | :--- |
| [`src/lib/tha/watershed-delineation.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/src/lib/tha/watershed-delineation.ts) | Fix `neighbor()`, `computeD8AndAccumulation()`, and `extractChannels()` to properly ignore `code === 0` (cells without a downslope neighbor). |
| [`tests/watershed-delineation.test.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/tests/watershed-delineation.test.ts) | Add automated unit tests verifying that `dem.tif` with `zLimit = 1` and `threshold = 100` produces exactly 18 basins matching the reference algorithm. |

---

## 3. Step-by-Step Code Modifications

### Step 1: Update `neighbor()` in `src/lib/tha/watershed-delineation.ts`

**Location:** Around line 40 in `src/lib/tha/watershed-delineation.ts`.

#### Replace This Code:
```typescript
function neighbor(index: number, code: number, width: number, height: number): number {
  const row = Math.floor(index / width), col = index % width;
  let nextRow = row, nextCol = col;
  if (code === 32 || code === 64 || code === 128) nextRow--;
  if (code === 8 || code === 4 || code === 2) nextRow++;
  if (code === 32 || code === 16 || code === 8) nextCol--;
  if (code === 128 || code === 1 || code === 2) nextCol++;
  return nextRow >= 0 && nextRow < height && nextCol >= 0 && nextCol < width ? nextRow * width + nextCol : -1;
}
```

#### With This Code:
```typescript
function neighbor(index: number, code: number, width: number, height: number): number {
  if (code === 0) return -1;
  const row = Math.floor(index / width), col = index % width;
  let nextRow = row, nextCol = col;
  if (code === 32 || code === 64 || code === 128) nextRow--;
  if (code === 8 || code === 4 || code === 2) nextRow++;
  if (code === 32 || code === 16 || code === 8) nextCol--;
  if (code === 128 || code === 1 || code === 2) nextCol++;
  return nextRow >= 0 && nextRow < height && nextCol >= 0 && nextCol < width ? nextRow * width + nextCol : -1;
}
```

*Explanation*: Adding `if (code === 0) return -1;` ensures that cells with no flow direction are explicitly treated as having no downstream neighbor instead of resolving back to themselves.

---

### Step 2: Guard `computeD8AndAccumulation()` in `src/lib/tha/watershed-delineation.ts`

**Location:** Around line 103 in `src/lib/tha/watershed-delineation.ts`.

#### Replace This Code:
```typescript
  const queue: number[] = [];
  for (let index = 0; index < size; index++) if (!isNoData(filledDEM[index], noDataValue) && incoming[index] === 0) queue.push(index);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head], next = neighbor(current, directions[current], width, height);
    if (next < 0) continue;
    accumulation[next] += accumulation[current];
    if (--incoming[next] === 0) queue.push(next);
  }
```

#### With This Code:
```typescript
  const queue: number[] = [];
  for (let index = 0; index < size; index++) if (!isNoData(filledDEM[index], noDataValue) && incoming[index] === 0) queue.push(index);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const code = directions[current];
    if (code === 0) continue;
    const next = neighbor(current, code, width, height);
    if (next < 0 || isNoData(filledDEM[next], noDataValue)) continue;
    accumulation[next] += accumulation[current];
    if (--incoming[next] === 0) queue.push(next);
  }
```

*Explanation*: Adding `if (code === 0) continue;` skips propagating accumulation down non-existent paths for pits and sink cells.

---

### Step 3: Guard `extractChannels()` in `src/lib/tha/watershed-delineation.ts`

**Location:** Around line 120 in `src/lib/tha/watershed-delineation.ts`.

#### Replace This Code:
```typescript
  for (let index = 0; index < size; index++) {
    if (flowAccumulation[index] < effectiveThreshold) continue;
    channel[index] = 1;
    const next = neighbor(index, flowDirection[index], width, height);
    if (next >= 0 && flowAccumulation[next] >= effectiveThreshold) { nextCell[index] = next; incoming[next]++; }
  }
```

#### With This Code:
```typescript
  for (let index = 0; index < size; index++) {
    if (flowAccumulation[index] < effectiveThreshold) continue;
    channel[index] = 1;
    const code = flowDirection[index];
    if (code === 0) continue;
    const next = neighbor(index, code, width, height);
    if (next >= 0 && flowAccumulation[next] >= effectiveThreshold) { nextCell[index] = next; incoming[next]++; }
  }
```

*Explanation*: Explicitly skipping `code === 0` prevents flat/sink cells from linking to downstream neighbors or falsely registering in-degree on themselves.

---

### Step 4: Add Unit Tests in `tests/watershed-delineation.test.ts`

Create or update `tests/watershed-delineation.test.ts` with the following test suite:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fromArrayBuffer } from 'geotiff';
import {
  sinkFill,
  computeD8AndAccumulation,
  extractChannels,
  delineateBasins,
  vectorizeBasins,
} from '../src/lib/tha/watershed-delineation';

describe('Watershed Delineation with Z-limit = 1 and Threshold = 100', () => {
  it('correctly delineates 18 basins on dem.tif without sink self-loop artifacts', async () => {
    const demPath = path.resolve(__dirname, '../Docs/Samples/Data/dem.tif');
    const buffer = fs.readFileSync(demPath).buffer;
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters = await image.readRasters({ interleave: true });
    const rawRaster = rasters as unknown as number[];
    const elevation = new Float32Array(rawRaster.length);
    for (let i = 0; i < rawRaster.length; i++) elevation[i] = rawRaster[i];

    const fd = image.getFileDirectory() as any;
    const noDataValueRaw = fd.getValue?.('GDAL_NODATA') ?? fd['GDAL_NODATA'];
    const noDataValue = noDataValueRaw != null && !Number.isNaN(parseFloat(String(noDataValueRaw)))
      ? parseFloat(String(noDataValueRaw))
      : -9999;
    const pixelScale = fd.getValue?.('ModelPixelScale') ?? fd['ModelPixelScale'];
    const tiepoint = fd.getValue?.('ModelTiepoint') ?? fd['ModelTiepoint'];
    const scaleX = pixelScale ? pixelScale[0] : 1.0;
    const scaleY = pixelScale ? -pixelScale[1] : -1.0;
    const originX = tiepoint ? tiepoint[3] : 0.0;
    const originY = tiepoint ? tiepoint[4] : 0.0;
    const geotransform = [originX, scaleX, 0, originY, 0, scaleY];
    const geoKeys = (image as any).getGeoKeys?.();
    const crsCode = geoKeys?.ProjectedCSTypeGeoKey ?? geoKeys?.GeographicTypeGeoKey ?? 3857;

    // 1. Sink fill with Z-limit = 1
    const filledElevation = sinkFill(width, height, elevation, noDataValue, 1);

    // 2. D8 Flow Direction and Accumulation
    const { flowDirection, flowAccumulation } = computeD8AndAccumulation(
      width,
      height,
      filledElevation,
      noDataValue,
    );

    // 3. Extract channels with threshold = 100
    const { channelNetwork, junctionPoints } = extractChannels(
      width,
      height,
      flowDirection,
      flowAccumulation,
      100,
      geotransform,
      crsCode,
    );

    // Assert junctions: should be exactly 18
    expect(junctionPoints.features.length).toBe(18);

    // 4. Delineate subbasins
    const basinIdArray = delineateBasins(width, height, flowDirection, junctionPoints);

    // 5. Vectorize basins
    const basinPolygons = vectorizeBasins(width, height, basinIdArray, geotransform, crsCode);

    // Assert basins: should be exactly 18
    expect(basinPolygons.features.length).toBe(18);
  });
});
```

---

## 4. Verification Plan

### Automated Test Verification
Run the vitest test suite from the terminal:
```bash
npx vitest run tests/watershed-delineation.test.ts
```

**Expected Result:**
- Test passes: `1 passed (1)`
- Junction points count = `18`
- Watershed basin polygons count = `18`

### UI / Manual Verification
1. Start the plugin development environment or load into GeoLibre.
2. Open the right panel and select method **"Watershed Delineation"**.
3. Upload `Docs/Samples/Data/dem.tif`.
4. Set **Z-limit** to `1`.
5. Set **Stream threshold** to `100`.
6. Click **"Run Analysis"**.
7. Confirm that the status reports **18 subbasin(s) found** and that the basin polygons on the map cleanly cover the major stream tributaries without fragmented micro-polygons.
