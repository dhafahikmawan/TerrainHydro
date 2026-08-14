# Raster Analysis Implementation Plan (Slope, NDVI, NDWI)

This document provides a detailed technical plan for implementing the Raster Analysis functions: **Slope**, **NDVI** (Normalized Difference Vegetation Index), and **NDWI** (Normalized Difference Water Index).

The functionality will be implemented in [raster-analysis.ts](file:///src/lib/tha/raster-analysis.ts), using the utility functions from [geotiff-processor.ts](file:///src/lib/utils/geotiff-processor.ts).

---

## Objective

Implement core raster processing logic within the frontend application to generate:
1. **Slope Raster**: Calculated from an elevation DEM using Horn's method (3x3 neighborhood).
2. **NDVI Raster**: Normalized difference of Near-Infrared (NIR) and Red bands.
3. **NDWI Raster**: Normalized difference of Green and Near-Infrared (NIR) bands.

These operations will run in-browser, reading input GeoTIFF files and writing the results back as single-band tiled Float32 GeoTIFF Blobs compatible with the GeoLibre host application.

---

## Constraints and Requirements

- **No Server Dependencies**: All computations must occur client-side in TypeScript.
- **Tiled Float32 Output**: Output rasters must be formatted as tiled Float32 GeoTIFFs using `writeFloat32TiledGeoTIFF` so they are fully compatible with GeoLibre's COG (Cloud Optimized GeoTIFF) layer loader.
- **NoData Value Handling**: Input `noDataValue` tags must be respected. If a pixel (or its required neighbors for neighborhood operations) contains a `noData` value, the corresponding output pixel should be set to a default `noDataValue` of `-9999`.
- **Dimension Check**: For multi-raster operations (NDVI, NDWI), verify that the dimensions (width and height) of both input rasters match. Throw an informative error if they do not.

---

## Technical Details & Formulas

### 1. Slope Calculation (Horn's Method)

Slope represents the rate of maximum change in elevation from each cell. Horn's method uses a 3x3 kernel to compute gradients in the X and Y directions.

Given a 3x3 window of elevation pixels centered at `(c, r)`:
```
[ a  b  c ]
[ d  e  f ]
[ g  h  i ]
```
Where `e` is the cell at `(c, r)`.

#### Algorithm:
1. **Coordinate Clamping**: For border pixels where the 3x3 window falls outside the image, clamp the lookup coordinates to the closest valid pixel index (e.g., `clamp(col, 0, width - 1)` and `clamp(row, 0, height - 1)`).
2. **NoData Check**: If the center cell `e` is `noDataValue` or if any neighboring cells used in the window are `noDataValue`, the output pixel at `(c, r)` is set to `-9999` (NoData).
3. **Resolution Extraction**: Get spatial resolution cell sizes from the `geotransform`:
   - `cellsize_x = Math.abs(geotransform[1])`
   - `cellsize_y = Math.abs(geotransform[5])`
4. **Gradients**:
   - \(\frac{dz}{dx} = \frac{(c + 2f + i) - (a + 2d + g)}{8 \times cellsize\_x}\)
   - \(\frac{dz}{dy} = \frac{(g + 2h + i) - (a + 2b + c)}{8 \times cellsize\_y}\)
5. **Slope (Degrees)**:
   - \(\text{slope\_radians} = \arctan\left(\sqrt{\left(\frac{dz}{dx}\right)^2 + \left(\frac{dz}{dy}\right)^2}\right)\)
   - \(\text{slope\_degrees} = \text{slope\_radians} \times \frac{180}{\pi}\)

---

### 2. NDVI Calculation
Normalized Difference Vegetation Index measures the health/density of vegetation.

$$\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$$

#### Algorithm:
1. Load NIR and Red rasters.
2. Verify matching dimensions.
3. Access individual pixel band values using 1-indexed band numbers:
   - `nirVal = nirData[pixelIdx * nirBandCount + (nirBand - 1)]`
   - `redVal = redData[pixelIdx * redBandCount + (redBand - 1)]`
4. **NoData Check**: If either `nirVal === nirNoData` or `redVal === redNoData`, the output pixel is `-9999`.
5. **Division by Zero**: If `(nirVal + redVal) === 0`, set output to `0` or `noDataValue`.
6. Calculate NDVI and store in output Float32 array.

---

### 3. NDWI Calculation
Normalized Difference Water Index monitors changes in water bodies.

$$\text{NDWI} = \frac{\text{Green} - \text{NIR}}{\text{Green} + \text{NIR}}$$

#### Algorithm:
1. Load NIR and Green rasters.
2. Verify matching dimensions.
3. Access individual pixel band values:
   - `nirVal = nirData[pixelIdx * nirBandCount + (nirBand - 1)]`
   - `greenVal = greenData[pixelIdx * greenBandCount + (greenBand - 1)]`
4. **NoData Check**: If either `nirVal === nirNoData` or `greenVal === greenNoData`, the output pixel is `-9999`.
5. **Division by Zero**: If `(greenVal + nirVal) === 0`, set output to `0` or `noDataValue`.
6. Calculate NDWI and store in output Float32 array.

---

## Proposed Changes

### [Terrain and Hydrological Analysis Core Components]

#### [MODIFY] [raster-analysis.ts](file:///src/lib/tha/raster-analysis.ts)

Update the signatures and implement logic for the three functions:
- `generateSlope(input: File): Promise<Blob>`
- `generateNDVI(nirFile: File, nirBand: number, redFile: File, redBand: number): Promise<Blob>`
- `generateNDWI(nirFile: File, nirBand: number, greenFile: File, greenBand: number): Promise<Blob>`

#### Steps to Implement inside the functions:
1. Call `readRasterFromFile` for each input `File`.
2. Extract metadata and pixel arrays.
3. Allocate a new `Float32Array` of length `width * height` for the output.
4. Iterate through every pixel, applying the corresponding formula and handling bounds, division by zero, and NoData inputs.
5. Create a tiled GeoTIFF using `writeFloat32TiledGeoTIFF` with the processed output data, dimensions, geotransform, crsCode, and 1 band.
6. Return a new `Blob` with type `'image/tiff'` containing the resulting GeoTIFF buffer.

---

## Verification Plan

### Automated Tests
Run vitest suite to ensure that:
1. No existing GeoTIFF parsing or building logic is broken.
2. New test suites verify Slope, NDVI, and NDWI algorithms against simple mocked input arrays.

Run:
```powershell
npm run test
```

### Manual Verification
1. Open the plugin in the GeoLibre host application.
2. Import sample raster(s) via the panel workbench interface.
3. Perform Slope, NDVI, and NDWI generation to verify that the generated layers are successfully displayed as tiled COG layers in GeoLibre.
