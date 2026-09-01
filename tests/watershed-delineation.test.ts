import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { fromArrayBuffer } from "geotiff";
import {
  sinkFill,
  computeD8AndAccumulation,
  extractChannels,
  delineateBasins,
  vectorizeBasins,
  clipAndComputeStats,
  reprojectCoords,
} from "../src/lib/tha/watershed-delineation";

describe("reprojectCoords using proj4", () => {
  it("passes through EPSG:4326 coordinates", () => {
    const coords = reprojectCoords(106.8456, -6.2088, 4326);
    expect(coords[0]).toBeCloseTo(106.8456, 4);
    expect(coords[1]).toBeCloseTo(-6.2088, 4);
  });

  it("converts EPSG:3857 Web Mercator to WGS84 coordinates", () => {
    const origin = reprojectCoords(0, 0, 3857);
    expect(origin[0]).toBeCloseTo(0, 4);
    expect(origin[1]).toBeCloseTo(0, 4);

    const london = reprojectCoords(-12499.55, 6711364.57, 3857);
    expect(london[0]).toBeCloseTo(-0.1123, 3);
    expect(london[1]).toBeCloseTo(51.5064, 3);
  });

  it("converts UTM EPSG:32633 to WGS84 coordinates", () => {
    const coords = reprojectCoords(500000, 4649776.23, 32633);
    expect(coords[0]).toBeCloseTo(15.0, 2);
    expect(coords[1]).toBeCloseTo(42.0, 2);
  });

  it("falls back gracefully when given an unrecognized CRS code", () => {
    const coords = reprojectCoords(100, 200, 99999999);
    expect(coords).toEqual([100, 200]);
  });
});

describe("Watershed Delineation with Z-limit = 1 and Threshold = 100", () => {
  it("correctly delineates 18 basins on dem.tif without sink self-loop artifacts", async () => {
    const demPath = path.resolve(__dirname, "../Docs/Samples/Data/dem.tif");
    const buffer = fs.readFileSync(demPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasters = await image.readRasters({ interleave: true });
    const rawRaster = rasters as unknown as number[];
    const elevation = new Float32Array(rawRaster.length);
    for (let i = 0; i < rawRaster.length; i++) elevation[i] = rawRaster[i];

    const fd = image.getFileDirectory() as Record<string, unknown>;
    const noDataValue = Number(fd.GDAL_NODATA ?? -9999);
    const pixelScale = (fd.ModelPixelScale as number[] | undefined) ?? [1, 1, 1];
    const tiepoint = (fd.ModelTiepoint as number[] | undefined) ?? [0, 0, 0, 0, 0, 0];
    const geotransform = [tiepoint[3], pixelScale[0], 0, tiepoint[4], 0, -pixelScale[1]];
    const geoKeys = (image as { getGeoKeys?: () => Record<string, number> }).getGeoKeys?.();
    const crsCode = geoKeys?.ProjectedCSTypeGeoKey ?? geoKeys?.GeographicTypeGeoKey ?? 3857;

    const filledElevation = sinkFill(width, height, elevation, noDataValue, 1);
    const { flowDirection, flowAccumulation } = computeD8AndAccumulation(width, height, filledElevation, noDataValue);
    const { junctionPoints } = extractChannels(width, height, flowDirection, flowAccumulation, 100, noDataValue, geotransform, crsCode);

    expect(junctionPoints.features.length).toBe(18);

    const basinIdArray = delineateBasins(width, height, flowDirection, junctionPoints);
    const basinPolygons = vectorizeBasins(width, height, basinIdArray, geotransform, crsCode);

    expect(basinPolygons.features.length).toBe(18);
  });

  it("crops a basin to its bounding box and reports valid/no-data statistics", () => {
    const width = 5;
    const height = 4;
    const noDataValue = -9999;
    const basinIdArray = new Int32Array([
      0, 0, 0, 0, 0,
      0, 1, 1, 1, 0,
      0, 1, 1, 1, 0,
      0, 0, 0, 0, 0,
    ]);
    const filledElevation = new Float32Array([
      0, 0, 0, 0, 0,
      0, 10, -9999, 30, 0,
      0, 20, 40, 50, 0,
      0, 0, 0, 0, 0,
    ]);

    const result = clipAndComputeStats(width, height, filledElevation, basinIdArray, 1, noDataValue, [10, 1, 0, 40, 0, -1]);

    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(result.geotransform).toEqual([11, 1, 0, 39, 0, -1]);
    expect(result.statistics.validCells).toBe(5);
    expect(result.statistics.noDataCells).toBe(1);
    expect(result.statistics.sum).toBe(150);
    expect(result.statistics.count).toBe(5);
    expect(result.clippedElevation.length).toBe(6);
  });

  it("preserves NoData values in flow accumulation", () => {
    const width = 3;
    const height = 3;
    const noDataValue = -9999;
    const dem = new Float32Array([
      -9999, -9999, -9999,
      10, 9, 8,
      7, 6, 5,
    ]);

    const filledElevation = sinkFill(width, height, dem, noDataValue);
    const { flowAccumulation } = computeD8AndAccumulation(width, height, filledElevation, noDataValue);

    expect(flowAccumulation[0]).toBe(noDataValue);
    expect(flowAccumulation[1]).toBe(noDataValue);
    expect(flowAccumulation[2]).toBe(noDataValue);
    expect(flowAccumulation[3]).toBeGreaterThanOrEqual(1);
    expect(flowAccumulation[8]).toBeGreaterThanOrEqual(1);
  });
});
