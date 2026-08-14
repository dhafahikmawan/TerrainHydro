import { describe, it, expect } from 'vitest';
import { writeFloat32TiledGeoTIFF, getGeoTIFFBandCount } from '../src/lib/utils/geotiff-processor';
import { fromBlob } from 'geotiff';

describe('Multi-Band GeoTIFF Support', () => {
  it('writeFloat32TiledGeoTIFF preserves bandCount in SamplesPerPixel tag for 2-band', async () => {
    const width = 50;
    const height = 50;
    const bandCount = 2;
    const data = new Float32Array(width * height * bandCount);

    // Fill with test data (bandCount * pixels worth of data)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 100;
    }

    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 50, 0, -1];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, bandCount);

    // Verify the output TIFF structure and band count metadata
    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // Verify dimensions preserved
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);

    // Verify band count is preserved in SamplesPerPixel tag (tag 277)
    const fd = image.getFileDirectory();
    const readBandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;
    expect(readBandCount).toBe(2);
  });

  it('writeFloat32TiledGeoTIFF preserves bandCount in SamplesPerPixel tag for 3-band', async () => {
    const width = 30;
    const height = 30;
    const bandCount = 3;
    const data = new Float32Array(width * height * bandCount);

    // Fill with test data
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 255;
    }

    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 30, 0, -1];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, bandCount);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // Verify dimensions
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);

    // Verify band count
    const fd = image.getFileDirectory();
    const readBandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;
    expect(readBandCount).toBe(3);
  });

  it('getGeoTIFFBandCount returns correct count for 2-band raster', async () => {
    const width = 50;
    const height = 50;
    const bandCount = 2;
    const data = new Float32Array(width * height * bandCount).fill(1.0);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 50, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, bandCount);
    const blob = new File([buffer], 'two-band.tif', { type: 'image/tiff' });

    const readBandCount = await getGeoTIFFBandCount(blob);
    expect(readBandCount).toBe(2);
  });

  it('getGeoTIFFBandCount returns correct count for 3-band raster', async () => {
    const width = 50;
    const height = 50;
    const bandCount = 3;
    const data = new Float32Array(width * height * bandCount).fill(1.0);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 50, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, bandCount);
    const blob = new File([buffer], 'three-band.tif', { type: 'image/tiff' });

    const readBandCount = await getGeoTIFFBandCount(blob);
    expect(readBandCount).toBe(3);
  });

  it('getGeoTIFFBandCount returns 1 for single-band raster', async () => {
    const width = 50;
    const height = 50;
    const data = new Float32Array(width * height).fill(42.0);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 50, 0, -1];

    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, 1);
    const blob = new File([buffer], 'single-band.tif', { type: 'image/tiff' });

    const bandCount = await getGeoTIFFBandCount(blob);
    expect(bandCount).toBe(1);
  });

  it('multi-tile multi-band raster preserves band count metadata', async () => {
    const width = 257; // Multi-tile
    const height = 257;
    const bandCount = 2;
    const data = new Float32Array(width * height * bandCount);

    // Fill with test pattern
    for (let i = 0; i < data.length; i += bandCount) {
      data[i] = 100;
      data[i + 1] = 200;
    }

    const geotransform: [number, number, number, number, number, number] = [10, 2, 0, 100, 0, -2];
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857, bandCount);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // Verify band count
    const fd = image.getFileDirectory();
    const readBandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;
    expect(readBandCount).toBe(2);

    // Verify dimensions
    expect(image.getWidth()).toBe(width);
    expect(image.getHeight()).toBe(height);
  });

  it('bandCount parameter defaults to 1 when not provided', async () => {
    const width = 100;
    const height = 100;
    const data = new Float32Array(width * height).fill(5.0);
    const geotransform: [number, number, number, number, number, number] = [0, 1, 0, 100, 0, -1];

    // Call without bandCount parameter
    const buffer = writeFloat32TiledGeoTIFF(width, height, data, geotransform, 3857);

    const blob = new Blob([buffer], { type: 'image/tiff' });
    const tiff = await fromBlob(blob);
    const image = await tiff.getImage();

    // Verify band count defaults to 1
    const fd = image.getFileDirectory();
    const bandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;
    expect(bandCount).toBe(1);
  });
});
