import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import type { FeatureCollection, Polygon, GeoJsonProperties, Geometry } from 'geojson';
import {
  dissolveLayer,
  intersectAllLayers,
  runAndAnalysisWithIntermediate,
  runOrAnalysisWithIntermediate,
  type LoadedLayer
} from '../src/lib/tha/terrain-hydrology';

describe('Hazard Resistance Analysis', () => {
  const createRect = (minX: number, minY: number, maxX: number, maxY: number, props = {}): turf.Feature<Polygon, GeoJsonProperties> => {
    return turf.polygon([
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
      ]
    ], props);
  };

  it('dissolveLayer correctly unions individual features of a single layer', () => {
    const rect1 = createRect(0, 0, 10, 10);
    const rect2 = createRect(5, 5, 15, 15);
    const layer = [rect1, rect2];
    
    const dissolved = dissolveLayer(layer);
    
    expect(dissolved).not.toBeNull();
    // The total area should be 100 + 100 - 25 = 175
    expect(turf.area(dissolved!)).toBeCloseTo(175_000_000_000, -9); // rough check as area depends on projection/turf math but usually relative
  });

  it('intersectAllLayers returns the intersection of multiple input layers', () => {
    const layer1: LoadedLayer = {
      name: 'layer1',
      data: turf.featureCollection([createRect(0, 0, 10, 10)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    const layer2: LoadedLayer = {
      name: 'layer2',
      data: turf.featureCollection([createRect(5, 5, 15, 15)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    
    const intersection = intersectAllLayers([layer1, layer2]);
    
    expect(intersection).not.toBeNull();
    // Intersection should be roughly area 25 (from 5,5 to 10,10)
    // We just check if it exists and has geometry
    expect(intersection?.geometry.type).toBe('Polygon');
  });

  it('runAndAnalysisWithIntermediate correctly calculates the logic and sets IUA_Intersection', () => {
    const inputLayer: LoadedLayer = {
      name: 'input',
      data: turf.featureCollection([createRect(0, 0, 20, 20)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    const dataLayer1: LoadedLayer = {
      name: 'd1',
      data: turf.featureCollection([createRect(5, 5, 15, 15)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    const dataLayer2: LoadedLayer = {
      name: 'd2',
      data: turf.featureCollection([createRect(10, 10, 20, 20)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };

    const result = runAndAnalysisWithIntermediate(inputLayer, [dataLayer1, dataLayer2], true);
    
    expect(result.finalOutput).toBeDefined();
    expect(result.intermediateOutput).toBeDefined();
    
    // Check that IUA_Intersection is correctly populated
    const features = result.finalOutput.features;
    expect(features.length).toBeGreaterThan(0);
    const intersections = features.map(f => f.properties?.IUA_Intersection).filter(v => v !== undefined);
    expect(intersections.length).toBe(features.length);
  });

  it('runOrAnalysisWithIntermediate correctly calculates the logic and sets IUA_Intersection', () => {
    const inputLayer: LoadedLayer = {
      name: 'input',
      data: turf.featureCollection([createRect(0, 0, 20, 20)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    const dataLayer1: LoadedLayer = {
      name: 'd1',
      data: turf.featureCollection([createRect(5, 5, 15, 15)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };
    const dataLayer2: LoadedLayer = {
      name: 'd2',
      data: turf.featureCollection([createRect(10, 10, 20, 20)]) as FeatureCollection<Geometry, GeoJsonProperties>
    };

    const result = runOrAnalysisWithIntermediate(inputLayer, [dataLayer1, dataLayer2], true);
    
    expect(result.finalOutput).toBeDefined();
    expect(result.intermediateOutput).toBeDefined();
    
    const features = result.finalOutput.features;
    expect(features.length).toBeGreaterThan(0);
    const intersections = features.map(f => f.properties?.IUA_Intersection).filter(v => v !== undefined);
    expect(intersections.length).toBe(features.length);
  });
});
