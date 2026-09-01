# Implementation Plan: Resolve Fix 06

This implementation plan addresses the update described in [Docs/Fix/Fix06.md](../Fix/Fix06.md). It is written with explicit, step-by-step instructions and complete code snippets suitable for a junior developer or a low-cost AI agent.

---

## 1. Problem & Requirement Summary

### Objective
Update the watershed delineation vector coordinate transformation in `src/lib/tha/watershed-delineation.ts` to use `proj4` instead of the internal, hardcoded custom coordinate conversion math in `reprojectCoords`.

### Background & Current State
- Currently, `src/lib/tha/watershed-delineation.ts` contains a custom helper function:
  ```typescript
  export function reprojectCoords(x: number, y: number, crsCode: number): [number, number] {
    if (crsCode === 4326 || (crsCode >= 4000 && crsCode < 5000)) return [x, y];
    if (crsCode === 3857 || crsCode === 900913 || crsCode === 3785) {
      const halfCircumference = 20037508.342789244;
      const longitude = x / halfCircumference * 180;
      const latitude = Math.max(-85.051129, Math.min(85.051129, (2 * Math.atan(Math.exp(y / halfCircumference * Math.PI)) - Math.PI / 2) * 180 / Math.PI));
      return [longitude, latitude];
    }
    return [x, y];
  }
  ```
- **Limitations**:
  - It only supports EPSG 4326 (pass-through) and Web Mercator (EPSG 3857, 900913, 3785).
  - Any UTM zones (e.g., EPSG 32632, 32633, 32748, 32749), state plane coordinate systems, or other standard projected coordinate reference systems (CRS) fallback to `[x, y]`, which results in invalid GeoJSON coordinates (values outside `[-180, 180]` longitude and `[-90, 90]` latitude).
  - `package.json` already has `"proj4": "^2.22.0"` and `@types/proj4` installed in `dependencies` / `devDependencies`.

### Required Behavior
- In `src/lib/tha/watershed-delineation.ts`, update `reprojectCoords` to transform coordinates from `EPSG:${crsCode}` to `EPSG:4326` (WGS84 `[longitude, latitude]`) using `proj4`.
- Preserve safe fallbacks if the projection transformation fails or if `crsCode` is already `4326` / WGS84 geographic.
- Ensure all vectorization functions (`extractChannels`, `vectorizeBasins`) produce valid WGS84 GeoJSON features across standard projected CRSs supported by `proj4` (e.g. UTM, Web Mercator, Geographic).
- We can acquire the source CRS from the uploaded DEM raster.

---

## 2. Scope of Changes

1. **`src/lib/tha/watershed-delineation.ts`**:
   - Import `proj4` from `"proj4"`.
   - Refactor `reprojectCoords(x: number, y: number, crsCode: number): [number, number]` to utilize `proj4("EPSG:" + crsCode, "EPSG:4326", [x, y])`.
   - Include error handling / fallback to `[x, y]` if `proj4` throws an error for an unknown CRS code or returns non-finite coordinates.
2. **`tests/watershed-delineation.test.ts`**:
   - Add unit tests verifying `reprojectCoords` with:
     - `EPSG:4326` (Geographic CRS)
     - `EPSG:3857` (Web Mercator)
     - `EPSG:32633` or other UTM CRS (e.g., UTM Zone 33N)
     - Unknown / invalid CRS fallback behavior
   - Verify that full delineation and vectorization (`extractChannels` and `vectorizeBasins`) work properly with `proj4`.

---

## 3. Step-by-Step Implementation Instructions

### Step 1: Update `src/lib/tha/watershed-delineation.ts`

1. Open `src/lib/tha/watershed-delineation.ts`.
2. Add the `proj4` import at the top of the file:
   ```typescript
   import proj4 from "proj4";
   ```
3. Locate `reprojectCoords` (lines 45�54):
   ```typescript
   // BEFORE:
   export function reprojectCoords(x: number, y: number, crsCode: number): [number, number] {
     if (crsCode === 4326 || (crsCode >= 4000 && crsCode < 5000)) return [x, y];
     if (crsCode === 3857 || crsCode === 900913 || crsCode === 3785) {
       const halfCircumference = 20037508.342789244;
       const longitude = x / halfCircumference * 180;
       const latitude = Math.max(-85.051129, Math.min(85.051129, (2 * Math.atan(Math.exp(y / halfCircumference * Math.PI)) - Math.PI / 2) * 180 / Math.PI));
       return [longitude, latitude];
     }
     return [x, y];
   }
   ```
