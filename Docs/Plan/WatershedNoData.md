# Implementation Plan: Fix NoData Handling in Flow Accumulation

This implementation plan provides clear, step-by-step instructions to resolve the bug analyzed in [`Docs/Analysis/WatershedNoData.md`](file:///Docs/Analysis/WatershedNoData.md), where `NoData` cells currently acquire a valid flow accumulation value of `1.0` instead of retaining their `NoData` sentinel / `NaN`.

---

## 1. Problem Overview & Root Cause

### What Went Wrong
1. In [`src/lib/tha/watershed-delineation.ts`](file:///src/lib/tha/watershed-delineation.ts), the function `computeD8AndAccumulation` initializes `accumulation` using `accumulation.fill(1)`.
2. Although `NoData` cells are skipped during slope routing and do not accumulate downstream inflow, unvisited `NoData` cells remain set to `1.0` in the output array.
3. This incorrectly assigns accumulation to ocean/background areas, distorts statistical and zonal calculations, and causes visual bounding-box raster artifacts.

### Expected Behavior
- Cells that are `NoData` in the elevation raster (e.g. `NaN` or `noDataValue`) **must have their flow accumulation set to `noDataValue` (or `NaN`)**.
- Valid terrain cells should start with `1.0` and accumulate upstream flow normally.
- Downstream steps (`extractChannels`, `clipAndComputeStats`, raster export/styling) must properly recognize and skip `NoData` accumulation cells.

---

## 2. Target Files to Modify

| File | Purpose of Change |
| :--- | :--- |
| [`src/lib/tha/watershed-delineation.ts`](file:///src/lib/tha/watershed-delineation.ts) | Ensure `NoData` cells in `computeD8AndAccumulation()` are masked to `noDataValue` / `canonicalNoData(noDataValue)` instead of remaining `1.0`. |
| [`tests/watershed-delineation.test.ts`](file:///tests/watershed-delineation.test.ts) | Add unit tests to verify that `NoData` DEM cells result in `NoData` flow accumulation values. |

---

## 3. Step-by-Step Code Modifications

### Step 1: Update `computeD8AndAccumulation()` in `src/lib/tha/watershed-delineation.ts`

**Location:** Inside `computeD8AndAccumulation()` (around lines 84–114 of `src/lib/tha/watershed-delineation.ts`).

#### Current Code:
```typescript
export function computeD8AndAccumulation(width: number, height: number, filledDEM: Float32Array, noDataValue: number): { flowDirection: Uint8Array; flowAccumulation: Float32Array } {
  const size = width * height, directions = new Uint8Array(size), accumulation = new Float32Array(size), incoming = new Int32Array(size);
  accumulation.fill(1);
  for (let index = 0; index < size; index++) {
    if (isNoData(filledDEM[index], noDataValue)) continue;
    const row = Math.floor(index / width), col = index % width;
    let steepest = 0, target = -1, code = 0;
    for (let direction = 0; direction < 8; direction++) {
      const nextRow = row + ROWS[direction], nextCol = col + COLS[direction];
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
      const next = nextRow * width + nextCol;
      if (isNoData(filledDEM[next], noDataValue)) continue;
      const slope = (filledDEM[index] - filledDEM[next]) / DISTANCES[direction];
      if (slope > steepest) { steepest = slope; code = CODES[direction]; target = next; }
    }
    directions[index] = code;
    if (target >= 0) incoming[target]++;
  }
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
  return { flowDirection: directions, flowAccumulation: accumulation };
}
```

#### Replacement Code:
```typescript
export function computeD8AndAccumulation(width: number, height: number, filledDEM: Float32Array, noDataValue: number): { flowDirection: Uint8Array; flowAccumulation: Float32Array } {
  const size = width * height, directions = new Uint8Array(size), accumulation = new Float32Array(size), incoming = new Int32Array(size);
  const outNoData = canonicalNoData(noDataValue);
  
  // Initialize valid cells to 1.0 and NoData cells to output NoData value
  for (let index = 0; index < size; index++) {
    if (isNoData(filledDEM[index], noDataValue)) {
      accumulation[index] = outNoData;
    } else {
      accumulation[index] = 1;
    }
  }

  for (let index = 0; index < size; index++) {
    if (isNoData(filledDEM[index], noDataValue)) continue;
    const row = Math.floor(index / width), col = index % width;
    let steepest = 0, target = -1, code = 0;
    for (let direction = 0; direction < 8; direction++) {
      const nextRow = row + ROWS[direction], nextCol = col + COLS[direction];
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
      const next = nextRow * width + nextCol;
      if (isNoData(filledDEM[next], noDataValue)) continue;
      const slope = (filledDEM[index] - filledDEM[next]) / DISTANCES[direction];
      if (slope > steepest) { steepest = slope; code = CODES[direction]; target = next; }
    }
    directions[index] = code;
    if (target >= 0) incoming[target]++;
  }

  const queue: number[] = [];
  for (let index = 0; index < size; index++) {
    if (!isNoData(filledDEM[index], noDataValue) && incoming[index] === 0) {
      queue.push(index);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const code = directions[current];
    if (code === 0) continue;
    const next = neighbor(current, code, width, height);
    if (next < 0 || isNoData(filledDEM[next], noDataValue)) continue;
    accumulation[next] += accumulation[current];
    if (--incoming[next] === 0) queue.push(next);
  }

  return { flowDirection: directions, flowAccumulation: accumulation };
}
```

*Explanation*: By initializing `accumulation[index] = outNoData` whenever `isNoData(filledDEM[index], noDataValue)` is true, NoData cells remain designated as NoData rather than carrying a default value of `1.0`.

---

### Step 2: Guard `extractChannels()` in `src/lib/tha/watershed-delineation.ts`

Ensure `extractChannels()` explicitly ignores cells whose accumulation is `NoData` (or whose value is less than the threshold):

**Location:** Around line 121 in `src/lib/tha/watershed-delineation.ts`.

#### Check and Ensure:
```typescript
  for (let index = 0; index < size; index++) {
    if (isNoData(flowAccumulation[index], noDataValue) || flowAccumulation[index] < effectiveThreshold) continue;
    channel[index] = 1;
    const code = flowDirection[index];
    if (code === 0) continue;
    const next = neighbor(index, code, width, height);
    if (next >= 0 && !isNoData(flowAccumulation[next], noDataValue) && flowAccumulation[next] >= effectiveThreshold) { 
      nextCell[index] = next; 
      incoming[next]++; 
    }
  }
```

---

### Step 3: Add Unit Tests in `tests/watershed-delineation.test.ts`

Add a test case specifically checking that NoData values in the DEM remain NoData in the flow accumulation output:

#### Code to Append to `tests/watershed-delineation.test.ts`:
```typescript
  it("preserves NoData values in flow accumulation", () => {
    const width = 3;
    const height = 3;
    const noDataValue = -9999;
    // 3x3 DEM where top row is NoData, bottom 2 rows slope down to bottom-right
    const dem = new Float32Array([
      -9999, -9999, -9999,
         10,     9,     8,
          7,     6,     5,
    ]);

    const filledElevation = sinkFill(width, height, dem, noDataValue);
    const { flowAccumulation } = computeD8AndAccumulation(width, height, filledElevation, noDataValue);

    // NoData pixels must equal noDataValue (or be NaN if noDataValue is NaN)
    expect(flowAccumulation[0]).toBe(noDataValue);
    expect(flowAccumulation[1]).toBe(noDataValue);
    expect(flowAccumulation[2]).toBe(noDataValue);

    // Valid pixels must have accumulation >= 1
    expect(flowAccumulation[3]).toBeGreaterThanOrEqual(1);
    expect(flowAccumulation[8]).toBeGreaterThanOrEqual(1);
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
- All tests pass.
- `dem.tif` test passes with 18 basins.
- `NoData` unit test confirms that cells matching `noDataValue` in the input have `flowAccumulation === noDataValue`.

### Manual / Visual Verification
1. Run the plugin in GeoLibre (`npm run dev`).
2. Run Watershed Delineation on a DEM with irregular boundaries / background `NoData` areas (e.g. islands or clipped boundaries).
3. Verify that the **Flow Accumulation** layer rendered on the map does not display rectangular bounding-box edges around the data, and background areas remain completely transparent.
