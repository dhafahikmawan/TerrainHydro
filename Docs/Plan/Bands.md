# Multi-Band GeoTIFF Implementation Plan

## Objective

Implement the missing multi-band support for GeoTIFF processing so a raster with multiple bands remains multi-band after the conversion pipeline, instead of being downgraded to a single-band output. This plan also adds a utility function that reports the number of bands in a GeoTIFF for use by other modules.

This plan is written so it can be executed by a lower-cost AI agent or a junior developer without needing broad geospatial expertise. The goal is to keep the work narrow, explicit, and testable.

---

## Problem Statement

The project already successfully reads and writes a tiled GeoTIFF, but the current conversion logic drops band information when the input file contains multiple bands. The output TIFF is effectively treated as a single-band raster, which breaks downstream analysis that expects a multi-band dataset.

Additionally, the project needs a safe exported helper that reports how many bands a GeoTIFF contains so other files can use that value without duplicating parsing logic.

---

## Scope

### In Scope

- Update the GeoTIFF reading logic in `src/lib/utils/geotiff-processor.ts`
- Preserve `SamplesPerPixel` / channel count in the output TIFF writer
- Support both single-band and multi-band input rasters
- Export a helper such as `getGeoTIFFBandCount(file: File): Promise<number>`
- Add validation tests using `geotiff.js` round-trips

### Out of Scope

- Rewriting the full raster-analysis pipeline
- Expanding into advanced band math or spectral processing
- Any server-side conversion or GDAL-based tool path
- Refactoring unrelated TIFF utilities beyond this fix

---

## Constraints

1. Must work in the browser runtime.
2. Must not rely on GDAL or any native conversion tool.
3. Must remain compatible with the existing tiled GeoTIFF output pattern.
4. Must preserve geospatial metadata and valid TIFF structure while supporting multiple bands.
5. The implementation should be small and easy to review.
6. Any helper or function added should be obvious enough for a junior developer to understand in a single pass.

---

## Expected End State

After implementation:

1. `readRasterFromFile(file)` returns metadata that includes band information in a reliable way.
2. The TIFF writer preserves the original number of bands instead of silently converting to one band.
3. A public utility exists to report how many bands the raster has.
4. Multi-band inputs round-trip through `geotiff.js` without data loss or dimension mismatch.
5. Existing single-band logic still works without regressions.

---

## Implementation Rules for a Junior Developer or Cheap AI Agent

Follow these rules strictly:

- Do not rewrite the whole TIFF writer from scratch.
- Do not add extra abstraction layers unless they reduce confusion.
- Do not guess band handling; confirm actual TIFF tags and `geotiff.js` behavior.
- Keep every change focused on the reader/writer contract and the `bandCount` utility.
- Validate after each stage using a real file round-trip.

---

## Phase 1: Clarify the Existing Contract

### Goal

Define exactly what the utility must return and what the output TIFF must preserve.

### Tasks

- Review the current GeoTIFF utility shape in `src/lib/utils/geotiff-processor.ts`.
- Confirm the type returned by `readRasterFromFile` and what metadata it currently holds.
- Decide whether the utility should include `bandCount` as a field in the returned raster metadata.
- Decide whether the exported band helper is a separate function or a method on the same utility module.

### Recommended API

Use the existing module pattern and keep the functions explicit:

- `readRasterFromFile(file: File): Promise<RasterSource>`
- `writeFloat32TiledGeoTIFF(width, height, data, geotransform, crsCode, bandCount?)`
- `getGeoTIFFBandCount(file: File): Promise<number>`

### Developer Notes

Do not make a large refactor. The main requirement is consistency: if the input has N bands, the output should preserve N bands.

### Acceptance Check

- The API is clear enough to understand in one read.
- No hidden behavior is required to interpret the contract.

---

## Phase 2: Read the Input Raster and Detect Band Count

### Goal

Determine how many bands are present in the input GeoTIFF and read the correct pixel arrays for each band.

### Required Steps

1. Open the file with `fromBlob(file)`.
2. Get the image with `tiff.getImage()`.
3. Read the band count from the TIFF metadata.
4. Read the raster data in a way that preserves all samples.
5. Confirm whether the current `readRasters({ interleave: true })` call is returning a single-band flattening or full multi-band data.

### Critical Questions to Answer

- Does the library return a flat array with all sample values interleaved by pixel?
- Does the output contain one data block per band, or is it flattened per pixel?
- Is the output in `RGBRGB...` style or `RRR...GGG...` style?

### Implementation Notes

The function should inspect the actual TIFF metadata from the image and not rely solely on assumptions. For example:

- `SamplesPerPixel` or equivalent metadata should be read from the file directory.
- If the value is greater than 1, the writer must preserve that value in the output tags.
- The data layout must match TIFF semantics: multi-band rasters are typically stored as interleaved pixel data unless the file is explicitly planar.

### Acceptance Check

- The utility can report the correct count for a known multi-band input.
- The code correctly distinguishes single-band and multi-band rasters.

---

## Phase 3: Fix Data Flattening and Preserve Band Data

### Goal

Update the conversion logic so that pixel data is not silently reduced to a single band during the generation step.

### Required Steps

1. Confirm the current conversion path writes only one `Float32` sample per pixel.
2. Update the conversion logic to account for `bandCount` when reading and writing raster data.
3. Ensure data layout matches the TIFF spec expected by `geotiff.js` when loading output back.
4. Preserve the original sample count in the output IFD.

### Common Mistake to Avoid

A junior developer may write a loop that only reads and writes the first band, leaving the rest ignored. That is the core bug here.

### Correct Pattern

When the file is multi-band:

