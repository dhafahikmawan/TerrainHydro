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
} from "../src/lib/tha/watershed-delineation";

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
    const { junctionPoints } = extractChannels(width, height, flowDirection, flowAccumulation, 100, geotransform, crsCode);

    expect(junctionPoints.features.length).toBe(18);

    const basinIdArray = delineateBasins(width, height, flowDirection, junctionPoints);
    const basinPolygons = vectorizeBasins(width, height, basinIdArray, geotransform, crsCode);

    expect(basinPolygons.features.length).toBe(18);
  });
});
