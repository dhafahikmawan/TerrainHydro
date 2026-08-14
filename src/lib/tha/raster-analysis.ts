import {
  readRasterFromFile,
  writeFloat32TiledGeoTIFF,
  generateGeoTIFFBlobFromRaster,
} from '../utils/geotiff-processor.js';

/**
 * Calculates the slope of a DEM using Horn's method (3x3 neighborhood).
 *
 * @param input - The input DEM GeoTIFF file
 * @returns A Promise resolving to a Blob containing the single-band slope raster
 */
export async function generateSlope(
  input: File,
  unit: string = 'Degrees',
  zFactor: number = 1.0
): Promise<Blob> {
  const raster = await readRasterFromFile(input);
  const { width, height, data, geotransform, crsCode, noDataValue, bandCount } = raster;

  const outputData = new Float32Array(width * height);
  const cellsize_x = Math.abs(geotransform[1]);
  const cellsize_y = Math.abs(geotransform[5]);

  const cx = cellsize_x === 0 ? 1.0 : cellsize_x;
  const cy = cellsize_y === 0 ? 1.0 : cellsize_y;

  const actualZFactor = typeof zFactor === 'number' && !Number.isNaN(zFactor) ? zFactor : 1.0;
  const actualUnit = unit || 'Degrees';

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const getElevation = (col: number, row: number): number => {
    const c = clamp(col, 0, width - 1);
    const r = clamp(row, 0, height - 1);
    const pixelIdx = r * width + c;
    return data[pixelIdx * bandCount]; // band 1 (0-indexed offset)
  };

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const a = getElevation(col - 1, row - 1);
      const b = getElevation(col, row - 1);
      const cVal = getElevation(col + 1, row - 1);
      const d = getElevation(col - 1, row);
      const e = getElevation(col, row);
      const f = getElevation(col + 1, row);
      const g = getElevation(col - 1, row + 1);
      const h = getElevation(col, row + 1);
      const i = getElevation(col + 1, row + 1);

      // Check if center or any neighbor is NoData
      if (
        a === noDataValue || b === noDataValue || cVal === noDataValue ||
        d === noDataValue || e === noDataValue || f === noDataValue ||
        g === noDataValue || h === noDataValue || i === noDataValue ||
        Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(cVal) ||
        Number.isNaN(d) || Number.isNaN(e) || Number.isNaN(f) ||
        Number.isNaN(g) || Number.isNaN(h) || Number.isNaN(i)
      ) {
        outputData[row * width + col] = noDataValue;
        continue;
      }

      // Horn's gradients with Z-factor applied
      const dz_dx = (((cVal + 2 * f + i) - (a + 2 * d + g)) / (8 * cx)) * actualZFactor;
      const dz_dy = (((g + 2 * h + i) - (a + 2 * b + cVal)) / (8 * cy)) * actualZFactor;

      const rise_run = Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy);
      
      let val = 0;
      if (actualUnit === 'Percent') {
        val = rise_run * 100;
      } else if (actualUnit === 'Ratio') {
        val = rise_run;
      } else {
        // default/Degrees
        const slope_rad = Math.atan(rise_run);
        val = slope_rad * (180 / Math.PI);
      }

      outputData[row * width + col] = val;
    }
  }

  const outputBuffer = writeFloat32TiledGeoTIFF(width, height, outputData, geotransform, crsCode, 1);
  return new Blob([outputBuffer], { type: 'image/tiff' });
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

/**
 * Generates NDVI (Normalized Difference Vegetation Index) from NIR and Red bands.
 * Formula: (NIR - Red) / (NIR + Red)
 *
 * @param nirFile - NIR GeoTIFF file
 * @param nirBand - 1-based band index for NIR
 * @param redFile - Red GeoTIFF file
 * @param redBand - 1-based band index for Red
 * @returns A Promise resolving to a Blob containing the single-band NDVI raster
 */
export async function generateNDVI(
  nirFile: File,
  nirBand: number,
  redFile: File,
  redBand: number
): Promise<Blob> {
  const nirRaster = await readRasterFromFile(nirFile);
  const redRaster = await readRasterFromFile(redFile);

  if (nirRaster.width !== redRaster.width || nirRaster.height !== redRaster.height) {
    throw new Error('Input raster dimensions do not match');
  }

  const width = nirRaster.width;
  const height = nirRaster.height;
  const outputData = new Float32Array(width * height);

  const nirData = nirRaster.data;
  const redData = redRaster.data;
  const nirBandCount = nirRaster.bandCount;
  const redBandCount = redRaster.bandCount;
  const nirNoData = nirRaster.noDataValue;
  const redNoData = redRaster.noDataValue;

  for (let i = 0; i < width * height; i++) {
    const nirVal = nirData[i * nirBandCount + (nirBand - 1)];
    const redVal = redData[i * redBandCount + (redBand - 1)];

    if (
      nirVal === nirNoData || redVal === redNoData ||
      Number.isNaN(nirVal) || Number.isNaN(redVal)
    ) {
      outputData[i] = Number.NaN;
      continue;
    }

    const denom = nirVal + redVal;
    if (denom === 0) {
      outputData[i] = Number.NaN;
    } else {
      outputData[i] = (nirVal - redVal) / denom;
    }
  }

  const outputBuffer = writeFloat32TiledGeoTIFF(
    width,
    height,
    outputData,
    nirRaster.geotransform,
    nirRaster.crsCode,
    1
  );
  return new Blob([outputBuffer], { type: 'image/tiff' });
}

/**
 * Generates NDWI (Normalized Difference Water Index) from Green and NIR bands.
 * Formula: (Green - NIR) / (Green + NIR)
 *
 * @param nirFile - NIR GeoTIFF file
 * @param nirBand - 1-based band index for NIR
 * @param greenFile - Green GeoTIFF file
 * @param greenBand - 1-based band index for Green
 * @returns A Promise resolving to a Blob containing the single-band NDWI raster
 */
export async function generateNDWI(
  nirFile: File,
  nirBand: number,
  greenFile: File,
  greenBand: number
): Promise<Blob> {
  const nirRaster = await readRasterFromFile(nirFile);
  const greenRaster = await readRasterFromFile(greenFile);

  if (nirRaster.width !== greenRaster.width || nirRaster.height !== greenRaster.height) {
    throw new Error('Input raster dimensions do not match');
  }

  const width = nirRaster.width;
  const height = nirRaster.height;
  const outputData = new Float32Array(width * height);

  const nirData = nirRaster.data;
  const greenData = greenRaster.data;
  const nirBandCount = nirRaster.bandCount;
  const greenBandCount = greenRaster.bandCount;
  const nirNoData = nirRaster.noDataValue;
  const greenNoData = greenRaster.noDataValue;

  for (let i = 0; i < width * height; i++) {
    const nirVal = nirData[i * nirBandCount + (nirBand - 1)];
    const greenVal = greenData[i * greenBandCount + (greenBand - 1)];

    if (
      nirVal === nirNoData || greenVal === greenNoData ||
      Number.isNaN(nirVal) || Number.isNaN(greenVal)
    ) {
      outputData[i] = Number.NaN;
      continue;
    }

    const denom = greenVal + nirVal;
    if (denom === 0) {
      outputData[i] = Number.NaN;
    } else {
      outputData[i] = (greenVal - nirVal) / denom;
    }
  }

  const outputBuffer = writeFloat32TiledGeoTIFF(
    width,
    height,
    outputData,
    greenRaster.geotransform,
    greenRaster.crsCode,
    1
  );
  return new Blob([outputBuffer], { type: 'image/tiff' });
}