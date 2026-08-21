# Implementation Plan: Resolve Fix 01

This plan details the changes required to resolve the bugs listed in [`Fix01.md`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/Docs/Fix/Fix01.md).

---

## 1. Hide the "Find Optimal Route" Form by Default

### Problem
When the method is changed to "Network Analysis" in the sidebar panel, the "Find Optimal Route" form (`naRouteFormEl`) is shown by default. It should be hidden by default and only display when "Find Optimal Route" is selected from the "Analysis Method" dropdown.

### Cause
Although `naRouteFormEl` is initialized with `style.display = 'none'` in the code, the function `styleRightPanelTree(wrapper)` is called immediately during file input initialization (`naRebuildFileInputs()`). Since `naRouteFormEl` has the class `.na-section`, `styleRightPanelTree` programmatically overrides its display property to `flex` based on the stylesheet rules in `right-panel-styles.ts`.

### Steps to Implement
1. **Modify [`src/lib/geolibre/right-panel.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/src/lib/geolibre/right-panel.ts)**:
   - In `naRebuildLayerList()` (around line 368), immediately after calling `styleRightPanelTree(wrapper);`, re-apply the correct visibility state:
     ```typescript
     styleRightPanelTree(wrapper);
     if (naRouteFormEl) {
       naRouteFormEl.style.display = naState.method === 'Find Optimal Route' ? 'flex' : 'none';
     }
     ```
   - In `naRebuildFileInputs()` (around line 427), immediately after calling `styleRightPanelTree(wrapper);`, re-apply the correct visibility state:
     ```typescript
     styleRightPanelTree(wrapper);
     if (naRouteFormEl) {
       naRouteFormEl.style.display = naState.method === 'Find Optimal Route' ? 'flex' : 'none';
     }
     ```

---

## 2. Fix Snapping and Obstacles Behavior

### Problem
During testing with obstacles:
1. It throws `Error: coordinates must contain numbers`.
2. The snapped points do not match the nearest points on the path when obstacles are present.

### Cause
1. **Coordinate Error**: `snapToNetwork` parses coordinates using `parseCoordId(id)`. When a point snaps to a segment that was already split by a prior snap, the node ID starts with the prefix `"snap:"`. `parseCoordId` fails to strip this prefix, leading to `NaN` coordinates being passed to Turf.js.
2. **Incorrect Snap Location**: `runNetworkAnalysis` calls `applyObstacles` before `snapToNetwork`. When a path segment is blocked, the entire segment is removed, which forces snapping to select a far-away segment. By snapping first, we split the segment into two. `applyObstacles` then only removes the specific split sub-segment that intersects the obstacle, leaving the other half available for correct snapping and routing.

### Steps to Implement
1. **Modify `parseCoordId` in [`src/lib/tha/network-analysis.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/src/lib/tha/network-analysis.ts)**:
   - Update `parseCoordId` to safely strip the `"snap:"` prefix:
     ```typescript
     function parseCoordId(id: string): [number, number] {
       const cleanId = id.startsWith('snap:') ? id.slice(5) : id;
       const parts = cleanId.split(',');
       return [parseFloat(parts[0]), parseFloat(parts[1])];
     }
     ```

2. **Modify `runNetworkAnalysis` in [`src/lib/tha/network-analysis.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin%20Spatio/TerrainandHydrologicalAnalysis/src/lib/tha/network-analysis.ts)**:
   - Change the execution order to snap coordinates *before* applying obstacles:
     ```typescript
     export function runNetworkAnalysis(params: AnalysisParams): AnalysisResult {
       const { layers, layerConfigs, obstacles, start, destination, snappingTolerance, isBenefit } = params;

       // 1. Build graph
       const graph = buildGraph(layers, layerConfigs);

       // 2. Snap start and destination (Do this before applying obstacles)
       const startSnap = snapToNetwork(graph, start, snappingTolerance);
       const destSnap = snapToNetwork(graph, destination, snappingTolerance);

       // 3. Apply obstacles (Filter out blocked links including newly split ones)
       if (obstacles && obstacles.length > 0) {
         applyObstacles(graph, obstacles);
       }

       // 4. Pathfind
       const nodeIds = runPathfinder(graph, startSnap.snappedNodeId, destSnap.snappedNodeId, isBenefit);
       
       // ... remainder of the function ...
     }
     ```
