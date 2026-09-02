import type { Feature, FeatureCollection, GeoJsonProperties, Geometry, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';

export type BufferUnits = 'kilometers' | 'meters' | 'miles';
export type SpatialRelationship = 'intersects' | 'within' | 'contains';
export type JoinType = 'inner' | 'left';

export interface BufferAnalysisParams {
  inputLayer: FeatureCollection<Geometry, GeoJsonProperties>;
  joinLayer: FeatureCollection<Geometry, GeoJsonProperties>;
  bufferDistance: number;
  bufferUnits: BufferUnits;
  spatialRelationship: SpatialRelationship;
  joinType: JoinType;
  joinAttribute: string;
}

function toNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function evaluateRelationship(
  left: Feature<Geometry, GeoJsonProperties>,
  right: Feature<Geometry, GeoJsonProperties>,
  relationship: SpatialRelationship,
): boolean {
  if (relationship === 'intersects') {
    return turf.booleanIntersects(left as Feature, right as Feature);
  }
  if (relationship === 'within') {
    return turf.booleanWithin(left as Feature, right as Feature);
  }
  return turf.booleanContains(left as Feature, right as Feature);
}

/**
 * Creates buffers around features in the input layer.
 */
export function createBufferedLayer(
  inputLayer: FeatureCollection<Geometry, GeoJsonProperties>,
  bufferDistance: number,
  bufferUnits: BufferUnits,
): FeatureCollection<Geometry, GeoJsonProperties> {
  if (!inputLayer.features.length) {
    throw new Error('Input layer must contain at least one feature.');
  }

  const bufferedFeatures = inputLayer.features.map((feature) => {
    const bufferedFeature = turf.buffer(feature as Feature, bufferDistance, {
      units: bufferUnits,
      steps: 8,
    }) as Feature;
    return {
      ...bufferedFeature,
      properties: { ...(feature.properties ?? {}) },
      geometry: bufferedFeature.geometry,
    } as Feature<Geometry, GeoJsonProperties>;
  });

  return {
    type: 'FeatureCollection',
    features: bufferedFeatures,
  };
}

/**
 * Performs spatial join and attributes summarization based on buffers.
 */
export function analyzeBufferZone(params: BufferAnalysisParams): FeatureCollection<Geometry, GeoJsonProperties> {
  if (!params.inputLayer.features.length || !params.joinLayer.features.length) {
    throw new Error('Input and join layers must each contain at least one feature.');
  }

  for (const feature of params.joinLayer.features) {
    if (!feature.properties) continue;
    const numeric = toNumeric(feature.properties[params.joinAttribute]);
    if (numeric === null) {
      throw new Error(`Join attribute "${params.joinAttribute}" must contain numeric values.`);
    }
  }

  const resultFeatures = params.inputLayer.features.flatMap((feature) => {
    const properties = { ...(feature.properties ?? {}) };
    const matchingValues = params.joinLayer.features
      .filter((joinFeature) => {
        if (!joinFeature.geometry) return false;
        return evaluateRelationship(feature, joinFeature, params.spatialRelationship);
      })
      .map((joinFeature) => toNumeric(joinFeature.properties?.[params.joinAttribute]))
      .filter((value): value is number => value !== null);

    const sum = matchingValues.reduce((total, value) => total + value, 0);
    const min = matchingValues.length ? Math.min(...matchingValues) : null;
    const max = matchingValues.length ? Math.max(...matchingValues) : null;
    const avg = matchingValues.length ? sum / matchingValues.length : null;

    properties[`sum_${params.joinAttribute}`] = sum;
    properties[`min_${params.joinAttribute}`] = min;
    properties[`max_${params.joinAttribute}`] = max;
    properties[`avg_${params.joinAttribute}`] = avg;

    if (params.joinType === 'inner' && matchingValues.length === 0) {
      return [];
    }

    return [{ ...feature, properties }];
  });

  return {
    type: 'FeatureCollection',
    features: resultFeatures,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hazard Resistance Analysis – Types & Core Logic
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadedLayer {
  name: string;
  data: FeatureCollection<Geometry, GeoJsonProperties>;
}

export interface AnalysisRunResult {
  finalOutput: FeatureCollection<Geometry, GeoJsonProperties>;
  intermediateOutput: FeatureCollection<Geometry, GeoJsonProperties> | null;
}

// ── Private helpers ──────────────────────────────────────────────────────────

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
  return layerName === 'Intersection' || layerName.startsWith('U_');
}

function getLayerProperties(
  properties: Record<string, unknown> | null | undefined,
  layerName: string,
  fillValue?: unknown,
  isAggregateLayer = false,
): Record<string, unknown> {
  const propsCopy = properties ? { ...properties } : {};
  delete propsCopy['IUA_Intersection'];

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
  fromInput: boolean,
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
  properties: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties ?? {})) {
    if (key === 'Intersection_isIntersection') continue;
    if (key === 'IUA_Intersection') {
      normalized[key] = value;
      continue;
    }
    if (key.endsWith('_IUA_Intersection')) continue;
    normalized[key] = value;
  }

  if (normalized.IUA_Intersection == null) {
    normalized.IUA_Intersection = 0;
  }

  return normalized;
}

