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
import type { FeatureCollection, Feature, LineString, Point, GeoJsonProperties, Polygon } from 'geojson';

// Convenience alias: the return type of createGraph with unknown node/edge data,
// which is the widest compatible type accepted by all helpers.
type AnyGraph = ReturnType<typeof createGraph<unknown, unknown>>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayerConfig {
  /** Index into the layers array (0-based). */
  layerIndex: number;
  /** Weight multiplier for this layer's edge costs. */
  weight: number;
  /** GeoJSON property name to use as the edge value, or "Distance" for segment length. */
  optimalValueAttr: string;
}

export interface AnalysisParams {
  /** Parsed GeoJSON data for each checked network layer. */
  layers: FeatureCollection[];
  /** Configuration for each layer (weight, attribute). */
  layerConfigs: LayerConfig[];
  /** Obstacle GeoJSON feature collections (optional). */
  obstacles?: FeatureCollection[];
  /** Start coordinate [lng, lat]. */
  start: [number, number];
  /** Destination coordinate [lng, lat]. */
  destination: [number, number];
  /** Snapping tolerance in meters. 0 means snap to nearest unconditionally. */
  snappingTolerance: number;
  /** If true, maximise benefit (invert cost). If false, minimise cost. */
  isBenefit: boolean;
}

export interface AnalysisResult {
  /** Route path as a GeoJSON FeatureCollection (single LineString with optimal_value property). */
  route: FeatureCollection;
  /** The two user-clicked points (start and destination). */
  clickedPoints: FeatureCollection;
  /** The two snapped points on the network (start and destination). */
  snappedPoints: FeatureCollection;
}

