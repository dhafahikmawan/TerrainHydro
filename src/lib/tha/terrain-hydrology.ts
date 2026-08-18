import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
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
