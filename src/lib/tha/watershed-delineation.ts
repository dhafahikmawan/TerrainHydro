import type { FeatureCollection, GeoJsonProperties } from "geojson";
import type { RasterSource } from "../utils/geotiff-processor";
import { MinHeap } from "./heap";

export type DemData = RasterSource;
export interface DelineationParams { zLimit: number; threshold: number; }
export interface ElevationStatistics { min: number; max: number; mean: number; stdDev: number; count: number; }
export interface DelineationResult {
  filledElevation: Float32Array;
  flowDirection: Uint8Array;
  flowAccumulation: Float32Array;
  channelNetwork: FeatureCollection;
  junctionPoints: FeatureCollection;
  basinIdArray: Int32Array;
  basinPolygons: FeatureCollection;
}
export type ProgressCallback = (step: number, msg: string) => void;
let activeWorker: Worker | null = null;

const ROWS = [-1, -1, -1, 0, 0, 1, 1, 1];
const COLS = [-1, 0, 1, -1, 1, -1, 0, 1];
const CODES = [32, 64, 128, 16, 1, 8, 4, 2];
const DISTANCES = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2];

export function isNoData(value: number, noDataValue: number): boolean {
  return Number.isNaN(value) || (!Number.isNaN(noDataValue) && value === noDataValue);
}
export function canonicalNoData(noDataValue: number): number { return Number.isNaN(noDataValue) ? -9999 : noDataValue; }
export function reprojectCoords(x: number, y: number, crsCode: number): [number, number] {
  if (crsCode === 4326 || (crsCode >= 4000 && crsCode < 5000)) return [x, y];
  if (crsCode === 3857 || crsCode === 900913 || crsCode === 3785) {
    const halfCircumference = 20037508.342789244;
    const longitude = x / halfCircumference * 180;
    const latitude = Math.max(-85.051129, Math.min(85.051129, (2 * Math.atan(Math.exp(y / halfCircumference * Math.PI)) - Math.PI / 2) * 180 / Math.PI));
    return [longitude, latitude];
  }
  return [x, y];
}

function neighbor(index: number, code: number, width: number, height: number): number {
  if (code === 0) return -1;
  const row = Math.floor(index / width), col = index % width;
  let nextRow = row, nextCol = col;
  if (code === 32 || code === 64 || code === 128) nextRow--;
  if (code === 8 || code === 4 || code === 2) nextRow++;
  if (code === 32 || code === 16 || code === 8) nextCol--;
  if (code === 128 || code === 1 || code === 2) nextCol++;
  return nextRow >= 0 && nextRow < height && nextCol >= 0 && nextCol < width ? nextRow * width + nextCol : -1;
}

export function sinkFill(width: number, height: number, elevation: Float32Array, noDataValue: number, zLimit = Infinity): Float32Array {
  const size = width * height, filled = new Float32Array(size), visited = new Uint8Array(size);
  filled.fill(Infinity);
  const heap = new MinHeap<{ index: number; value: number }>((a, b) => a.value - b.value);
  const outputNoData = canonicalNoData(noDataValue);
  for (let index = 0; index < size; index++) {
    const row = Math.floor(index / width), col = index % width;
    const boundary = row === 0 || row === height - 1 || col === 0 || col === width - 1;
    if (isNoData(elevation[index], noDataValue) || boundary) {
      const nodata = isNoData(elevation[index], noDataValue);
      filled[index] = nodata ? outputNoData : elevation[index];
      visited[index] = 1;
      if (!nodata) heap.push({ index, value: elevation[index] });
    }
  }
  while (heap.length) {
    const current = heap.pop()!;
    const row = Math.floor(current.index / width), col = current.index % width;
    for (let direction = 0; direction < 8; direction++) {
      const nextRow = row + ROWS[direction], nextCol = col + COLS[direction];
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
      const next = nextRow * width + nextCol;
      if (visited[next]) continue;
      visited[next] = 1;
      if (isNoData(elevation[next], noDataValue)) { filled[next] = outputNoData; continue; }
      const fillValue = Math.max(elevation[next], filled[current.index]);
      filled[next] = fillValue - elevation[next] <= zLimit ? fillValue : elevation[next];
      heap.push({ index: next, value: filled[next] });
    }
  }
  return filled;
}

