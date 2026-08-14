# GeoTIFF Processing Implementation Plan

## Objective

Implement a browser-safe GeoTIFF processing utility that reads an input raster and rewrites it as a tiled Float32 GeoTIFF. The work is restricted to the tile-generation path needed for GeoLibre compatibility and is intended to be manageable by a junior developer or lower-cost AI agent.

This plan is based on the requirements in the analysis document and the current project structure. The target implementation is primarily in:

- /src/lib/utils/geotiff-processor.ts
- /src/lib/tha/raster-analysis.ts

---

## Constraints and Implementation Rules

1. Do not use GDAL or server-side conversion tools.
2. The code must work in the browser and in a Web Worker-safe environment.
3. Output must be a tiled GeoTIFF, not a striped TIFF.
4. Output must be a valid Float32 TIFF compatible with GeoLibre `addCogLayer` expectations.
5. The implementation must preserve georeferencing metadata where possible.
6. The code should be implemented as a small, testable utility module rather than a one-off script.
7. The implementation must handle both already-tiled and non-tiled input rasters.
8. The final output should be a Blob or ArrayBuffer that can later be added as a COG layer in GeoLibre.

---

## Expected End State

The final utility should provide a pipeline like this:

1. Read input File or Blob using `geotiff.js`.
2. Pull width, height, raw pixel data, geotransform, CRS, and NoData metadata.
3. Convert the raster into a tiled Float32 GeoTIFF array buffer.
4. Return a valid `Blob` or `ArrayBuffer` from the processing utility.
5. Allow the project’s raster generation function to return the processed tiled GeoTIFF blob for GeoLibre consumption.

---

## Scope of Work

### In Scope

- Create a reusable GeoTIFF reader/writer helper in `/src/lib/utils/geotiff-processor.ts`
- Produce a tiled Float32 GeoTIFF from a row-major raster array
- Maintain GeoTIFF metadata required by GIS clients
- Integrate the utility into the tile-generation function in `/src/lib/tha/raster-analysis.ts`
- Provide validation checks using `geotiff.js`

### Out of Scope

- Slope algorithm implementation
- Hydrology processing beyond raster conversion
- External library packaging or native binary bundling
- Multi-band or RGB raster support beyond single-band Float32 elevation rasters
- Performance optimization beyond correct tiled output and basic validation

---

## Phase 1: Establish the Shared Utility Contract

### Goal

Define the API and behavior before writing the low-level binary code.

### Tasks

- Create a clear utility interface in `geotiff-processor.ts`.
- Keep the functions small and explicit:
  - `readRasterFromFile(file: File): Promise<RasterSource>`
  - `writeFloat32TiledGeoTIFF(width, height, data, geotransform, crsCode): ArrayBuffer`
  - `generateGeoTIFFBlobFromRaster(...)` or equivalent
- Decide whether the utility returns:
  - `ArrayBuffer` only, or
  - `Blob` plus metadata for downstream UI

### Developer Notes

Prefer returning a raw `ArrayBuffer` from the writer and let the application layer convert it to a `Blob` when needed. This keeps the binary writer testable and reduces UI concerns inside the utility.

### Acceptance Check

- Utility file exists and exports clear functions.
- API is simple enough for a junior developer to understand in one pass.

---

## Phase 2: Read the Input Raster Correctly

### Goal

Parse input GeoTIFF metadata and convert raw raster values into a consistent Float32 array.

### Required Steps

1. Open the file using `fromBlob(file)`.
2. Get the first image with `tiff.getImage()`.
3. Read raster values with `image.readRasters({ interleave: true })`.
4. Convert to `Float32Array`.
5. Read file directory metadata:
   - `ModelPixelScale`
   - `ModelTiepoint`
   - `GeoKeyDirectory`
   - `GDAL_NODATA`
6. Derive geotransform and CRS.
7. Keep a stable fallback for missing metadata.

### Example Metadata Logic

- Use `GDAL_NODATA` when available; otherwise default to `-9999`.
- Default CRS to `3857` unless a GeoKey indicates otherwise.
- Use pixel scale and tiepoint to reconstruct a GeoTIFF transform.

