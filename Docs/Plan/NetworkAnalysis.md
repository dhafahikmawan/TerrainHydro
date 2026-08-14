# Network Analysis Implementation Plan

This document outlines the detailed implementation plan to integrate the **Network Analysis (Find Optimal Route)** functionality from the reference sample plugin `/Docs/Samples/Existing Working Plugin Reference/Network Analysis/` into our current plugin architecture.

---

## 1. Prerequisites & Dependencies

The network analysis uses graph theory packages for pathfinding and coordinate snapping. You must install the following npm packages in the project root:

1. **ngraph.graph**: Graph data structure library.
2. **ngraph.path**: Pathfinding algorithms (A* / NBA).

### Action Items:
- Add the dependencies to `package.json` under `dependencies`:
  ```json
  "ngraph.graph": "^20.1.2",
  "ngraph.path": "^1.6.1"
  ```
- Run `npm install` in the terminal to fetch the new dependencies.

---

## 2. Component Architecture

We will structure this feature to align with the existing project's structure (mirroring how `Raster Analysis` is designed):

1. **Core Pathfinding Logic**: Implemented in [network-analysis.ts](file:///src/lib/tha/network-analysis.ts).
2. **UI & User Interaction**: Integrated directly inside [right-panel.ts](file:///src/lib/geolibre/right-panel.ts).
3. **Styling**: Appended to [plugin-control.css](file:///src/lib/styles/plugin-control.css).

---

## 3. Step-by-Step Implementation Guide

### Step 3.1: Implement Core Logic in `network-analysis.ts`

Open the existing, near-empty [network-analysis.ts](file:///src/lib/tha/network-analysis.ts) file and implement the pathfinding pipeline.

#### Imports:
Import Turf helper utilities and the ngraph library.
```typescript
import {
  distance,
  nearestPointOnLine,
  lineIntersect,
  booleanPointInPolygon,
  point,
  lineString,
  featureCollection,
} from '@turf/turf';
import createGraph from 'ngraph.graph';
import { nba } from 'ngraph.path';
import type { FeatureCollection, Feature, LineString, Point, GeoJsonProperties } from 'geojson';
```

#### Interfaces:
```typescript
export interface LayerConfig {
  layerIndex: number;
  weight: number;
  optimalValueAttr: string;
}

export interface AnalysisParams {
  layers: FeatureCollection[];
  layerConfigs: LayerConfig[];
  obstacles?: FeatureCollection[];
  start: [number, number];
  destination: [number, number];
  snappingTolerance: number;
  isBenefit: boolean;
}

export interface AnalysisResult {
  route: FeatureCollection;
  clickedPoints: FeatureCollection;
  snappedPoints: FeatureCollection;
}

interface EdgeData {
  distanceMeters: number;
  attrValue: number;
  weight: number;
  coords: [[number, number], [number, number]];
}

type AnyGraph = ReturnType<typeof createGraph<unknown, unknown>>;
```

#### Algorithm Steps to Code:
1. **Helper Functions**:
   - `coordId(lng, lat)`: Stringify coordinates at 7 decimal places (`lng.toFixed(7),lat.toFixed(7)`) to group intersections.
   - `parseCoordId(id)`: Split and parse the string ID back to `[number, number]`.
2. **`buildGraph(layers, configs)`**:
   - Construct a graph using `createGraph<null, EdgeData>()`.
   - Iterate over features, coordinate segments, and add bidirectional edges using `graph.addLink(fromId, toId, edgeData)`.
   - Calculate distance between nodes using Turf's `distance`.
   - Fall back to the distance metric if `optimalValueAttr` is `"Distance"`.
3. **`applyObstacles(graph, obstacles)`**:
   - Find edges that intersect any polygon obstacle or whose nodes lie inside the obstacle polygons, and remove them from the graph.
4. **`snapToNetwork(graph, coord, tolerance)`**:
   - Find the nearest node or coordinate point on the network links using Turf's `nearestPointOnLine`.
   - Ensure the snapping respect the snapping tolerance (if `tolerance > 0` and the distance is greater, throw an error indicating the point is too far).
5. **`runPathfinder(graph, startNodeId, destNodeId, isBenefit)`**:
   - Instantiate `nba` pathfinder from `ngraph.path` using custom costs.
   - For cost minimization: cost is `weight * attrValue`.
   - For benefit maximization: cost is a mapped/inverted value or penalty where higher benefit equals lower routing cost.
6. **`runNetworkAnalysis(params: AnalysisParams): AnalysisResult`**:
   - Main orchestrator function executing the steps sequentially and returning the GeoJSON layers:
     - `route`: The optimal route as a `LineString` feature collection.
     - `clickedPoints`: Original user-clicked coordinates.
     - `snappedPoints`: The matched coordinates on the network.

---

### Step 3.2: Render UI and Control in `right-panel.ts`

Open [right-panel.ts](file:///src/lib/geolibre/right-panel.ts).

#### Developer Variables:
At the top level of the file, define the download toggle variable:
```typescript
/** Toggle to enable or disable exporting the calculated optimal route */
const ENABLE_DOWNLOAD = true; 
```

#### State Definition:
Define the internal state variables to manage layers (file handles, parsed GeoJSON, numeric attributes, selected weight, etc.) and selected start/destination points.

#### Load Form:
Inside the `loadMethodForm(wrapper, method)` function:
- Locate the `else if (method === "Network Analysis")` block. (Make sure that any Network Analysis UI codes doesn't go outside the scope of this block).
- Dynamically build the UI form fields mimicking the reference:
  1. **Method Select Dropdown**: Select Network Analysis method (e.g., `"Find Optimal Route"`).
  2. **Layer Count Select**: Input/dropdown to dynamically select between 1 and 5 layers.
  3. **Dynamic Layer List**: For each layer, render:
     - File input for GeoJSON/JSON files.
     - Dropdown listing numeric attributes extracted from the GeoJSON (via a helper parsing `feature.properties`).
     - Numeric input for Weight (default: 1).
     - Active checkbox toggle.
  4. **Start & Destination Coordinates**:
     - Coordinate string inputs.
     - "Pick on Map" button. When clicked, temporarily set Map canvas cursor to `'crosshair'` and listen to the map `click` event once to capture coordinates, populate the input, and restore the cursor.
  5. **Snapping Tolerance**: Numeric input in meters (default: 0).
  6. **Obstacles Upload**: Accept GeoJSON obstacles to exclude nodes/edges.
  7. **Benefit Toggle**: Checkbox to toggle between cost minimization vs benefit maximization.
  8. **Action Button**: A button labeled `"Find Optimal Route"` which compiles the inputs, runs `runNetworkAnalysis`, cleans up previously drawn layers, and adds the output layers on the map via `app.addGeoJsonLayer`.
  9. **Download Button**: If `ENABLE_DOWNLOAD` is true, render a `"Download Route"` button when analysis succeeds.

#### File Download Utility:
If `ENABLE_DOWNLOAD` is true and a route is calculated, clicking the download button should execute:
```typescript
const jsonStr = JSON.stringify(routeGeoJson, null, 2);
const blob = new Blob([jsonStr], { type: 'application/geo+json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'optimal_route.geojson';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

---

### Step 3.3: Style Panel in `plugin-control.css`

Open [plugin-control.css](file:///src/lib/styles/plugin-control.css) and append the styles prefixing with `.na-` and `.network-analysis-panel`.

- Ensure the design elements (button hover animations, card shadows, form element borders) match the current theme palette.
- Set appropriate padding and font rules so that the form controls scale nicely with the sidebar resize handle.

---

## 4. Verification & Testing

### Automated Checks
Ensure the code is free of TypeScript and linter issues:
```powershell
# Run compiler checks
npm run build:lib

# Run linting rules
npm run lint
```

### Manual Verification Checklist
1. Select "Network Analysis" from the geoprocessing dropdown.
2. Select "1" layer, upload a valid road network GeoJSON.
3. Verify that the attribute dropdown populates with the numeric properties from the GeoJSON features.
4. Click "Pick on Map" for Start point and verify the map cursor becomes a crosshair and captures the clicked location. Do the same for Destination.
5. Click "Find Optimal Route". Ensure the optimal route LineString, start/destination input points, and snapped points are loaded onto the map.
6. Verify download functionality:
   - If `ENABLE_DOWNLOAD = true`: Confirm the "Download Route" button is visible and successfully downloads `optimal_route.geojson`.
   - If `ENABLE_DOWNLOAD = false`: Verify the button is hidden and download behavior is disabled.