// Edge metadata stored on each graph link.
interface EdgeData {
  /** Distance of the segment in meters. */
  distanceMeters: number;
  /** Value of the chosen attribute (or distance if "Distance" selected). */
  attrValue: number;
  /** Weight of this layer. */
  weight: number;
  /** Coordinates of the segment: [[lng, lat], [lng, lat]] */
  coords: [[number, number], [number, number]];
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Stringify a coordinate pair at 7 decimal places for use as a node id. */
function coordId(lng: number, lat: number): string {
  return `${lng.toFixed(7)},${lat.toFixed(7)}`;
}

/** Parse a node id back to [lng, lat]. */
function parseCoordId(id: string): [number, number] {
  const cleanId = id.startsWith('snap:') ? id.slice(5) : id;
  const parts = cleanId.split(',');
  return [parseFloat(parts[0]), parseFloat(parts[1])];
}

// ─── Graph Construction ───────────────────────────────────────────────────────

/**
 * Build an ngraph Graph from an array of GeoJSON LineString/MultiLineString
 * feature collections, applying per-layer configuration.
 *
 * Each pair of adjacent coordinates in every LineString becomes a bidirectional
 * edge. Node IDs are stringified coordinates at 7dp to merge shared intersections.
 */
export function buildGraph(
  layers: FeatureCollection[],
  layerConfigs: LayerConfig[],
): AnyGraph {
  const graph = createGraph<null, EdgeData>() as unknown as AnyGraph;

  for (const config of layerConfigs) {
    const layer = layers[config.layerIndex];
    if (!layer) continue;

    for (const feature of layer.features) {
      const geom = feature.geometry;
      if (!geom) continue;

      let coordArrays: [number, number][][];

      if (geom.type === 'LineString') {
        coordArrays = [geom.coordinates as [number, number][]];
      } else if (geom.type === 'MultiLineString') {
        coordArrays = geom.coordinates as [number, number][][];
      } else {
        continue;
      }

      for (const coords of coordArrays) {
        for (let i = 0; i < coords.length - 1; i++) {
          const [lng1, lat1] = coords[i];
          const [lng2, lat2] = coords[i + 1];

          const fromId = coordId(lng1, lat1);
          const toId = coordId(lng2, lat2);

          // Skip degenerate zero-length segments
          if (fromId === toId) continue;

          const from = point([lng1, lat1]);
          const to = point([lng2, lat2]);
          const distMeters = distance(from, to, { units: 'meters' });

          // Determine the attribute value
          let attrValue: number;
          if (config.optimalValueAttr === 'Distance') {
            attrValue = distMeters;
          } else {
            const raw = (feature.properties as Record<string, unknown>)?.[config.optimalValueAttr];
            attrValue = typeof raw === 'number' ? raw : distMeters; // fallback to distance
          }

          const edgeData: EdgeData = {
            distanceMeters: distMeters,
            attrValue,
            weight: config.weight,
            coords: [[lng1, lat1], [lng2, lat2]],
          };

          // Add bidirectional edges (undirected network)
          graph.addLink(fromId, toId, edgeData);
          graph.addLink(toId, fromId, { ...edgeData, coords: [[lng2, lat2], [lng1, lat1]] });
        }
      }
    }
  }

  return graph;
}

// ─── Obstacle Filtering ───────────────────────────────────────────────────────

/**
 * Remove graph edges that are blocked by obstacle features.
 *
 * - Polygon obstacles: edges whose segment intersects the polygon boundary,
 *   or both endpoints are inside the polygon, are removed.
 * - LineString obstacles: edges that intersect the obstacle line are removed.
 * - Point obstacles: edges within 1 meter of the obstacle point are removed.
 */
export function applyObstacles(
  graph: AnyGraph,
  obstacles: FeatureCollection[],
): void {
  const linksToRemove: Array<{ fromId: string; toId: string }> = [];

  for (const obstacleCollection of obstacles) {
    for (const obstacleFeature of obstacleCollection.features) {
      const geom = obstacleFeature.geometry;
      if (!geom) continue;

      graph.forEachLink((link) => {
        const edgeData = link.data as EdgeData;
        const [c1, c2] = edgeData.coords;
        const segLine = lineString([c1, c2]);

        let shouldRemove = false;

        if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
          const obstacleFeatureCast = obstacleFeature as Feature<Polygon>;
          const ringCoords = geom.type === 'Polygon'
            ? (geom as Polygon).coordinates[0]
            : (geom as { type: 'MultiPolygon'; coordinates: number[][][][] }).coordinates[0][0];
          if (ringCoords && ringCoords.length >= 2) {
            const boundaryLine = lineString(ringCoords as [number, number][]);
            const intersections = lineIntersect(segLine, boundaryLine);
            if (intersections.features.length > 0) {
              shouldRemove = true;
            }
          }
          // Also remove if both endpoints are inside the polygon
          if (!shouldRemove) {
            const p1Inside = booleanPointInPolygon(point(c1), obstacleFeatureCast);
            const p2Inside = booleanPointInPolygon(point(c2), obstacleFeatureCast);
            if (p1Inside && p2Inside) shouldRemove = true;
          }
        } else if (geom.type === 'LineString') {
          const obstacleLine = lineString(geom.coordinates as [number, number][]);
          const intersections = lineIntersect(segLine, obstacleLine);
          if (intersections.features.length > 0) shouldRemove = true;
        } else if (geom.type === 'MultiLineString') {
          for (const lineCoords of (geom as { type: string; coordinates: number[][][] }).coordinates) {
            if (lineCoords.length >= 2) {
              const obstacleLine = lineString(lineCoords as [number, number][]);
              const intersections = lineIntersect(segLine, obstacleLine);
              if (intersections.features.length > 0) { shouldRemove = true; break; }
            }
          }
        } else if (geom.type === 'Point') {
          const obsPoint = point(geom.coordinates as [number, number]);
          const p1 = point(c1);
          const d1 = distance(obsPoint, p1, { units: 'meters' });
          if (d1 < 1) shouldRemove = true;
        }

        if (shouldRemove) {
          linksToRemove.push({ fromId: link.fromId as string, toId: link.toId as string });
        }
      });
    }
  }

  for (const { fromId, toId } of linksToRemove) {
    graph.removeLink(graph.getLink(fromId, toId)!);
  }
}

// ─── Snapping ─────────────────────────────────────────────────────────────────

interface SnapResult {
  /** The snapped coordinate [lng, lat]. */
  snappedCoord: [number, number];
  /** The original edge fromId that was split. */
  fromId: string;
  /** The original edge toId that was split. */
  toId: string;
  /** The new node ID for the snapped point. */
  snappedNodeId: string;
}

/**
 * Find the closest point on the network graph to the given coordinate.
 * If within tolerance, inserts a new temporary split node and two replacement edges.
 *
 * @throws {Error} If the nearest point is further than `toleranceMeters` (when > 0).
 */
