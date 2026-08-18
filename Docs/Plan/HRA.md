# Hazard Resistance Analysis (HRA) Implementation Plan

This document outlines a detailed, step-by-step technical plan to implement the **Hazard Resistance Analysis** functionality. The goal is to port the spatial Intersect and Union (`AND`/`OR`) analysis logic from the sample plugin at `/Docs/Samples/Existing Working Plugin Reference/IntersectUnion/` into our current plugin architecture.

---

## 1. Objectives

1. **Core Spatial Operations**:
   - Implement `AND` (Intersection) logic across multiple layer boundaries.
   - Implement `OR` (Union) logic across multiple layer boundaries.
   - Handle clipping of output layers based on the input layer boundaries.
   - Compute `IUA_Intersection` attributes for all resulting features to count how many data layers intersect a given geometry.

2. **User Interface (UI)**:
   - Render the Hazard Resistance Analysis form within the plugin's right panel when the method is `"Terrain & Hydrology Analysis"` and the sub-menu selection is `"Hazard Resistance Analysis"`.
   - Support a dynamic number of data layers (0 to 10).
   - Enable optional file downloads (Final & Intermediate GeoJSON files) based on the existing developer-controlled boolean `ENABLE_DOWNLOAD` in `/src/lib/geolibre/right-panel.ts`.

---

## 2. Component Architecture