### Known Failure Points

- Do not assume the input file is already tiled.
- Do not assume metadata always exists.
- Do not assume `readRasters` output is already a clean `Float32Array`.
- Do not silently drop projection data.

### Acceptance Check

- The utility can read a sample TIFF and return width/height/data and metadata.
- The reading logic is isolated from the writer logic.

---

## Phase 3: Implement the Tiled GeoTIFF Writer

### Goal

Build a valid little-endian TIFF in memory that uses tile tags instead of strip tags.

### Required Steps

1. Define constants:
   - `TILE_W = 256`
   - `TILE_H = 256`
2. Compute tile counts using `Math.ceil(width / TILE_W)` and `Math.ceil(height / TILE_H)`.
3. Create a `Float32Array` from the source data and normalize it as needed.
4. Reorder the data into tile-major layout.
5. Write TIFF header with little-endian byte order.
6. Build the IFD with all tags in ascending order by Tag ID.
7. Include required tags:
   - 256, 257, 258, 259, 262, 277, 322, 323, 324, 325, 339, 33550, 33922, 34735
8. Write `TileOffsets` and `TileByteCounts` arrays.
9. Write pixel data block with proper alignment.
10. Handle the special `numTiles === 1` case correctly.

### Critical Implementation Detail: Single-tile bug

This is the most likely point of failure for a junior developer or cheap AI agent.

When there is only one tile, the TIFF tag value/offset field is only large enough to store one 4-byte value. In that case, the writer must place the actual offset or byte count directly in the IFD entry instead of writing a pointer offset.

Incorrect pattern:

- write a pointer offset to an array position

Correct pattern:

- if `numTiles === 1`, write the actual value directly into the IFD entry
- otherwise, write an offset pointing to the array

This bug causes `geotiff.js` to read the wrong byte range and fail with out-of-bounds errors.

### Additional Requirements

- Keep metadata arrays aligned on 8-byte boundaries.
- Ensure offsets reflect the real position in the final in-memory buffer.
- Reserve padding bytes as needed before metadata and pixel blocks.
- Write tags in ascending numeric order or GIS readers may reject the TIFF.

### Acceptance Check

- The output buffer can be read back with `geotiff.js` without throwing.
- The image dimensions match the original raster.
- The output is recognized as a tiled TIFF, not a stripped TIFF.
- A one-tile raster does not fail.

---

## Phase 4: Handle the Tile-major Pixel Reordering Logic

### Goal

Convert the row-major input array into tile-major output order.

### Required Data Mapping

For each tile:

1. Compute tile grid coordinates `(tx, ty)`.
2. For each local pixel `(x, y)` inside the tile:
   - Compute absolute pixel location `(imgX, imgY)`
   - If inside bounds, read from source array using row-major indexing: `src[imgY * width + imgX]`
   - Else write `0.0` or a NoData sentinel
3. Append the value in tile-major order.

### Recommended Implementation Pattern

- Precompute `tilesAcross` and `tilesDown`.
- Iterate tile indices i from `0` to `numTiles - 1`.
- For each tile, append the valid pixels into a temporary `Float32Array`.
- Use `Float32Array` so the output buffer matches the expected Float32 TIFF layout.

### Acceptance Check

- The image loads back with the correct shape.
- The output pixel ordering matches the source image after decode.

---

## Phase 5: Integrate with the Raster Tile Generation API

### Goal

Expose the utility through the project’s raster layer generation function in `/src/lib/tha/raster-analysis.ts`, specifically the `generateTiled` implementation.

### Required Outcome

The function should:

- accept an input `File`,
- read the raster,
- write a tiled GeoTIFF,
- return a `Blob` suitable for GeoLibre consumption.

### Suggested Implementation Flow

```ts
export async function generateTiled(input: File): Promise<Blob> {
  const raster = await readRasterFromFile(input);
  const buffer = writeFloat32TiledGeoTIFF(
    raster.width,
    raster.height,
    raster.data,
    raster.geotransform,
    raster.crsCode,
  );
  return new Blob([buffer], { type: 'image/tiff' });
}
```