export function snapToNetwork(
  graph: AnyGraph,
  coord: [number, number],
  toleranceMeters: number,
): SnapResult {
  let bestDistance = Infinity;
  let bestSnappedCoord: [number, number] | null = null;
  let bestFromId: string | null = null;
  let bestToId: string | null = null;
  let bestEdgeData: EdgeData | null = null;

  const queryPoint = point(coord);

  graph.forEachLink((link) => {
    const edgeData = link.data as EdgeData;
    const [c1, c2] = edgeData.coords;
    const seg = lineString([c1, c2]);
    const snapped = nearestPointOnLine(seg, queryPoint, { units: 'meters' });
    const dist = snapped.properties?.dist ?? Infinity;

    if (dist < bestDistance) {
      bestDistance = dist;
      bestSnappedCoord = snapped.geometry.coordinates as [number, number];
      bestFromId = link.fromId as string;
      bestToId = link.toId as string;
      bestEdgeData = edgeData;
    }
  });

  if (!bestSnappedCoord || !bestFromId || !bestToId || !bestEdgeData) {
    throw new Error('Network graph is empty — cannot snap.');
  }

  if (toleranceMeters > 0 && bestDistance > toleranceMeters) {
    throw new Error(
      `Snapped point is out of range: nearest edge is ${bestDistance.toFixed(1)} m away (tolerance: ${toleranceMeters} m).`,
    );
  }

  const snappedCoordNN = bestSnappedCoord as [number, number];
  const fromIdNN = bestFromId as string;
  const toIdNN = bestToId as string;
  const edgeDataNN = bestEdgeData as EdgeData;

  const [sLng, sLat] = snappedCoordNN;
  const snappedNodeId = `snap:${coordId(sLng, sLat)}`;

  // Distances for scaling attribute values
  const fromCoord = parseCoordId(fromIdNN);
  const toCoord = parseCoordId(toIdNN);
  const totalDist = edgeDataNN.distanceMeters || 1;

  const distAS = distance(point(fromCoord), point(snappedCoordNN), { units: 'meters' });
  const distSB = distance(point(snappedCoordNN), point(toCoord), { units: 'meters' });
  const ratioAS = distAS / totalDist;
  const ratioSB = distSB / totalDist;

  const edgeAS: EdgeData = {
    distanceMeters: distAS,
    attrValue: edgeDataNN.attrValue * ratioAS,
    weight: edgeDataNN.weight,
    coords: [fromCoord, [sLng, sLat]],
  };
  const edgeSB: EdgeData = {
    distanceMeters: distSB,
    attrValue: edgeDataNN.attrValue * ratioSB,
    weight: edgeDataNN.weight,
    coords: [[sLng, sLat], toCoord],
  };

  // Remove original edge and add the two split edges
  const origLink = graph.getLink(fromIdNN, toIdNN);
  if (origLink) graph.removeLink(origLink);
  const origReverseLink = graph.getLink(toIdNN, fromIdNN);
  if (origReverseLink) graph.removeLink(origReverseLink);

  graph.addLink(fromIdNN, snappedNodeId, edgeAS as unknown);
  graph.addLink(snappedNodeId, fromIdNN, { ...edgeAS, coords: [[sLng, sLat], fromCoord] } as unknown);
  graph.addLink(snappedNodeId, toIdNN, edgeSB as unknown);
  graph.addLink(toIdNN, snappedNodeId, { ...edgeSB, coords: [toCoord, [sLng, sLat]] } as unknown);

  return { snappedCoord: [sLng, sLat], fromId: fromIdNN, toId: toIdNN, snappedNodeId };
}

// ─── Pathfinding ──────────────────────────────────────────────────────────────

/**
 * Run the NBA* (bidirectional A*) pathfinder on the graph.
 *
 * Cost mode:    edge cost = weight × attrValue   (minimise sum → shortest/cheapest path)
 * Benefit mode: edge cost = 1 / (weight × attrValue + ε)  (minimise cost → maximise benefit)
 *
 * Returns the ordered list of node IDs along the found path (from start to end),
 * or null if no path exists.
 */