We will implement the feature across two main files:
1. **Core Logic**: Added to [`/src/lib/tha/terrain-hydrology.ts`](file:///src/lib/tha/terrain-hydrology.ts) alongside the existing buffer zone analysis code.
2. **UI & Orchestration**: Integrated within the `loadMethodForm` function inside [`/src/lib/geolibre/right-panel.ts`](file:///src/lib/geolibre/right-panel.ts).

---

## 3. Step-by-Step Implementation Guide

### Step 3.1: Port Core Logic to `/src/lib/tha/terrain-hydrology.ts`

Add the type definitions and spatial processing functions to `terrain-hydrology.ts`.

#### 1. Add Type Definitions
Add the following interfaces at the top of [`/src/lib/tha/terrain-hydrology.ts`](file:///src/lib/tha/terrain-hydrology.ts):

```typescript
export interface LoadedLayer {
  name: string;
  data: FeatureCollection<Geometry, GeoJsonProperties>;
}

export interface AnalysisRunResult {
  finalOutput: FeatureCollection<Geometry, GeoJsonProperties>;
  intermediateOutput: FeatureCollection<Geometry, GeoJsonProperties> | null;
}
```

#### 2. Implement Helper Functions
Add the following helper functions for property handling:

```typescript
function prefixProperties(
  properties: Record<string, unknown> | null | undefined,
  prefix: string,
  fillValue?: unknown,
): Record<string, unknown> {
  const normalized = properties ? { ...properties } : {};
  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [
      `${prefix}_${key}`,
      fillValue === undefined ? value : fillValue,
    ]),
  );
}

function shouldPreserveLayerProperties(layerName: string): boolean {
  return layerName === "Intersection" || layerName.startsWith("U_");
}

function getLayerProperties(
  properties: Record<string, unknown> | null | undefined,
  layerName: string,
  fillValue?: unknown,
  isAggregateLayer = false,
): Record<string, unknown> {
  const propsCopy = properties ? { ...properties } : {};
  delete propsCopy["IUA_Intersection"];
  
  if (isAggregateLayer || shouldPreserveLayerProperties(layerName)) {
    return propsCopy;
  }

  return prefixProperties(propsCopy, layerName, fillValue);
}

function generateIUA(
  layerBig: unknown,
  layerSmall: unknown,
  intersect: boolean,
  input: boolean,
  fromInput: boolean
): Record<string, number> {
  const numBig = typeof layerBig === 'number' ? layerBig : 0;
  const numSmall = typeof layerSmall === 'number' ? layerSmall : 0;
  if (input) {
    if (intersect) {
      return { IUA_Intersection: numBig > numSmall ? numBig : numSmall };
    } else {
      if (fromInput) {
        return { IUA_Intersection: 0 };
      } else {
        return { IUA_Intersection: numBig };
      }
    }
  } else {
    if (intersect) {
      return { IUA_Intersection: numBig > numSmall ? numBig + 1 : numSmall + 1 };
    } else {
      return { IUA_Intersection: numBig };
    }
  }
}

function normalizeFinalProperties(
  properties: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties ?? {})) {
    if (key === "Intersection_isIntersection") continue;
    if (key === "IUA_Intersection") {
      normalized[key] = value;
      continue;
    }
    if (key.endsWith("_IUA_Intersection")) continue;
    normalized[key] = value;
  }

  if (normalized.IUA_Intersection == null) {
    normalized.IUA_Intersection = 0;
  }

  return normalized;
}

function initializeIUAIntersection(
  features: Feature<Geometry, GeoJsonProperties>[],
  val: number
): void {
  for (const feature of features) {
    if (!feature.properties) feature.properties = {};
    feature.properties.IUA_Intersection = val;
  }
}
```

#### 3. Implement Dissolve, Intersect, and Union Operations
Add functions to dissolve features, intersect layers, and union layers:

```typescript
export function dissolveLayer(
  features: Feature<Geometry, GeoJsonProperties>[]
): Feature<Polygon | MultiPolygon> | null {
  if (features.length === 0) return null;

  let dissolved: Feature<Polygon | MultiPolygon> | null = turf.feature(
    features[0].geometry as Polygon | MultiPolygon,
    {}
  );

  for (let i = 1; i < features.length; i++) {
    const next = turf.feature(features[i].geometry as Polygon | MultiPolygon, {});
    const fc = turf.featureCollection([dissolved!, next]) as FeatureCollection<Polygon | MultiPolygon>;
    dissolved = turf.union(fc) as Feature<Polygon | MultiPolygon> | null;
    if (!dissolved) return null;
  }

  return dissolved;
}

export function intersectAllLayers(
  layers: LoadedLayer[]
): Feature<Polygon | MultiPolygon> | null {
  if (layers.length === 0) return null;

  let currentIntersection = dissolveLayer(layers[0].data.features);

  for (let i = 1; i < layers.length; i++) {
    if (!currentIntersection) return null;

    const nextDissolved = dissolveLayer(layers[i].data.features);
    if (!nextDissolved) return null;

    const fc = turf.featureCollection([currentIntersection, nextDissolved]) as FeatureCollection<Polygon | MultiPolygon>;
    currentIntersection = turf.intersect(fc) as Feature<Polygon | MultiPolygon> | null;
  }

  return currentIntersection;
}

export function buildUnionFeatureCollection(
  layerA: LoadedLayer,
  layerB: LoadedLayer,
  input: boolean
): FeatureCollection<Geometry, GeoJsonProperties> {
  const features: Feature<Geometry, GeoJsonProperties>[] = [];

  if (!layerA.data.features.length || !layerB.data.features.length) {
    throw new Error("Both layers must contain at least one feature before unioning.");
  }

  const dissolvedA = dissolveLayer(layerA.data.features);
  const dissolvedB = dissolveLayer(layerB.data.features);

  // --- Intersections (per-pair) ---
  for (const featureA of layerA.data.features) {
    for (const featureB of layerB.data.features) {
      const fcPair = turf.featureCollection([
        turf.feature(featureA.geometry as Polygon | MultiPolygon, featureA.properties ?? {}),
        turf.feature(featureB.geometry as Polygon | MultiPolygon, featureB.properties ?? {}),
      ]) as FeatureCollection<Polygon | MultiPolygon>;
      
      const intersection = turf.intersect(fcPair);

      if (intersection?.geometry) {
        const intersectionProperties = {
          ...generateIUA(
            featureA.properties?.IUA_Intersection,
            featureB.properties?.IUA_Intersection,
            true,
            input,
            true
          ),
          ...getLayerProperties(featureA.properties, layerA.name, undefined, layerA.name.startsWith("U_")),
          ...getLayerProperties(featureB.properties, layerB.name, undefined, layerB.name.startsWith("U_")),
        };
        features.push({
          type: "Feature",
          geometry: intersection.geometry,
          properties: intersectionProperties,
        });
      }
    }
  }

  // --- Differences A - B ---
  if (dissolvedB) {
    for (const featureA of layerA.data.features) {
      const featureAWrapped = turf.feature(featureA.geometry as Polygon | MultiPolygon, {});
      const fc = turf.featureCollection([featureAWrapped, dissolvedB]) as FeatureCollection<Polygon | MultiPolygon>;
      const differenceAB = turf.difference(fc);

      if (differenceAB?.geometry) {
        const properties = {
          ...generateIUA(
            featureA.properties?.IUA_Intersection,
            layerB.data.features[0].properties?.IUA_Intersection,
            false,
            input,
            false
          ),
          ...getLayerProperties(featureA.properties, layerA.name, undefined, layerA.name.startsWith("U_")),
          ...getLayerProperties(layerB.data.features[0]?.properties, layerB.name, null, layerB.name.startsWith("U_")),
        };
        features.push({
          type: "Feature",
          geometry: differenceAB.geometry,
          properties,
        });
      }
    }
  }

  // --- Differences B - A ---
  if (dissolvedA) {
    for (const featureB of layerB.data.features) {
      const featureBWrapped = turf.feature(featureB.geometry as Polygon | MultiPolygon, {});
      const fc = turf.featureCollection([featureBWrapped, dissolvedA]) as FeatureCollection<Polygon | MultiPolygon>;
      const differenceBA = turf.difference(fc);

      if (differenceBA?.geometry) {
        const properties = {
          ...generateIUA(
            featureB.properties?.IUA_Intersection,
            layerA.data.features[0].properties?.IUA_Intersection,
            false,
            input,
            true
          ),
          ...getLayerProperties(featureB.properties, layerB.name, undefined, layerB.name.startsWith("U_")),
          ...getLayerProperties(layerA.data.features[0]?.properties, layerA.name, null, layerA.name.startsWith("U_")),
        };
        features.push({
          type: "Feature",
          geometry: differenceBA.geometry,
          properties,
        });
      }
    }
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
```

#### 4. Implement Main Entrypoints
Add the logic to orchestrate AND/OR analysis runs:

```typescript
function buildIntersectionProperties(dataLayers: LoadedLayer[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const layer of dataLayers) {
    const layerProperties = layer.data.features[0]?.properties ?? {};
    for (const [key, value] of Object.entries(layerProperties)) {
      properties[`${layer.name}_${key}`] = value;
    }
  }
  return properties;
}

export function runAndAnalysisWithIntermediate(
  inputLayer: LoadedLayer,
  dataLayers: LoadedLayer[],
  clipToInput: boolean
): AnalysisRunResult {
  const intersection = intersectAllLayers(dataLayers);

  if (!intersection || !intersection.geometry) {
    const resultFeatures = inputLayer.data.features.map((f) => ({
      ...f,
      properties: normalizeFinalProperties({ ...f.properties, IUA_Intersection: 0 }),
    }));
    return {
      finalOutput: { type: "FeatureCollection", features: resultFeatures },
      intermediateOutput: null,
    };
  }

  const intersectionFeature = turf.feature(intersection.geometry as Polygon | MultiPolygon, {});
  const flattened = turf.flatten(turf.featureCollection([intersectionFeature])) as FeatureCollection<Polygon | MultiPolygon>;

  const dlProcessRes: FeatureCollection<Geometry, GeoJsonProperties> = {
    type: "FeatureCollection",
    features: flattened.features.map((feature) => ({
      type: "Feature",
      geometry: feature.geometry,
      properties: { ...buildIntersectionProperties(dataLayers), IUA_Intersection: 0 },
    })),
  };

  initializeIUAIntersection(dlProcessRes.features, dataLayers.length);

  const intersectionLayer: LoadedLayer = {
    name: "Intersection",
    data: dlProcessRes,
  };

  const preprocessedInputLayer: LoadedLayer = {
    name: inputLayer.name,
    data: {
      type: "FeatureCollection",
      features: inputLayer.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, isInputLayer: true, IUA_Intersection: 0 },
      })),
    },
  };

  const unionResult = buildUnionFeatureCollection(intersectionLayer, preprocessedInputLayer, true);

  const finalFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
  for (const feature of unionResult.features) {
    if (!feature.properties) feature.properties = {};

    const isInput = feature.properties[`${inputLayer.name}_isInputLayer`] === true;
    delete feature.properties[`${inputLayer.name}_isInputLayer`];

    if (clipToInput && !isInput) {
      continue;
    }

    feature.properties = normalizeFinalProperties(feature.properties);
    finalFeatures.push(feature);
  }

  return {
    finalOutput: { type: "FeatureCollection", features: finalFeatures },
    intermediateOutput: dlProcessRes,
  };
}

export function runOrAnalysisWithIntermediate(
  inputLayer: LoadedLayer,
  dataLayers: LoadedLayer[],
  clipToInput: boolean
): AnalysisRunResult {
  dataLayers.forEach((dataLayer) => {
    initializeIUAIntersection(dataLayer.data.features, 1);
  });

  if (dataLayers.length === 0) {
    const resultFeatures = inputLayer.data.features.map((f) => ({
      ...f,
      properties: normalizeFinalProperties({ ...f.properties, IUA_Intersection: 0 }),
    }));
    return {
      finalOutput: { type: "FeatureCollection", features: resultFeatures },
      intermediateOutput: null,
    };
  }

  const preprocessedDataLayers = dataLayers.map((layer) => ({
    name: layer.name,
    data: {
      type: "FeatureCollection",
      features: layer.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties },
      })),
    },
  } as LoadedLayer));

  let dataUnion: LoadedLayer = preprocessedDataLayers[0];

  for (let i = 1; i < preprocessedDataLayers.length; i++) {
    const unionFc = buildUnionFeatureCollection(dataUnion, preprocessedDataLayers[i], false);
    dataUnion = {
      name: `U_${i}`,
      data: unionFc,
    };
  }

  const preprocessedInputLayer = {
    name: inputLayer.name,
    data: {
      type: "FeatureCollection",
      features: inputLayer.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, isInputLayer: true, IUA_Intersection: 0 },
      })),
    },
  } as LoadedLayer;

  const finalUnionFc = buildUnionFeatureCollection(dataUnion, preprocessedInputLayer, true);

  const finalFeatures: Feature<Geometry, GeoJsonProperties>[] = [];

  for (const feature of finalUnionFc.features) {
    if (!feature.properties) feature.properties = {};

    const isInput = feature.properties[`${inputLayer.name}_isInputLayer`] === true;
    delete feature.properties[`${inputLayer.name}_isInputLayer`];

    if (clipToInput && !isInput) {
      continue;
    }

    feature.properties = normalizeFinalProperties(feature.properties);
    finalFeatures.push(feature);
  }

  return {
    finalOutput: { type: "FeatureCollection", features: finalFeatures },
    intermediateOutput: dataUnion.data,
  };
}
```

---

### Step 3.2: Integrate the Form UI into `/src/lib/geolibre/right-panel.ts`

Find `else if(method ==="Hazard Resistance Analysis")` around line 1230 in `/src/lib/geolibre/right-panel.ts` and replace it with the form drawing, file handling, and action logic.

#### 1. Import Core Functions
Ensure the new processing functions are imported at the top of `/src/lib/geolibre/right-panel.ts`:

```typescript
import {
  runAndAnalysisWithIntermediate,
  runOrAnalysisWithIntermediate,
  type LoadedLayer
} from '../tha/terrain-hydrology';
```

#### 2. Implement the UI Form Renderer
Fill in the `else if(method === "Hazard Resistance Analysis")` branch with the following:

```typescript
  else if(method ==="Hazard Resistance Analysis"){
    const form = document.createElement("form");
    form.className = "geoprocessing-form";

    // ── Input Layer File Field ──
    const inputLayerWrapper = document.createElement("div");
    const inputLayerInput = document.createElement("input");
    inputLayerInput.type = "file";
    inputLayerInput.accept = ".geojson,.json,application/geo+json";
    inputLayerInput.className = "spatio-file-input";
    inputLayerWrapper.appendChild(inputLayerInput);

    // ── Data Layers Count Field ──
    const countWrapper = document.createElement("div");
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "0";
    countInput.max = "10";
    countInput.value = "0";
    countInput.className = "spatio-file-input"; // Reuse design styles
    countWrapper.appendChild(countInput);

    // ── Container for dynamic data layers file inputs ──
    const dataLayersContainer = document.createElement("div");

    // ── Method Selector (AND / OR) ──
    const methodWrapper = document.createElement("div");
    const methodSelect = document.createElement("select");
    methodSelect.className = "spatio-file-input";
    drawAnalysisMethods(methodSelect, ["OR", "AND"], ["OR (Union)", "AND (Intersection)"]);
    methodWrapper.appendChild(methodSelect);

    // ── Clip Checkbox ──
    const clipWrapper = document.createElement("div");
    const clipCheckbox = document.createElement("input");
    clipCheckbox.type = "checkbox";
    clipCheckbox.id = "hra-clip-checkbox";
    const clipLabel = document.createElement("label");
    clipLabel.htmlFor = "hra-clip-checkbox";
    clipLabel.textContent = " Clip output features to input layer boundaries";
    clipLabel.style.marginLeft = "8px";
    clipWrapper.append(clipCheckbox, clipLabel);

    // ── Output layer name input ──
    const outputNameWrapper = document.createElement("div");
    const outputNameInput = document.createElement("input");
    outputNameInput.type = "text";
    outputNameInput.value = "hazard_resistance_output";
    outputNameInput.className = "spatio-file-input";
    outputNameWrapper.appendChild(outputNameInput);

    // ── Status Element ──
    const statusEl = document.createElement("div");
    statusEl.className = "geoprocessing-status";
    statusEl.style.marginTop = "10px";

    // ── Action Buttons Container ──
    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "na-actions-section";
    actionsWrapper.style.display = "flex";
    actionsWrapper.style.flexDirection = "column";
    actionsWrapper.style.gap = "8px";
    actionsWrapper.style.marginTop = "15px";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "na-btn na-btn--primary";
    analyzeBtn.textContent = "Run Analysis";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "na-btn na-btn--secondary";
    resetBtn.textContent = "Reset Form";

    actionsWrapper.append(analyzeBtn, resetBtn);

    // ── Optional Download Buttons (controlled by ENABLE_DOWNLOAD) ──
    let downloadFinalBtn: HTMLButtonElement | null = null;
    let downloadIntermediateBtn: HTMLButtonElement | null = null;

    if (ENABLE_DOWNLOAD) {
      downloadFinalBtn = document.createElement("button");
      downloadFinalBtn.type = "button";
      downloadFinalBtn.className = "na-btn na-btn--secondary";
      downloadFinalBtn.textContent = "Download Final GeoJSON";
      downloadFinalBtn.disabled = true;

      downloadIntermediateBtn = document.createElement("button");
      downloadIntermediateBtn.type = "button";
      downloadIntermediateBtn.className = "na-btn na-btn--secondary";
      downloadIntermediateBtn.textContent = "Download Intermediate GeoJSON";
      downloadIntermediateBtn.disabled = true;

      actionsWrapper.append(downloadFinalBtn, downloadIntermediateBtn);
    }

    // ── Form State ──
    let inputLayerFile: File | null = null;
    const dataLayerFiles: (File | null)[] = [];
    let finalOutput: FeatureCollection<Geometry, GeoJsonProperties> | null = null;
    let intermediateOutput: FeatureCollection<Geometry, GeoJsonProperties> | null = null;
    let registeredLayerId: string | null = null;

    const setStatus = (message: string, isError = false) => {
      statusEl.textContent = message;
      statusEl.style.color = isError ? "#dc2626" : "#4b5563";
    };

    const clearPreviousLayer = () => {
      if (registeredLayerId && app.removeLayer) {
        app.removeLayer(registeredLayerId);
        registeredLayerId = null;
      }
    };

    const updateDownloadButtons = () => {
      if (downloadFinalBtn) downloadFinalBtn.disabled = !finalOutput;
      if (downloadIntermediateBtn) downloadIntermediateBtn.disabled = !intermediateOutput;
    };

    // ── Dynamic Input Builder for Data Layers ──
    const rebuildDataLayerInputs = () => {
      dataLayersContainer.innerHTML = "";
      const count = Math.max(0, Math.min(10, parseInt(countInput.value, 10) || 0));
      dataLayerFiles.length = count;

      for (let i = 0; i < count; i++) {
        const itemField = document.createElement("div");
        itemField.style.marginTop = "8px";

        const label = document.createElement("label");
        label.textContent = `Data Layer ${i + 1}`;
        label.className = "geoprocessing-field-label";

        const fileIn = document.createElement("input");
        fileIn.type = "file";
        fileIn.accept = ".geojson,.json,application/geo+json";
        fileIn.className = "spatio-file-input";

        fileIn.addEventListener("change", () => {
          dataLayerFiles[i] = fileIn.files?.[0] || null;
        });

        itemField.append(label, fileIn);
        dataLayersContainer.appendChild(itemField);
      }
    };

    // ── Event Listeners ──
    inputLayerInput.addEventListener("change", () => {
      inputLayerFile = inputLayerInput.files?.[0] || null;
    });

    countInput.addEventListener("change", rebuildDataLayerInputs);

    // ── Helper to read File to GeoJSON ──
    const readFileAsGeoJson = async (file: File): Promise<LoadedLayer> => {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.type !== "FeatureCollection") {
        throw new Error(`File ${file.name} is not a valid GeoJSON FeatureCollection`);
      }
      return {
        name: file.name.replace(/\.[^/.]+$/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        data: parsed,
      };
    };

    // ── Helper to trigger Browser Download ──
    const triggerDownload = (filename: string, content: FeatureCollection<Geometry, GeoJsonProperties>) => {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    // ── Reset Handler ──
    resetBtn.addEventListener("click", () => {
      form.reset();
      inputLayerFile = null;
      dataLayerFiles.length = 0;
      finalOutput = null;
      intermediateOutput = null;
      rebuildDataLayerInputs();
      clearPreviousLayer();
      updateDownloadButtons();
      setStatus("Form cleared. Upload new layers to analyze.");
    });

    // ── Analyze Handler ──
    analyzeBtn.addEventListener("click", async () => {
      try {
        setStatus("Processing spatial analysis...");
        analyzeBtn.disabled = true;

        if (!inputLayerFile) {
          throw new Error("Please upload an Input Layer.");
        }

        const count = dataLayerFiles.length;
        for (let i = 0; i < count; i++) {
          if (!dataLayerFiles[i]) {
            throw new Error(`Please upload a GeoJSON file for Data Layer ${i + 1}.`);
          }
        }

        const inputLayer = await readFileAsGeoJson(inputLayerFile);
        const dataLayers = await Promise.all(
          dataLayerFiles.map(file => readFileAsGeoJson(file!))
        );

        const methodVal = methodSelect.value;
        const clipToInput = clipCheckbox.checked;

        clearPreviousLayer();

        const result = methodVal === "AND"
          ? runAndAnalysisWithIntermediate(inputLayer, dataLayers, clipToInput)
          : runOrAnalysisWithIntermediate(inputLayer, dataLayers, clipToInput);

        finalOutput = result.finalOutput;
        intermediateOutput = result.intermediateOutput;
        updateDownloadButtons();

        if (app.addGeoJsonLayer) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          const layerId = app.addGeoJsonLayer(outName, finalOutput);
          registeredLayerId = layerId || outName;
          setStatus(`Success! Added layer "${outName}" to map.`);
        } else {
          setStatus("Analysis complete. (Note: host app does not support displaying layers).");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), true);
      } finally {
        analyzeBtn.disabled = false;
      }
    });

    if (downloadFinalBtn) {
      downloadFinalBtn.addEventListener("click", () => {
        if (finalOutput) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          triggerDownload(`${outName}_final.geojson`, finalOutput);
        }
      });
    }

    if (downloadIntermediateBtn) {
      downloadIntermediateBtn.addEventListener("click", () => {
        if (intermediateOutput) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          triggerDownload(`${outName}_intermediate.geojson`, intermediateOutput);
        }
      });
    }

    // ── Append Fields to Form ──
    form.appendChild(createField("Input Layer (Boundary)", inputLayerWrapper, "Upload the base layer defining analysis boundaries."));
    form.appendChild(createField("Number of Data Layers", countWrapper, "Specify how many additional layers to intersect/union."));
    form.appendChild(dataLayersContainer);
    form.appendChild(createField("Analysis Method", methodWrapper, "Select spatial logical combination operator."));
    form.appendChild(clipWrapper);
    form.appendChild(createField("Output Layer Name", outputNameWrapper));
    form.appendChild(actionsWrapper);
    form.appendChild(statusEl);

    wrapper.appendChild(form);

    // Initial load
    rebuildDataLayerInputs();

    return () => {
      clearPreviousLayer();
      form.remove();
    };
  }
```

---

## 4. Verification & Testing

To verify the correct implementation of the Hazard Resistance Analysis:

### Automated Unit Tests
A set of unit tests should be added to `tests/hazard-resistance.test.ts` (or similar suite) to verify:
1. `dissolveLayer` correctly unions individual features of a single layer.
2. `intersectAllLayers` returns the intersection of multiple input layers.
3. `runAndAnalysisWithIntermediate` correctly calculates the logic and sets `IUA_Intersection`.
4. `runOrAnalysisWithIntermediate` correctly calculates the logic and sets `IUA_Intersection`.

Run:
```powershell
npm run test
```

### Manual Verification
1. Open the Geolibre UI.
2. Select the method `"Terrain & Hydrology Analysis"`.
3. Under the sub-menu dropdown, select `"Hazard Resistance Analysis"`.
4. Upload `example_boundary.geojson` as the Input Layer.
5. Set Number of Data Layers to 2, and upload two additional layer files.
6. Select Method `OR` or `AND` and click `Run Analysis`.
7. Verify that:
   - The layer is rendered on the map.
   - The properties of the generated features contain correct `IUA_Intersection` values.
   - (If `ENABLE_DOWNLOAD` is true) The download buttons are enabled and functional.