function initializeIUAIntersection(
  features: Feature<Geometry, GeoJsonProperties>[],
  val: number,
): void {
  for (const feature of features) {
    if (!feature.properties) feature.properties = {};
    feature.properties.IUA_Intersection = val;
  }
}

// ── Spatial operations ───────────────────────────────────────────────────────

/**
 * Dissolves all features in a layer into a single (Multi)Polygon.
 */
export function dissolveLayer(
  features: Feature<Geometry, GeoJsonProperties>[],
): Feature<Polygon | MultiPolygon> | null {
  if (features.length === 0) return null;

  let dissolved: Feature<Polygon | MultiPolygon> | null = turf.feature(
    features[0].geometry as Polygon | MultiPolygon,
    {},
  );

  for (let i = 1; i < features.length; i++) {
    const next = turf.feature(features[i].geometry as Polygon | MultiPolygon, {});
    const fc = turf.featureCollection([dissolved!, next]) as FeatureCollection<Polygon | MultiPolygon>;
    dissolved = turf.union(fc) as Feature<Polygon | MultiPolygon> | null;
    if (!dissolved) return null;
  }

  return dissolved;
}

/**
 * Returns the geometric intersection of all supplied layers (AND logic).
 */
export function intersectAllLayers(
  layers: LoadedLayer[],
): Feature<Polygon | MultiPolygon> | null {
  if (layers.length === 0) return null;

  let currentIntersection = dissolveLayer(layers[0].data.features);

  for (let i = 1; i < layers.length; i++) {
    if (!currentIntersection) return null;

    const nextDissolved = dissolveLayer(layers[i].data.features);
    if (!nextDissolved) return null;

    const fc = turf.featureCollection([
      currentIntersection,
      nextDissolved,
    ]) as FeatureCollection<Polygon | MultiPolygon>;
    currentIntersection = turf.intersect(fc) as Feature<Polygon | MultiPolygon> | null;
  }

  return currentIntersection;
}

/**
 * Builds a union FeatureCollection from two layers, computing intersections,
 * A−B differences, and B−A differences with correct IUA_Intersection attributes.
 */