function runPathfinder(
  graph: AnyGraph,
  startNodeId: string,
  endNodeId: string,
  isBenefit: boolean,
): string[] | null {
  const EPSILON = 1e-9;

  const pathfinder = nba(graph as ReturnType<typeof createGraph>, {
    distance(_fromNode: unknown, _toNode: unknown, link: { data: unknown }) {
      const edgeData = link.data as EdgeData;
      const edgeValue = edgeData.weight * edgeData.attrValue;

      if (isBenefit) {
        // Benefit optimisation: transform so that higher benefit → lower cost.
        return 1 / (edgeValue + EPSILON);
      }
      // Cost optimisation: minimise sum directly.
      return Math.max(edgeValue, EPSILON); // guard against negative/zero
    },
    heuristic(from: { id: unknown }, to: { id: unknown }) {
      // Admissible heuristic: straight-line distance between nodes (in meters)
      const fromId = String(from.id);
      const toId = String(to.id);
      const [fromLng, fromLat] = parseCoordId(fromId.startsWith('snap:') ? fromId.slice(5) : fromId);
      const [toLng, toLat] = parseCoordId(toId.startsWith('snap:') ? toId.slice(5) : toId);
      return distance(point([fromLng, fromLat]), point([toLng, toLat]), { units: 'meters' });
    },
  });

  const path = pathfinder.find(startNodeId, endNodeId);
  if (!path || path.length === 0) return null;

  // ngraph.path returns nodes from END to START; reverse to get start→end order.
  return (path as Array<{ id: string }>).map((n) => n.id).reverse();
}

// ─── Result Assembly ──────────────────────────────────────────────────────────

/**
 * Build the route FeatureCollection: a single LineString with the path
 * coordinates and the cumulative optimal_value attached to its properties.
 */
function buildRouteGeoJSON(nodeIds: string[], optimalValue: number): FeatureCollection {
  const coords: [number, number][] = nodeIds.map((id) => {
    const cleanId = id.startsWith('snap:') ? id.slice(5) : id;
    return parseCoordId(cleanId);
  });
  const routeLine: Feature<LineString> = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: { type: 'route', optimal_value: optimalValue },
  };
  return featureCollection([routeLine as Feature]);
}

/**
 * Build the clicked-points FeatureCollection: start and destination as
 * the user originally clicked them on the map.
 */
function buildClickedPointsGeoJSON(
  start: [number, number],
  dest: [number, number],
): FeatureCollection {
  const startPt: Feature<Point, GeoJsonProperties> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: start },
    properties: { type: 'start_clicked', label: 'Start (clicked)' },
  };
  const destPt: Feature<Point, GeoJsonProperties> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: dest },
    properties: { type: 'destination_clicked', label: 'Destination (clicked)' },
  };
  return featureCollection([startPt, destPt]);
}

/**
 * Build the snapped-points FeatureCollection: start and destination after
 * being projected onto the network.
 */
function buildSnappedPointsGeoJSON(
  start: [number, number],
  dest: [number, number],
): FeatureCollection {
  const startPt: Feature<Point, GeoJsonProperties> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: start },
    properties: { type: 'start_snapped', label: 'Start (snapped)' },
  };
  const destPt: Feature<Point, GeoJsonProperties> = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: dest },
    properties: { type: 'destination_snapped', label: 'Destination (snapped)' },
  };
  return featureCollection([startPt, destPt]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full network analysis pipeline:
 * 1. Build graph from layers.
 * 2. Snap start and destination to network.
 * 3. Apply obstacle filters.
 * 4. Run pathfinder.
 * 5. Return result GeoJSON.
 *
 * @throws {Error} if snapping fails or no path is found.
 */
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

  if (!nodeIds || nodeIds.length === 0) {
    throw new Error(
      'No route found between the selected points. Try adjusting the snapping tolerance or checking obstacles.',
    );
  }

  // 5. Compute cumulative optimal value along the found path
  let optimalValue = 0;
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const link = graph.getLink(nodeIds[i], nodeIds[i + 1]);
    if (link && link.data) {
      const data = link.data as EdgeData;
      optimalValue += data.weight * data.attrValue;
    }
  }

  // 6. Build three separate result layers
  const route = buildRouteGeoJSON(nodeIds, optimalValue);
  const clickedPoints = buildClickedPointsGeoJSON(start, destination);
  const snappedPoints = buildSnappedPointsGeoJSON(startSnap.snappedCoord, destSnap.snappedCoord);

  return { route, clickedPoints, snappedPoints };
}