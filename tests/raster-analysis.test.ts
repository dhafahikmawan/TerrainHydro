import { describe, it, expect } from 'vitest';
import { generateSlope, generateNDVI, generateNDWI } from '../src/lib/tha/raster-analysis';
import { writeFloat32TiledGeoTIFF, readRasterFromFile } from '../src/lib/utils/geotiff-processor';

describe('Raster Analysis', () => {
  describe('Slope (Horn Method)', () => {
    it('calculates 0 degree slope for a flat surface', async () => {
      const width = 3;
      const height = 3;
      const data = new Float32Array(width * height).fill(100.0);
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, 1);
      const input = new File([buffer], 'dem.tif', { type: 'image/tiff' });

      const slopeBlob = await generateSlope(input);
      const slopeFile = new File([slopeBlob], 'slope.tif', { type: 'image/tiff' });
      const slopeRaster = await readRasterFromFile(slopeFile);

      expect(slopeRaster.width).toBe(width);
      expect(slopeRaster.height).toBe(height);
      // Flat surface should have slope of 0.0
      expect(slopeRaster.data[4]).toBeCloseTo(0, 5);
    });

    it('calculates 45 degree slope for a constant elevation ramp', async () => {
      const width = 3;
      const height = 3;
      // Constant X gradient ramp:
      // Row 0: 0, 10, 20
      // Row 1: 0, 10, 20
      // Row 2: 0, 10, 20
      const data = new Float32Array([
        0, 10, 20,
        0, 10, 20,
        0, 10, 20
      ]);
      // cellsize = 10
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, 1);
      const input = new File([buffer], 'dem.tif', { type: 'image/tiff' });

      const slopeBlob = await generateSlope(input);
      const slopeFile = new File([slopeBlob], 'slope.tif', { type: 'image/tiff' });
      const slopeRaster = await readRasterFromFile(slopeFile);

      // Center pixel (1, 1) has slope of 45 degrees
      expect(slopeRaster.data[4]).toBeCloseTo(45.0, 2);
    });

    it('sets output to -9999 when center or neighbor is NoData', async () => {
      const width = 3;
      const height = 3;
      const data = new Float32Array([
        10, 10, 10,
        10, -9999, 10,
        10, 10, 10
      ]);
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, 1);
      const input = new File([buffer], 'dem.tif', { type: 'image/tiff' });

      const slopeBlob = await generateSlope(input);
      const slopeFile = new File([slopeBlob], 'slope.tif', { type: 'image/tiff' });
      const slopeRaster = await readRasterFromFile(slopeFile);

      // The center pixel should be -9999
      expect(slopeRaster.data[4]).toBe(-9999);
    });
  });

  describe('NDVI', () => {
    it('correctly calculates NDVI values', async () => {
      const width = 2;
      const height = 2;
      const nirData = new Float32Array([10, 20, 30, 40]);
      const redData = new Float32Array([5, 5, 10, 20]);
      
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      
      const nirBuffer = writeFloat32TiledGeoTIFF(width, height, nirData, geotransform, 3857, 1);
      const redBuffer = writeFloat32TiledGeoTIFF(width, height, redData, geotransform, 3857, 1);

      const nirFile = new File([nirBuffer], 'nir.tif', { type: 'image/tiff' });
      const redFile = new File([redBuffer], 'red.tif', { type: 'image/tiff' });

      const ndviBlob = await generateNDVI(nirFile, 1, redFile, 1);
      const ndviFile = new File([ndviBlob], 'ndvi.tif', { type: 'image/tiff' });
      const ndviRaster = await readRasterFromFile(ndviFile);

      expect(ndviRaster.width).toBe(width);
      expect(ndviRaster.height).toBe(height);
      
      // NDVI = (NIR - Red) / (NIR + Red)
      // Pixel 0: (10 - 5) / 15 = 0.333333
      expect(ndviRaster.data[0]).toBeCloseTo(0.333333, 4);
      // Pixel 1: (20 - 5) / 25 = 0.6
      expect(ndviRaster.data[1]).toBeCloseTo(0.6, 4);
    });

    it('throws error for mismatched dimensions', async () => {
      const nirData = new Float32Array([10, 20, 30, 40]);
      const redData = new Float32Array([5, 5]);
      
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      
      const nirBuffer = writeFloat32TiledGeoTIFF(2, 2, nirData, geotransform, 3857, 1);
      const redBuffer = writeFloat32TiledGeoTIFF(1, 2, redData, geotransform, 3857, 1);

      const nirFile = new File([nirBuffer], 'nir.tif', { type: 'image/tiff' });
      const redFile = new File([redBuffer], 'red.tif', { type: 'image/tiff' });

      await expect(generateNDVI(nirFile, 1, redFile, 1)).rejects.toThrow('Input raster dimensions do not match');
    });
  });

  describe('NDWI', () => {
    it('correctly calculates NDWI values', async () => {
      const width = 2;
      const height = 2;
      const nirData = new Float32Array([10, 20, 30, 40]);
      const greenData = new Float32Array([15, 25, 10, 20]);
      
      const geotransform: [number, number, number, number, number, number] = [0, 10, 0, 100, 0, -10];
      
      const nirBuffer = writeFloat32TiledGeoTIFF(width, height, nirData, geotransform, 3857, 1);
      const greenBuffer = writeFloat32TiledGeoTIFF(width, height, greenData, geotransform, 3857, 1);

      const nirFile = new File([nirBuffer], 'nir.tif', { type: 'image/tiff' });
      const greenFile = new File([greenBuffer], 'green.tif', { type: 'image/tiff' });

      const ndwiBlob = await generateNDWI(nirFile, 1, greenFile, 1);
      const ndwiFile = new File([ndwiBlob], 'ndwi.tif', { type: 'image/tiff' });
      const ndwiRaster = await readRasterFromFile(ndwiFile);

      // NDWI = (Green - NIR) / (Green + NIR)
      // Pixel 0: (15 - 10) / 25 = 0.2
      expect(ndwiRaster.data[0]).toBeCloseTo(0.2, 4);
    });
  });
});