export function computeD8AndAccumulation(width: number, height: number, filledDEM: Float32Array, noDataValue: number): { flowDirection: Uint8Array; flowAccumulation: Float32Array } {
  const size = width * height, directions = new Uint8Array(size), accumulation = new Float32Array(size), incoming = new Int32Array(size);
  accumulation.fill(1);
  for (let index = 0; index < size; index++) {
    if (isNoData(filledDEM[index], noDataValue)) continue;
    const row = Math.floor(index / width), col = index % width;
    let steepest = 0, target = -1, code = 0;
    for (let direction = 0; direction < 8; direction++) {
      const nextRow = row + ROWS[direction], nextCol = col + COLS[direction];
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue;
      const next = nextRow * width + nextCol;
      if (isNoData(filledDEM[next], noDataValue)) continue;
      const slope = (filledDEM[index] - filledDEM[next]) / DISTANCES[direction];
      if (slope > steepest) { steepest = slope; code = CODES[direction]; target = next; }
    }
    directions[index] = code;
    if (target >= 0) incoming[target]++;
  }
  const queue: number[] = [];
  for (let index = 0; index < size; index++) if (!isNoData(filledDEM[index], noDataValue) && incoming[index] === 0) queue.push(index);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const code = directions[current];
    if (code === 0) continue;
    const next = neighbor(current, code, width, height);
    if (next < 0 || isNoData(filledDEM[next], noDataValue)) continue;
    accumulation[next] += accumulation[current];
    if (--incoming[next] === 0) queue.push(next);
  }
  return { flowDirection: directions, flowAccumulation: accumulation };
}

function pixelCoords(index: number, width: number, transform: number[], crsCode: number): [number, number] {
  const row = Math.floor(index / width), col = index % width;
  return reprojectCoords(transform[0] + col * transform[1] + row * transform[2], transform[3] + col * transform[4] + row * transform[5], crsCode);
}

export function extractChannels(width: number, height: number, flowDirection: Uint8Array, flowAccumulation: Float32Array, threshold: number, geotransform: number[], crsCode = 4326): { channelNetwork: FeatureCollection; junctionPoints: FeatureCollection } {
  const size = width * height, channel = new Uint8Array(size), incoming = new Uint8Array(size), nextCell = new Int32Array(size); nextCell.fill(-1);
  const effectiveThreshold = Math.max(1, threshold);
  for (let index = 0; index < size; index++) {
    if (flowAccumulation[index] < effectiveThreshold) continue;
    channel[index] = 1;
    const code = flowDirection[index];
    if (code === 0) continue;
    const next = neighbor(index, code, width, height);
    if (next >= 0 && flowAccumulation[next] >= effectiveThreshold) { nextCell[index] = next; incoming[next]++; }
  }
  const junctionPoints = [] as FeatureCollection["features"];
  for (let index = 0; index < size; index++) if (channel[index] && incoming[index] >= 2) junctionPoints.push({ type: "Feature", properties: { cellIndex: index, inDegree: incoming[index] }, geometry: { type: "Point", coordinates: pixelCoords(index, width, geotransform, crsCode) } });
  const visited = new Uint8Array(size), lines = [] as FeatureCollection["features"];
  for (let start = 0; start < size; start++) {
    if (!channel[start] || visited[start] || (incoming[start] !== 0 && incoming[start] < 2)) continue;
    let current = start; const coordinates = [pixelCoords(current, width, geotransform, crsCode)]; visited[current] = 1;
    while (nextCell[current] >= 0) { const next = nextCell[current]; coordinates.push(pixelCoords(next, width, geotransform, crsCode)); if (incoming[next] >= 2 || visited[next]) break; visited[next] = 1; current = next; }
    if (coordinates.length > 1) lines.push({ type: "Feature", properties: { sourceIndex: start, segmentLength: coordinates.length }, geometry: { type: "LineString", coordinates } });
  }
  return { channelNetwork: { type: "FeatureCollection", features: lines }, junctionPoints: { type: "FeatureCollection", features: junctionPoints } };
}

