# Watershed Delineation Implementation Plan

This document outlines the detailed technical implementation plan for porting the **Watershed Delineation** functionality from `Docs/Samples/Existing Working Plugin Reference/WatershedDelineation/` into the current plugin architecture.

This plan is written with explicit, step-by-step instructions so that a junior developer or an automated AI agent can execute it without ambiguity.

> **CRITICAL REQUIREMENT:** All GeoTIFF reading and writing processes MUST strictly utilize the existing utilities in [geotiff-processor.ts](file:///src/lib/utils/geotiff-processor.ts) (`readRasterFromFile`, `writeFloat32TiledGeoTIFF`, and `generateGeoTIFFBlobFromRaster`). Do NOT import raw `geotiff` directly into the panel or recreate custom GeoTIFF writers.

---

## 1. Objective and Scope

Integrate full end-to-end Watershed Delineation into the right panel workflow:
1. **DEM Ingestion & Validation via `geotiff-processor.ts`**:
   - Use `readRasterFromFile` from `src/lib/utils/geotiff-processor.ts` to parse uploaded GeoTIFF DEM files into a strongly typed `RasterSource` (`width`, `height`, `data` as Float32Array, `geotransform`, `crsCode`, `noDataValue`, `bandCount`).
   - Validate size and dimensions before processing.
   - Generate tiled COG Blob for map preview via `generateGeoTIFFBlobFromRaster` or `writeFloat32TiledGeoTIFF`.
2. **Analysis Pipeline (Steps 2–6)**:
   - **Step 2: Sink Filling** (Wang & Liu priority queue algorithm with Z-limit).
   - **Step 3: D8 Flow Direction & Flow Accumulation** (topological sort propagation).
   - **Step 4: Stream Channel & Junction Extraction** (stream thresholding).
   - **Step 5: Subbasin Delineation** (upstream BFS tracing from junctions).
   - **Step 6: Basin Vectorization** (edge-tracing to GeoJSON polygon linear rings).
3. **Map Visualization & Tiled GeoTIFF Generation**:
   - Write all output rasters (Sink-filled DEM, Flow Accumulation, Subbasins raster, Clipped Basin DEM) as tiled Float32 GeoTIFF buffers using `writeFloat32TiledGeoTIFF` from `geotiff-processor.ts` before adding them via `_app.addCogLayer`.
   - Add channel network and basin polygons as GeoJSON layers via `_app.addGeoJsonLayer`.
4. **Basin Clipping & Elevation Statistics (Steps 7–8)**: Select basin (via input or map click), clip DEM, compute min/max/mean/std-dev, and render interactive statistics.
5. **Download Control**: Enable/disable export buttons (GeoTIFFs, GeoJSONs, CSV stats) via the `ENABLE_DOWNLOAD` flag in `src/lib/geolibre/right-panel.ts`.
6. **Unified Styling**: Ensure all DOM elements and controls integrate seamlessly with `src/lib/styles/right-panel-styles.ts`.

---

## 2. File Architecture & Responsibilities

```
src/
├── lib/
│   ├── styles/
│   │   └── right-panel-styles.ts         # [MODIFY] Add styles for sliders, badges, stats grid, and progress
│   ├── utils/
│   │   └── geotiff-processor.ts          # [EXISTING] Source for readRasterFromFile & writeFloat32TiledGeoTIFF
│   ├── tha/
│   │   ├── watershed-delineation.ts      # [MODIFY] Main coordinator, types, algorithms, and helper exports
│   │   ├── delineation.worker.ts         # [NEW] Web Worker executing CPU-heavy algorithms off the main thread
│   │   └── heap.ts                       # [NEW] MinHeap priority queue data structure
│   └── geolibre/
│       └── right-panel.ts                # [MODIFY] Render form in `loadMethodForm` under "Watershed Delineation"
```

---

## 3. Step-by-Step Implementation Details

### Step 3.1: Data Structures & Helpers (`src/lib/tha/heap.ts`)

Create `src/lib/tha/heap.ts` to provide a generic binary MinHeap for the priority-queue sink fill algorithm.

#### Code Specification:
```typescript
export class MinHeap<T> {
  private data: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get length(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(val: T): void {
    this.data.push(val);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const bottom = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = bottom;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compare(this.data[idx], this.data[parent]) < 0) {
        [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(idx: number): void {
    const len = this.data.length;
    while (true) {
      const left = (idx << 1) + 1;
      const right = left + 1;
      let smallest = idx;

      if (left < len && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < len && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest !== idx) {
        [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
        idx = smallest;
      } else {
        break;
      }
    }
  }
}
```

---

### Step 3.2: Web Worker & Algorithms (`src/lib/tha/delineation.worker.ts`)

Create `src/lib/tha/delineation.worker.ts` to implement the spatial calculation algorithms in a worker thread.

#### Constants & Lookups:
- **D8 Direction Codes**: `[32, 64, 128, 16, 1, 8, 4, 2]`
- **Row / Col Offsets**:
  - `D_ROW = [-1, -1, -1, 0, 0, 1, 1, 1]`
  - `D_COL = [-1, 0, 1, -1, 1, -1, 0, 1]`
- **Euclidean Distance Weight**: `[Math.SQRT2, 1.0, Math.SQRT2, 1.0, 1.0, Math.SQRT2, 1.0, Math.SQRT2]`

#### Algorithms to Implement:
1. `isNoData(val: number, noDataValue: number): boolean`
   - Handles `Number.isNaN(val)` as well as exact equality to `noDataValue`.
2. `canonicalNoData(noDataValue: number): number`
   - Returns `-9999` if `noDataValue` is `NaN`, else `noDataValue`.
3. `reprojectCoords(x: number, y: number, crsCode: number): [number, number]`
   - Reprojects Web Mercator (EPSG: 3857, 900913, 3785) to WGS84 `[lng, lat]` coordinates for GeoJSON layers.
4. `sinkFill(width, height, elevation, noDataValue, zLimit): Float32Array`
   - Priority queue boundary flood (Wang & Liu 2006).
5. `computeD8AndAccumulation(width, height, filledDEM, noDataValue)`
   - Computes steepest downslope direction and resolves accumulation via in-degree topological ordering.
6. `extractChannels(width, height, flowDirection, flowAccumulation, threshold, geotransform, crsCode)`
   - Traces streams where accumulation >= threshold; identifies junction points where `inDegree >= 2`.
7. `delineateBasins(width, height, flowDirection, junctions)`
   - Iterative BFS upstream tracing from each junction index to allocate 1-based subbasin IDs.
8. `vectorizeBasins(width, height, basinIdArray, geotransform, crsCode)`
   - Edge boundary walker creating closed GeoJSON linear rings for polygons.

#### Worker Message Protocol:
- **Listen for**: `{ type: 'RUN_DELINEATION', payload: DelineationPayload }`
- **Post Progress**: `{ type: 'PROGRESS', step: number, msg: string }`
- **Post Completion**: `{ type: 'COMPLETE', payload: DelineationResult }` with transferable buffers `[filledElevation.buffer, flowDirection.buffer, flowAccumulation.buffer, basinIdArray.buffer]`.
- **Post Error**: `{ type: 'ERROR', error: string }`.

---

### Step 3.3: Coordinator & Pipeline Orchestration (`src/lib/tha/watershed-delineation.ts`)

Export types, worker lifecycle controls, and analysis entry points:

#### Type Interfaces:
```typescript
import type { FeatureCollection } from 'geojson';
import type { RasterSource } from '../utils/geotiff-processor';

export type DemData = RasterSource;

export interface DelineationParams {
  zLimit: number;
  threshold: number;
}

export interface DelineationResult {
  filledElevation: Float32Array;
  flowDirection: Uint8Array;
  flowAccumulation: Float32Array;
  channelNetwork: FeatureCollection;
  junctionPoints: FeatureCollection;
  basinIdArray: Int32Array;
  basinPolygons: FeatureCollection;
}

export interface ElevationStatistics {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  count: number;
}

export type ProgressCallback = (step: number, msg: string) => void;
```

#### Functions to Implement:
1. `getWorker(): Worker`
   - Uses `import DelineationWorker from './delineation.worker?worker&inline'` for bundler compatibility.
2. `terminateWorker(): void`
   - Terminates and resets `_worker`.
3. `runDelineation(dem: DemData, params: DelineationParams, onProgress?: ProgressCallback): Promise<DelineationResult>`
   - Spawns/uses worker and returns Promise resolving with `DelineationResult`.
4. `clipAndComputeStats(width: number, height: number, filledElevation: Float32Array, basinIdArray: Int32Array, selectedBasinId: number, noDataValue: number): { clippedElevation: Float32Array; statistics: ElevationStatistics }`
   - Masks the raster to `selectedBasinId` and computes min, max, mean, stdDev, and count.

---

### Step 3.4: GeoTIFF Reading and Writing Standardization

All raster I/O must use functions from `src/lib/utils/geotiff-processor.ts`:

#### 1. Ingesting DEM Files:
```typescript
import { readRasterFromFile, generateGeoTIFFBlobFromRaster, writeFloat32TiledGeoTIFF } from '../utils/geotiff-processor';

// Reading raster metadata and elevation array:
const dem: RasterSource = await readRasterFromFile(file);

// Creating COG blob for map preview:
const sourceDemBlob = await generateGeoTIFFBlobFromRaster(file);
const sourceDemUrl = URL.createObjectURL(sourceDemBlob);
await _app.addCogLayer("Source DEM", sourceDemUrl, {
  colormap: 'terrain',
  nodata: dem.noDataValue,
});
```

#### 2. Writing Output Rasters (Sink-filled, Flow Accumulation, Subbasins, Clipped):
```typescript
function createTiledBlob(data: Float32Array, dem: RasterSource): Blob {
  const buffer = writeFloat32TiledGeoTIFF(
    dem.width,
    dem.height,
    data,
    dem.geotransform,
    dem.crsCode,
    1 // single band Float32
  );
  return new Blob([buffer], { type: 'image/tiff' });
}
```

---

### Step 3.5: Right Panel Styles Registry (`src/lib/styles/right-panel-styles.ts`)

Register the necessary UI styles in `RIGHT_PANEL_STYLES` and update `getRightPanelStyleRoles`:

#### Styles to Add/Verify:
- `"wd-badge"`: Small status badge with variants `wd-badge--ok` (green), `wd-badge--error` (red), `wd-badge--running` (blue/yellow).
- `"wd-slider-control"`: Flex layout row for pairing `<input type="range">` and `<input type="number">`.
- `"wd-stats-grid"`: 2x2 or 4x1 grid layout with background, border, and clear label/value typography for elevation statistics.
- `"wd-stat-item"`, `"wd-stat-label"`, `"wd-stat-value"`: Individual stat item box.
- `"wd-progress"`: Informational progress indicator styling for pipeline steps.

Ensure `getRightPanelStyleRoles` properly maps elements containing `wd-*` or range inputs so `styleRightPanelTree` automatically styles them.

---

### Step 3.6: Right Panel UI Integration (`src/lib/geolibre/right-panel.ts`)

Under `else if (method === "Watershed Delineation")` inside `loadMethodForm(wrapper, method)`:

#### UI Layout & Structure:
1. **Section 1: Input DEM**
   - File input accepting `.tif, .tiff`.
   - Call `readRasterFromFile(file)` to load DEM data.
   - File metadata readout (file name, width x height, pixel count warning if > 16M pixels).
   - Display source DEM on the map using `generateGeoTIFFBlobFromRaster(file)` and `_app.addCogLayer`.
2. **Section 2: Preprocessing & Delineation Parameters**
   - **Z-Limit Input**: `<input type="number" min="0" step="0.1" value="0">` (0 = unlimited).
   - **Stream Threshold Slider + Number**: Range `[0 - 5000]`, default `500`. Sync input and range events.
   - **Run Analysis Button**: Primary button; triggers worker execution with progress reporting.
   - **Progress / Status Element**: Displays real-time step info (e.g. `Step 2: Sink-filling DEM...`).
   - **Result Layer Dispatch (All rasters formatted via `writeFloat32TiledGeoTIFF`)**:
     - *Sink-filled DEM*: `_app.addCogLayer("Sink-filled DEM", URL.createObjectURL(createTiledBlob(result.filledElevation, currentDem)), { colormap: 'terrain', nodata: currentDem.noDataValue })`
     - *Flow Accumulation*: Log-scaled `Math.log1p(acc)` Float32 raster, `_app.addCogLayer("Flow Accumulation", URL.createObjectURL(createTiledBlob(logAcc, currentDem)), { colormap: 'blues' })`
     - *Subbasins (Raster)*: Float32 representation of `result.basinIdArray`, `_app.addCogLayer("Subbasins (Raster)", URL.createObjectURL(createTiledBlob(basinFloat, currentDem)), { colormap: 'rainbow', nodata: 0 })`
     - *Channel Network*: `_app.addGeoJsonLayer("Channel Network", result.channelNetwork)`
     - *Watershed Basins*: `_app.addGeoJsonLayer("Watershed Basins", result.basinPolygons)`
   - **Download Buttons**:
     - Gated by `if (ENABLE_DOWNLOAD)`:
       - `Download filled-dem.tif` (uses `createTiledBlob(result.filledElevation, currentDem)`)
       - `Download flow-accumulation.tif` (uses `createTiledBlob(result.flowAccumulation, currentDem)`)
       - `Download network.geojson`
       - `Download basins.geojson`
3. **Section 3: Clip & Elevation Statistics**
   - **Target Basin ID Input**: Numeric input for target basin.
   - **Interactive Map Click Binding**: Listen to MapLibre `'click'` on layer `'Watershed Basins'` to automatically populate `basinIdInput` and run stats computation.
   - **Clip & Compute Button**: Triggers `clipAndComputeStats`.
   - **Statistics Display Grid**: Renders Min, Max, Mean, and StdDev in meters (`m`).
   - **Clipped Layer & Downloads**:
     - Adds `Clipped Basin DEM` layer to map via `createTiledBlob(clippedElevation, currentDem)`.
     - Downloads `clipped-basin-<id>.tif` and `statistics-basin-<id>.csv` (if `ENABLE_DOWNLOAD` is true).

---

## 4. Edge Cases & Validation Rules

1. **Grid Size Limits**: Max file size 50 MB, Max pixels 16,777,216 ($4096 \times 4096$). Display an error badge if exceeded.
2. **NoData Values**: Handled consistently through `geotiff-processor.ts` and algorithm fallbacks. Unassigned basin areas must be assigned ID `0` or canonical nodata `-9999`.
3. **Stream Threshold Zero**: If threshold is `0`, prevent infinite loops and ensure minimum of 1 cell accumulation for channels.
4. **Non-Projected vs Projected CRS**: Reproject Web Mercator (`3857`) coordinates to `[longitude, latitude]` for GeoJSON vector features.
5. **Worker Lifecycle**: Terminate worker if errors occur or when panel closes to prevent memory leaks. Revoke object URLs created for COG layers when layers are unloaded.

---

## 5. Verification & Testing Plan

### Automated Verification
1. Run existing build and test suite:
   ```powershell
   npm run test
   npm run build:lib
   ```
2. Unit tests for `MinHeap`: Verify ascending order extraction with mixed random inputs.
3. Unit tests for `sinkFill`: Verify depression filling against a small mock grid ($5 \times 5$).
4. Unit tests for `computeD8AndAccumulation` & `delineateBasins`: Verify topological sorting and stream generation.
5. Verify GeoTIFF tiled output: Check that buffers generated by `writeFloat32TiledGeoTIFF` have correct tile tags (322, 323, 324, 325) and valid CRS metadata.

### Manual UI Verification
1. Start local dev server: `npm run dev`.
2. Open the right panel and select `"Watershed Delineation"` from the Geoprocessing dropdown.
3. Upload a sample DEM (e.g. `Docs/Samples/dem.tif`).
4. Validate that the Source DEM is read via `readRasterFromFile` and renders as a tiled COG layer on the map.
5. Adjust stream threshold (e.g., to 250 cells) using both slider and number input; verify two-way synchronization.
6. Click **"Run Analysis"** and verify progress messages through Steps 2 to 6.
7. Confirm all 5 output layers (Sink-filled DEM, Flow Accumulation, Subbasins raster, Channel Network, Watershed Basins) render correctly on the map.
8. Click on a basin polygon on the map:
   - Verify Basin ID auto-populates.
   - Verify elevation statistics (Min, Max, Mean, StdDev) are computed and displayed.
   - Verify Clipped DEM layer is loaded.
9. Verify download buttons appear only when `ENABLE_DOWNLOAD === true` and trigger file downloads generated with `writeFloat32TiledGeoTIFF`.