- iterate pixel by pixel,
- preserve all bands for each pixel,
- write the data in the same multi-band order expected by TIFF readers,
- set `SamplesPerPixel` to the number of bands in the output.

### Acceptance Check

- A 3-band TIFF stays 3-band after writing and reading back.
- The output pixel values are not collapsed to one band.

---

## Phase 4: Add the Band Count Utility

### Goal

Expose a function for other files to ask: "How many bands does this raster have?"

### Recommended Function Signature

```ts
export async function getGeoTIFFBandCount(file: File): Promise<number>
```

### Requirements

- Use the same `geotiff.js` import path as the existing processing utility.
- Return `1` as the default when band metadata is missing or cannot be read.
- Keep the logic small and isolated so other modules can call it without duplicating TIFF parsing.

### Suggested Implementation

- Open the file with `fromBlob(file)`.
- Get the image.
- Read `SamplesPerPixel` from the TIFF metadata.
- If the metadata is unavailable, default to `1`.
- Return the value.

### Acceptance Check

- The helper returns `1` for single-band rasters.
- The helper returns `N` for multi-band rasters.
- Missing metadata does not crash the app.

---

## Phase 5: Update the TIFF Writer to Handle Band Count

### Goal

Make the output TIFF writer preserve `SamplesPerPixel` and allocate the correct pixel payload size.

### Required Changes

- Update the IFD to set the correct value for `SamplesPerPixel`.
- Adjust pixel-size logic so it accounts for multiple bands.
- Ensure `BitsPerSample` and `SampleFormat` remain consistent with the data type.
- Keep the tile offset and byte count logic correct for the new size.

### Important Note

The current writer may already be correct for single-band output. The work here is to generalize it so the output can preserve a multi-band structure without breaking the tile layout.

### Acceptance Check

- `SamplesPerPixel` in the output equals the input band count.
- The generated TIFF can be read back by `geotiff.js` without dropping channels.

---

## Phase 6: Add Real Regression Tests

### Goal

Prove the fix with actual TIFF round-trip tests instead of mock assertions.

### Minimum Test Set

1. Single-band raster still works.
2. Two-band raster remains two-band after round-trip.
3. Three-band raster remains three-band after round-trip.
4. File with unknown or missing band metadata defaults to 1 instead of crashing.
5. `getGeoTIFFBandCount` returns the expected value for each case.

### Suggested Test Strategy

Use `geotiff.js` to read back the generated output and assert:

- file width and height match input
- `SamplesPerPixel` or equivalent band count matches expected value
- a few sample values are preserved

### Acceptance Check

- At least one multi-band regression test fails before the fix and passes after the fix.
- No test uses fake-only behavior; it must use a real GeoTIFF round trip.

---

## Phase 7: Integration into the Existing Pipeline

### Goal

Use the new band-aware logic in the module that creates tiled output for GeoLibre.

### Required Outcome

- When the plugin receives a multi-band GeoTIFF, the generated tiled TIFF still has multiple bands.
- Any caller that needs band count can use the exported helper without reimplementing TIFF parsing.

### Recommended Integration Pattern

- Read the source file.
- Compute band count.
- Preserve the band count in metadata and output writer.
- Return a valid Blob whose payload is still a GeoTIFF.

### Acceptance Check

- No part of the plugin silently drops band count after conversion.
- Multi-band files continue to behave as multi-band after processing.

---

## Step-by-Step Execution Order for a Junior Developer / Cheap AI Agent

### Step 1: Confirm the bug with a real multi-band input

- Choose a simple multi-band TIFF or create one in tests.
- Confirm the current output loses band count.

### Step 2: Log the TIFF metadata

- Print or inspect `SamplesPerPixel`, `BitsPerSample`, and the read array shape.
- Confirm the data layout before changing the writer.

### Step 3: Add the band-count helper

- Keep the function isolated and small.
- Ensure it returns a safe default when metadata is missing.

### Step 4: Fix the multi-band read/write path

- Propagate band count through the conversion utility.
- Maintain correct values while writing the output TIFF.

### Step 5: Validate with round-trip tests

- Run the real `geotiff.js` read-back tests.
- Fix datalayout or `SamplesPerPixel` issues before moving on.

### Step 6: Final review

- Check that the single-band case still passes.
- Check that no piece of code assumes a single band.

---

## High-Risk Pitfalls

- Reading only the first band and ignoring the rest
- Setting `SamplesPerPixel` incorrectly in the output IFD
- Not preserving the correct data layout for interleaved multi-band pixels
- Returning a Blob whose underlying TIFF is valid but loses band metadata
- Adding a helper that duplicates parsing logic instead of centralizing it
- Refactoring too early instead of fixing the narrow bug first

---

## Definition of Done

The implementation is complete when all of the following are true:

- The GeoTIFF utility preserves multi-band data through conversion.
- The output GeoTIFF stays multi-band when the input is multi-band.
- A helper exists to report the number of bands in a TIFF file.
- The utility works for both single-band and multi-band inputs.
- Real round-trip tests pass using `geotiff.js`.
- The change stays small, readable, and reviewable by a junior developer or low-cost AI agent.

---

## Suggested Review Checklist

Before closing the task, review the following:

- Is the output `SamplesPerPixel` correct?
- Are all bands retained in the writer?
- Does the exported helper default safely when metadata is missing?
- Does the single-band case still work?
- Are the tests real round-trip checks, not mock-only checks?
- Can a junior developer follow the logic without outside context?

---

## Practical Implementation Guidance

This is a focused bug fix, not a redesign. Keep the solution narrow and use the same TIFF conventions already established by the project. The highest-value work is to confirm band count in real input files, preserve that count through the writer, and test the result using actual GeoTIFF decode round-trips.