export function delineateBasins(width: number, height: number, flowDirection: Uint8Array, junctions: FeatureCollection): Int32Array {
  const basins = new Int32Array(width * height);
  const inflow = (neighborIndex: number, center: number): number => {
    const dr = Math.floor(neighborIndex / width) - Math.floor(center / width), dc = neighborIndex % width - center % width;
    const codes: Record<string, number> = { "-1,-1": 2, "-1,0": 4, "-1,1": 8, "0,-1": 1, "0,1": 16, "1,-1": 128, "1,0": 64, "1,1": 32 };
    return codes[`${dr},${dc}`] ?? 0;
  };
  junctions.features.forEach((feature, basinIndex) => {
    const start = Number((feature.properties as GeoJsonProperties)?.cellIndex); if (!Number.isInteger(start) || start < 0 || start >= basins.length) return;
    basins[start] = basinIndex + 1; const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head], row = Math.floor(current / width), col = current % width;
      for (let direction = 0; direction < 8; direction++) { const nextRow = row + ROWS[direction], nextCol = col + COLS[direction]; if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) continue; const next = nextRow * width + nextCol; if (!basins[next] && flowDirection[next] === inflow(next, current)) { basins[next] = basinIndex + 1; queue.push(next); } }
    }
  });
  return basins;
}

export function vectorizeBasins(width: number, height: number, basinIdArray: Int32Array, geotransform: number[], crsCode = 4326): FeatureCollection {
  const corner = (col: number, row: number) => reprojectCoords(geotransform[0] + col * geotransform[1] + row * geotransform[2], geotransform[3] + col * geotransform[4] + row * geotransform[5], crsCode);
  const ids = new Set<number>(); for (const id of basinIdArray) if (id > 0) ids.add(id);
  const features = [] as FeatureCollection["features"];
  for (const id of ids) {
    const edges = new Map<string, string[]>(), add = (a: string, b: string) => edges.set(a, [...(edges.get(a) ?? []), b]);
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) if (basinIdArray[row * width + col] === id) {
      if (row === 0 || basinIdArray[(row - 1) * width + col] !== id) add(`${col + 1},${row}`, `${col},${row}`);
      if (row === height - 1 || basinIdArray[(row + 1) * width + col] !== id) add(`${col},${row + 1}`, `${col + 1},${row + 1}`);
      if (col === 0 || basinIdArray[row * width + col - 1] !== id) add(`${col},${row}`, `${col},${row + 1}`);
      if (col === width - 1 || basinIdArray[row * width + col + 1] !== id) add(`${col + 1},${row + 1}`, `${col + 1},${row}`);
    }
    const rings: [number, number][][] = [];
    while (edges.size) { const start = edges.keys().next().value as string; let current = start; const ring: [number, number][] = []; let closed = false; while (edges.has(current)) { const [col, row] = current.split(",").map(Number); ring.push(corner(col, row)); const nexts = edges.get(current)!; const next = nexts.pop()!; if (!nexts.length) edges.delete(current); current = next; if (current === start) { const [startCol, startRow] = start.split(",").map(Number); ring.push(corner(startCol, startRow)); closed = true; break; } } if (closed && ring.length >= 4) rings.push(ring); }
    if (rings.length) features.push({ type: "Feature", properties: { basinId: id }, geometry: { type: "Polygon", coordinates: rings } });
  }
  return { type: "FeatureCollection", features };
}