### Scope Restriction

Do not expand this task into a slope-generation implementation. The placeholder `generateSlope` function is intentionally left alone for now. Only the tile generation path is in scope.

### Acceptance Check

- The function no longer returns a dummy Blob of the source file.
- The output is a GeoTIFF Blob whose payload is a valid tiled TIFF.

---

## Phase 6: Validation and Testing Strategy

### Goal

Prove the output works before calling the implementation complete.

### Minimum Test Set

1. Read a small GeoTIFF input and assert metadata extraction is valid.
2. Write a tiled TIFF from a simple `Float32Array`.
3. Re-open the output using `geotiff.js`.
4. Compare width, height, band count, and a few sample pixels.
5. Test a single-tile raster and a multi-tile raster.
6. Test a file with missing or partially missing metadata.

### High-Value Regression Cases

- width = 1, height = 1
- width = 256, height = 256
- width = 257, height = 257
- large raster with multiple tiles
- a raster with `NoData` values
- a raster with GeoTIFF tags but no explicit CRS metadata

### Recommended Testing Note

The best validation is not a mock; it is a real round-trip read/write cycle with `geotiff.js`. This confirms that the output is readable by the same library used elsewhere in the plugin.

### Acceptance Check

- The round-trip tests pass for at least the standard and edge-case tile layouts.
- No runtime errors occur while decoding the written output.

---

## Phase 7: Implementation Sequence for a Junior Developer / Cheap AI Agent

This is the recommended execution order to reduce mistakes and keep the work manageable.

### Step 1: Build the utility skeleton

- Create the file and define the exported functions.
- Add clear comments and minimal structure.

### Step 2: Implement metadata parsing

- Read file, width, height, data, geotransform, CRS.
- Ensure values default correctly when metadata is missing.

### Step 3: Implement the TIFF writer

- Build the header and IFD.
- Add required tags in sorted order.
- Write tile arrays and pixel block.
- Add the single-tile guard.

### Step 4: Validate the writer with the library

- Use `geotiff.js` to parse the generated file.
- Fix any read errors before moving on.

### Step 5: Integrate the output with the actual plugin logic

- Update the slope/raster processing function to return a Blob.

### Step 6: Run regression tests

- Include at least a single-tile and multi-tile round-trip test.

### Step 7: Final review

- Check for alignment issues.
- Check for invalid offset values.
- Verify output is a tiled Float32 TIFF that GeoLibre can ingest.

---

## Common Pitfalls to Guard Against

- Writing tags in unsorted order
- Writing strip tags instead of tile tags
- Forgetting the single-tile special-case
- Writing pointer offsets when direct values are required
- Using `Uint16Array` or `Int16Array` instead of `Float32Array`
- Ignoring `ModelPixelScale` / `ModelTiepoint` metadata
- Returning the input blob instead of the generated TIFF blob
- Adding file-writing assumptions that are not valid in browser runtime

---

## Definition of Done

The implementation is complete when all of the following are true:

- `/src/lib/utils/geotiff-processor.ts` contains a working, reusable TIFF read/write helper.
- The utility reads a raster file and converts it into a valid tiled Float32 GeoTIFF in memory.
- The output validates through `geotiff.js` without decoding errors.
- The project’s `generateTiled` path returns a valid GeoTIFF Blob instead of a placeholder.
- The implementation works for both single-tile and multi-tile inputs.
- The metadata is preserved enough for GeoLibre to render the output correctly.

---

## Practical Guidance for Execution

This task uses /Docs/Analysis/StripedHandling.md documentation as reference to successful geotiff writer that is implemented in another plugin. Make sure to check the documentation first when there is any confusion during implementation.

This task is small in concept but surprisingly error-prone in implementation. The highest-risk components are:

1. TIFF tag ordering and structure
2. Tile offset length handling for single-tile case
3. Correct pixel reordering into tile-major order
4. Metadata alignment and offset calculations

Because of this, the implementation should be written in small, reviewable steps rather than as one large monolithic function. A good junior developer or a low-cost AI agent can manage the task if it is broken into these phases and validated after each phase.