4. Replace it with:
   ```typescript
   // AFTER:
   /**
    * Reprojects coordinates from the source raster CRS to WGS84 (EPSG:4326) [longitude, latitude].
    * Utilizes proj4 for wide CRS support, falling back to [x, y] on failure.
    */
   export function reprojectCoords(x: number, y: number, crsCode: number): [number, number] {
     if (crsCode === 4326 || (crsCode >= 4000 && crsCode < 5000)) {
       return [x, y];
     }
     try {
       const [lng, lat] = proj4(`EPSG:${crsCode}`, "EPSG:4326", [x, y]);
       if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
         return [x, y];
       }
       return [lng, lat];
     } catch {
       // If proj4 doesn't recognize the EPSG code or transformation fails, fallback to [x, y]
       return [x, y];
     }
   }
   ```

---

### Step 2: Update Tests in `tests/watershed-delineation.test.ts`

Add test cases to `tests/watershed-delineation.test.ts` to test `reprojectCoords` across multiple coordinate reference systems and ensure `proj4` handles them accurately:

```typescript
import {
  sinkFill,
  computeD8AndAccumulation,
  extractChannels,
  delineateBasins,
  vectorizeBasins,
  clipAndComputeStats,
  reprojectCoords,
} from "../src/lib/tha/watershed-delineation";

describe("reprojectCoords using proj4", () => {
  it("passes through EPSG:4326 coordinates", () => {
    const coords = reprojectCoords(106.8456, -6.2088, 4326);
    expect(coords[0]).toBeCloseTo(106.8456, 4);
    expect(coords[1]).toBeCloseTo(-6.2088, 4);
  });

  it("converts EPSG:3857 Web Mercator to WGS84 coordinates", () => {
    // 0, 0 in EPSG:3857 -> 0, 0 in WGS84
    const origin = reprojectCoords(0, 0, 3857);
    expect(origin[0]).toBeCloseTo(0, 4);
    expect(origin[1]).toBeCloseTo(0, 4);

    // Coordinate in London: ~ -12499.5, 6711364.5 -> ~ -0.1122, 51.5074
    const london = reprojectCoords(-12499.55, 6711364.57, 3857);
    expect(london[0]).toBeCloseTo(-0.1122, 3);
    expect(london[1]).toBeCloseTo(51.5074, 3);
  });

  it("converts UTM EPSG:32633 (UTM Zone 33N) to WGS84 coordinates", () => {
    // 500000, 4649776 in UTM 33N -> ~ 15.0� E, 42.0� N
    const coords = reprojectCoords(500000, 4649776.23, 32633);
    expect(coords[0]).toBeCloseTo(15.0, 2);
    expect(coords[1]).toBeCloseTo(42.0, 2);
  });

  it("falls back gracefully when given an unrecognized CRS code", () => {
    const coords = reprojectCoords(100, 200, 99999999);
    expect(coords).toEqual([100, 200]);
  });
});
```

---

## 4. Verification Plan

### Automated Tests
Run the Vitest test suite to verify the changes:
```bash
npx vitest run tests/watershed-delineation.test.ts
```
Or run all tests:
```bash
npm test
```

### Verification Checklist
- [ ] `proj4` is imported in `src/lib/tha/watershed-delineation.ts`.
- [ ] `reprojectCoords` calls `proj4` with source `EPSG:${crsCode}` and target `"EPSG:4326"`.
- [ ] `reprojectCoords` retains pass-through for `EPSG:4326` and `4000 <= crsCode < 5000`.
- [ ] `reprojectCoords` handles invalid numbers and unknown EPSG codes gracefully with try/catch fallback to `[x, y]`.
- [ ] All tests in `tests/watershed-delineation.test.ts` and the broader test suite pass.
- [ ] Project builds cleanly via `npm run build:lib`.

---

## 5. Delegation Guidance for Junior Developer / Cheap AI Agent

1. **Strict File Scope**:
   - Only edit `src/lib/tha/watershed-delineation.ts` and `tests/watershed-delineation.test.ts`.
   - Do not modify algorithm functions (`sinkFill`, `computeD8AndAccumulation`, `extractChannels`, `delineateBasins`, `vectorizeBasins`, `clipAndComputeStats`).
2. **Import Syntax**:
   - Use standard ESM import `import proj4 from "proj4";`.
3. **No Breaking Signature Changes**:
   - Keep the function signature `export function reprojectCoords(x: number, y: number, crsCode: number): [number, number]` intact.
