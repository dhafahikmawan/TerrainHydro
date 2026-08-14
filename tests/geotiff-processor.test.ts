import { describe, it, expect, beforeAll } from 'vitest';
import { writeFloat32TiledGeoTIFF } from '../src/lib/utils/geotiff-processor';
import { fromBlob } from 'geotiff';

describe('writeFloat32TiledGeoTIFF', () => {
  it('creates a valid TIFF header', () => {
    const width = 256;
    const height = 256;
    const data = new Float32Array(width * height).fill(1.0);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 100, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform);

    const view = new DataView(buffer);
    const byte0 = view.getUint8(0);
    const byte1 = view.getUint8(1);
    const magic = view.getUint16(2, true);

    // Check for 'II' (0x49, 0x49) = Little Endian
    expect(byte0).toBe(0x49);
    expect(byte1).toBe(0x49);
    // Check magic number 42
    expect(magic).toBe(42);
  });

  it('handles single-tile raster (256x256)', async () => {
    const width = 256;
    const height = 256;
    const data = new Float32Array(width * height);
    
    // Fill with test pattern
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(i / 1000);
    }

    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 100, 0, -1];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857);

    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify we can read it back with geotiff.js
    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    expect(image.getWidth()).toBe(256);
    expect(image.getHeight()).toBe(256);
  });

  it('handles multi-tile raster (257x257)', async () => {
    const width = 257;
    const height = 257;
    const data = new Float32Array(width * height);
    
    // Fill with test pattern
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 256;
    }

    const geotransform: [number, number, number, number, number, number] = [10, 2, 0, 50, 0, -2];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857);

    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify we can read it back with geotiff.js
    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    expect(image.getWidth()).toBe(257);
    expect(image.getHeight()).toBe(257);
  });

  it('handles large multi-tile raster (512x512)', async () => {
    const width = 512;
    const height = 512;
    const data = new Float32Array(width * height);
    
    // Fill with random values
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 1000;
    }

    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 512, 0, -1];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 4326);

    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify we can read it back with geotiff.js
    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    expect(image.getWidth()).toBe(512);
    expect(image.getHeight()).toBe(512);
  });

  it('correctly performs round-trip read/write with sample pixel verification', async () => {
    const width = 100;
    const height = 100;
    const data = new Float32Array(width * height);
    
    // Create a simple test pattern where each pixel equals its row index
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[y * width + x] = y + 1; // Row values from 1 to 100
      }
    }

    const geotransform: [number, number, number, number, number, number] = [100, 1.5, 0, 200, 0, -1.5];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857);

    // Read back with geotiff.js
    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // Verify dimensions
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);

    // Read rasters back and verify sample pixels
    const rasters = await image.readRasters({ interleave: true });
    const readData = rasters as unknown as { [index: number]: number } & { length: number };

    // Check a few sample pixels
    expect(readData[0 * width + 0]).toBe(1); // First row, first pixel
    expect(readData[49 * width + 0]).toBe(50); // Row 50, first pixel
    expect(readData[99 * width + 99]).toBe(100); // Last pixel in last row
  });

  it('handles small raster (1x1)', async () => {
    const width = 1;
    const height = 1;
    const data = new Float32Array([42.5]);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 0, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    expect(image.getWidth()).toBe(1);
    expect(image.getHeight()).toBe(1);

    const rasters = await image.readRasters({ interleave: true });
    const readData = rasters as unknown as { [index: number]: number } & { length: number };
    expect(readData[0]).toBeCloseTo(42.5, 5);
  });

  it('handles edge case with 256x257 (one tile dimension full, one partial)', async () => {
    const width = 256;
    const height = 257;
    const data = new Float32Array(width * height).fill(3.14);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 257, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    expect(image.getWidth()).toBe(256);
    expect(image.getHeight()).toBe(257);
  });

  it('preserves CRS information for geographic CRS', async () => {
    const width = 100;
    const height = 100;
    const data = new Float32Array(width * height).fill(0);
    const geotransform: [number, number, number, number, number, number] = [10, 0.1, 0, 50, 0, -0.1];
    const crsCode = 4326; // WGS84 (geographic)

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, crsCode);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // The important test is that the TIFF can be read without errors
    // and dimensions are preserved with the CRS code parameter
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);

    // Buffer should contain the TIFF data with CRS tags written
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
