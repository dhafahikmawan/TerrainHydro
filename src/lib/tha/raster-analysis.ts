
import { generateGeoTIFFBlobFromRaster } from '../utils/geotiff-processor.js';

export function generateSlope(input: File) {
  return new Blob([input], { type: 'image/tiff' });
}

/**
 * Generates a tiled GeoTIFF from an input raster file.
 * Converts the input raster into a tiled Float32 GeoTIFF format compatible with GeoLibre.
 *
 * @param input - The input GeoTIFF file
 * @returns A Promise resolving to a Blob containing the tiled GeoTIFF
 */
export async function generateTiled(input: File): Promise<Blob> {
  return generateGeoTIFFBlobFromRaster(input);
}