export function clipAndComputeStats(width: number, height: number, filledElevation: Float32Array, basinIdArray: Int32Array, selectedBasinId: number, noDataValue: number): { clippedElevation: Float32Array; statistics: ElevationStatistics } {
  const outputNoData = canonicalNoData(noDataValue), clippedElevation = new Float32Array(width * height); clippedElevation.fill(outputNoData);
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (let index = 0; index < clippedElevation.length; index++) if (basinIdArray[index] === selectedBasinId && !isNoData(filledElevation[index], noDataValue)) { const value = filledElevation[index]; clippedElevation[index] = value; min = Math.min(min, value); max = Math.max(max, value); sum += value; count++; }
  const mean = count ? sum / count : 0; let squared = 0;
  for (let index = 0; index < clippedElevation.length; index++) if (basinIdArray[index] === selectedBasinId && !isNoData(filledElevation[index], noDataValue)) squared += (filledElevation[index] - mean) ** 2;
  return { clippedElevation, statistics: { min: count ? min : outputNoData, max: count ? max : outputNoData, mean, stdDev: count ? Math.sqrt(squared / count) : 0, count } };
}

export function runDelineationDirect(
  dem: DemData,
  params: DelineationParams,
  onProgress?: ProgressCallback
): DelineationResult {
  onProgress?.(2, "Sink-filling DEM...");
  const filledElevation = sinkFill(dem.width, dem.height, dem.data, dem.noDataValue, params.zLimit > 0 ? params.zLimit : Infinity);
  onProgress?.(3, "Computing flow direction and accumulation...");
  const flow = computeD8AndAccumulation(dem.width, dem.height, filledElevation, dem.noDataValue);
  onProgress?.(4, "Extracting channels and junctions...");
  const channels = extractChannels(dem.width, dem.height, flow.flowDirection, flow.flowAccumulation, params.threshold, dem.geotransform, dem.crsCode);
  onProgress?.(5, "Delineating subbasins...");
  const basinIdArray = delineateBasins(dem.width, dem.height, flow.flowDirection, channels.junctionPoints);
  onProgress?.(6, "Vectorizing watershed basins...");
  const basinPolygons = vectorizeBasins(dem.width, dem.height, basinIdArray, dem.geotransform, dem.crsCode);
  return { filledElevation, ...flow, ...channels, basinIdArray, basinPolygons };
}

function createDelineationWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error("Web Workers are not supported in this browser.");
  }

  const hasMetaUrl = typeof import.meta !== "undefined" && typeof import.meta.url === "string" && import.meta.url.length > 0;
  if (!hasMetaUrl) {
    throw new Error("Failed to initialize delineation worker: import.meta.url is unavailable in this environment.");
  }

  try {
    const workerUrl = new URL("./delineation.worker.ts", import.meta.url);
    return new Worker(workerUrl, { type: "module" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize delineation worker: ${message}`);
  }
}

export async function runDelineation(dem: DemData, params: DelineationParams, onProgress?: ProgressCallback): Promise<DelineationResult> {
  if (typeof Worker !== "undefined") {
    try {
      return await new Promise<DelineationResult>((resolve, reject) => {
        let worker: Worker;
        try {
          worker = createDelineationWorker();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        activeWorker = worker;
        worker.onmessage = (event: MessageEvent) => {
          if (event.data.type === "PROGRESS") onProgress?.(event.data.step, event.data.msg);
          if (event.data.type === "COMPLETE") { worker.terminate(); activeWorker = null; resolve(event.data.payload as DelineationResult); }
          if (event.data.type === "ERROR") { worker.terminate(); activeWorker = null; reject(new Error(event.data.error)); }
        };
        worker.onerror = (event) => { worker.terminate(); activeWorker = null; reject(new Error(event.message || "Worker initialization/runtime error")); };
        worker.postMessage({ type: "RUN_DELINEATION", payload: { ...dem, elevation: dem.data, zLimit: params.zLimit, threshold: params.threshold } });
      });
    } catch (workerErr) {
      console.warn("Worker failed, falling back to direct computation:", workerErr);
      return runDelineationDirect(dem, params, onProgress);
    }
  }

  return runDelineationDirect(dem, params, onProgress);
}

export function terminateWorker(): void { activeWorker?.terminate(); activeWorker = null; }