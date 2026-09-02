import { computeD8AndAccumulation, delineateBasins, extractChannels, sinkFill, vectorizeBasins } from "./watershed-delineation";

self.onmessage = (event: MessageEvent) => {
  if (event.data?.type !== "RUN_DELINEATION") return;
  const payload = event.data.payload;
  try {
    self.postMessage({ type: "PROGRESS", step: 2, msg: "Sink-filling DEM..." });
    const filledElevation = sinkFill(payload.width, payload.height, payload.elevation, payload.noDataValue, payload.zLimit > 0 ? payload.zLimit : Infinity);
    self.postMessage({ type: "PROGRESS", step: 3, msg: "Computing flow direction and accumulation..." });
    const flow = computeD8AndAccumulation(payload.width, payload.height, filledElevation, payload.noDataValue);
    self.postMessage({ type: "PROGRESS", step: 4, msg: "Extracting channels and junctions..." });
    const channels = extractChannels(payload.width, payload.height, flow.flowDirection, flow.flowAccumulation, payload.threshold, payload.noDataValue, payload.geotransform, payload.crsCode);
    self.postMessage({ type: "PROGRESS", step: 5, msg: "Delineating subbasins..." });
    const basinIdArray = delineateBasins(payload.width, payload.height, flow.flowDirection, channels.junctionPoints);
    self.postMessage({ type: "PROGRESS", step: 6, msg: "Vectorizing watershed basins..." });
    const basinPolygons = vectorizeBasins(payload.width, payload.height, basinIdArray, payload.geotransform, payload.crsCode);
    (self as unknown as { postMessage(message: unknown, transfer?: Transferable[]): void }).postMessage({ type: "COMPLETE", payload: { filledElevation, ...flow, ...channels, basinIdArray, basinPolygons } }, [filledElevation.buffer, flow.flowDirection.buffer, flow.flowAccumulation.buffer, basinIdArray.buffer]);
  } catch (error) {
    self.postMessage({ type: "ERROR", error: error instanceof Error ? error.message : String(error) });
  }
};