export function buildUnionFeatureCollection(
  layerA: LoadedLayer,
  layerB: LoadedLayer,
  input: boolean,
): FeatureCollection<Geometry, GeoJsonProperties> {
  const features: Feature<Geometry, GeoJsonProperties>[] = [];

  if (!layerA.data.features.length || !layerB.data.features.length) {
    throw new Error('Both layers must contain at least one feature before unioning.');
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
            true,
          ),
          ...getLayerProperties(featureA.properties, layerA.name, undefined, layerA.name.startsWith('U_')),
          ...getLayerProperties(featureB.properties, layerB.name, undefined, layerB.name.startsWith('U_')),
        };
        features.push({
          type: 'Feature',
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
      const fc = turf.featureCollection([
        featureAWrapped,
        dissolvedB,
      ]) as FeatureCollection<Polygon | MultiPolygon>;
      const differenceAB = turf.difference(fc);

      if (differenceAB?.geometry) {
        const properties = {
          ...generateIUA(
            featureA.properties?.IUA_Intersection,
            layerB.data.features[0].properties?.IUA_Intersection,
            false,
            input,
            false,
          ),
          ...getLayerProperties(featureA.properties, layerA.name, undefined, layerA.name.startsWith('U_')),
          ...getLayerProperties(layerB.data.features[0]?.properties, layerB.name, null, layerB.name.startsWith('U_')),
        };
        features.push({
          type: 'Feature',
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
      const fc = turf.featureCollection([
        featureBWrapped,
        dissolvedA,
      ]) as FeatureCollection<Polygon | MultiPolygon>;
      const differenceBA = turf.difference(fc);

      if (differenceBA?.geometry) {
        const properties = {
          ...generateIUA(
            featureB.properties?.IUA_Intersection,
            layerA.data.features[0].properties?.IUA_Intersection,
            false,
            input,
            true,
          ),
          ...getLayerProperties(featureB.properties, layerB.name, undefined, layerB.name.startsWith('U_')),
          ...getLayerProperties(layerA.data.features[0]?.properties, layerA.name, null, layerA.name.startsWith('U_')),
        };
        features.push({
          type: 'Feature',
          geometry: differenceBA.geometry,
          properties,
        });
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

// ── Main entrypoints ─────────────────────────────────────────────────────────

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

/**
 * Runs AND (Intersection) analysis across all data layers, then unions the
 * result with the input layer boundary. Returns both the final and intermediate
 * FeatureCollections.
 */
export function runAndAnalysisWithIntermediate(
  inputLayer: LoadedLayer,
  dataLayers: LoadedLayer[],
  clipToInput: boolean,
): AnalysisRunResult {
  const intersection = intersectAllLayers(dataLayers);

  if (!intersection || !intersection.geometry) {
    const resultFeatures = inputLayer.data.features.map((f) => ({
      ...f,
      properties: normalizeFinalProperties({ ...f.properties, IUA_Intersection: 0 }),
    }));
    return {
      finalOutput: { type: 'FeatureCollection', features: resultFeatures },
      intermediateOutput: null,
    };
  }

  const intersectionFeature = turf.feature(intersection.geometry as Polygon | MultiPolygon, {});
  const flattened = turf.flatten(
    turf.featureCollection([intersectionFeature]),
  ) as FeatureCollection<Polygon | MultiPolygon>;

  const dlProcessRes: FeatureCollection<Geometry, GeoJsonProperties> = {
    type: 'FeatureCollection',
    features: flattened.features.map((feature) => ({
      type: 'Feature',
      geometry: feature.geometry,
      properties: { ...buildIntersectionProperties(dataLayers), IUA_Intersection: 0 },
    })),
  };

  initializeIUAIntersection(dlProcessRes.features, dataLayers.length);

  const intersectionLayer: LoadedLayer = {
    name: 'Intersection',
    data: dlProcessRes,
  };

  const preprocessedInputLayer: LoadedLayer = {
    name: inputLayer.name,
    data: {
      type: 'FeatureCollection',
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
    finalOutput: { type: 'FeatureCollection', features: finalFeatures },
    intermediateOutput: dlProcessRes,
  };
}

/**
 * Runs OR (Union) analysis across all data layers, then unions the result with
 * the input layer boundary. Returns both the final and intermediate
 * FeatureCollections.
 */
export function runOrAnalysisWithIntermediate(
  inputLayer: LoadedLayer,
  dataLayers: LoadedLayer[],
  clipToInput: boolean,
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
      finalOutput: { type: 'FeatureCollection', features: resultFeatures },
      intermediateOutput: null,
    };
  }

  const preprocessedDataLayers = dataLayers.map(
    (layer) =>
      ({
        name: layer.name,
        data: {
          type: 'FeatureCollection',
          features: layer.data.features.map((f) => ({
            ...f,
            properties: { ...f.properties },
          })),
        },
      }) as LoadedLayer,
  );

  let dataUnion: LoadedLayer = preprocessedDataLayers[0];

  for (let i = 1; i < preprocessedDataLayers.length; i++) {
    const unionFc = buildUnionFeatureCollection(dataUnion, preprocessedDataLayers[i], false);
    dataUnion = {
      name: `U_${i}`,
      data: unionFc,
    };
  }

  const preprocessedInputLayer: LoadedLayer = {
    name: inputLayer.name,
    data: {
      type: 'FeatureCollection',
      features: inputLayer.data.features.map((f) => ({
        ...f,
        properties: { ...f.properties, isInputLayer: true, IUA_Intersection: 0 },
      })),
    },
  };

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
    finalOutput: { type: 'FeatureCollection', features: finalFeatures },
    intermediateOutput: dataUnion.data,
  };
}
