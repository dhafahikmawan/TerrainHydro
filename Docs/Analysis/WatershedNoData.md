### Watershed NoData Handling

### Context
Currently, NoData values in the DEM acquires a value for the flow accumulation. Is this expected behavior of Watershed Delineation, or is it not?


### Analysis

#### 1. Summary Answer
**No, this is NOT expected behavior.** 
In standard GIS hydrology and hydrological terrain processing (such as ArcGIS, QGIS/GRASS GIS `r.watershed`, WhiteboxTools, and TauDEM), `NoData` cells must **never** contribute to or receive flow accumulation values. Flow accumulation across `NoData` areas must remain `NoData` (or `NaN` / canonical nodata sentinel).

Assigning a valid accumulation value (such as `1.0` or higher) to `NoData` cells is a bug that corrupts downstream statistics, introduces false drainage networks, and invalidates watershed basin delineation.

---

#### 2. Why Does This Occur? (Algorithmic Cause)

In `src/lib/tha/watershed-delineation.ts` (as well as the reference implementation), flow accumulation is initialized across the entire raster grid buffer:

```typescript
const size = width * height, directions = new Uint8Array(size), accumulation = new Float32Array(size), incoming = new Int32Array(size);
accumulation.fill(1);
```

1. **Uniform Initialization (`fill(1)`):**
   - The array is initialized with `1.0` for **every cell** in the bounding box, including background / nodata cells.
2. **Missing NoData Masking in Output:**
   - Although `NoData` cells are skipped during the D8 steepest-slope search and do not route flow into neighboring cells, the unvisited `NoData` cells retain their initial value of `1` instead of being reset to `NaN` / `noDataValue` (or `0` / nodata sentinel).
3. **Sink Fill Boundary Propagation:**
   - If `NoData` boundaries are not properly segregated or if flat/masked nodata areas have neighbor checks that don't guard against nodata output targets, flow accumulation can also artificially propagate along nodata borders.

---

#### 3. Hydrological and Analytical Impact

1. **False Stream Channel Generation**:
   - Stream extraction checks `flowAccumulation[index] >= threshold`. While threshold is usually $> 100$, if `NoData` cells are given `1`, any low-threshold extraction or queries will identify `NoData` areas as valid headwater terrain.
2. **Distorted Zonal & Basin Statistics**:
   - Upstream area calculations ($A = \text{cell\_count} \times \text{cell\_area}$) will overestimate contributing area by including non-existent land surface pixels.
3. **Invalid Export Rasters & Visual Artifacts**:
   - When rendering flow accumulation maps (e.g., raster styling / COG layers) or exporting GeoTIFFs, background nodata borders appear as low-accumulation upland terrain (value 1) instead of transparent background, creating bounding box border artifacts.

---

#### 4. Expected Standard Hydrological Behavior

| Raster Layer | Valid Terrain Cell | NoData Cell |
| :--- | :--- | :--- |
| **Filled Elevation** | $\ge \text{DEM elevation}$ | `NoData` / `NaN` |
| **Flow Direction (D8)** | Code $\in \{1, 2, 4, 8, 16, 32, 64, 128\}$ (or $0$ for sinks) | `0` (or `NoData`) |
| **Flow Accumulation** | $\ge 1.0$ (Number of draining cells including self) | `NoData` / `NaN` (or explicitly masked out) |
| **Channel / Basin Extraction** | Evaluated based on threshold and flow routing | Strictly excluded from network and subbasins |

---

#### 5. Recommended Solution

In `computeD8AndAccumulation()`:
1. Initialize or mask all `NoData` cells to `noDataValue` (or `NaN`):
```typescript
for (let index = 0; index < size; index++) {
  if (isNoData(filledDEM[index], noDataValue)) {
    accumulation[index] = canonicalNoData(noDataValue); // or NaN / 0
  }
}
```
2. Ensure that any downstream calculation (channel extraction, raster export, styling) skips cells where `isNoData(filledDEM[index], noDataValue) || isNoData(accumulation[index], noDataValue)`.

