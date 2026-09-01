import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { generateNDVI, generateNDWI, generateSlope } from "../tha/raster-analysis";
import { generateGeoTIFFBlobFromRaster, getGeoTIFFBandCount, readRasterFromFile, writeFloat32TiledGeoTIFF } from "../utils/geotiff-processor";
import { clipAndComputeStats, runDelineation, type DemData, type DelineationResult } from "../tha/watershed-delineation";
import { runNetworkAnalysis } from "../tha/network-analysis";
import type { LayerConfig } from "../tha/network-analysis";
import { createBufferedLayer, analyzeBufferZone, runAndAnalysisWithIntermediate, runOrAnalysisWithIntermediate } from "../tha/terrain-hydrology";
import type { BufferUnits, SpatialRelationship, JoinType, LoadedLayer } from "../tha/terrain-hydrology";
import { applyRightPanelStyle, styleRightPanelTree } from "../styles/spazio-right-panel-styles";

/** Toggle to enable or disable exporting the calculated optimal route */
const ENABLE_DOWNLOAD = true;
export const BASE_METHODS = [
    "", //placeholder
    "Raster Analysis",
    "Network Analysis",
    "Terrain & Hydrology Analysis",
    "Watershed Delineation",
  ];
export const BASE_METHODS_TC = [
  "Select Geoprocessing function",  //placeholder
  "Raster Analysis",
  "Network Analysis",
  "Terrain & Hydrology Analysis",
  "Watershed Delineation",
]

/**
 * Demonstration of the GeoLibre right-sidebar panel host API.
 *
 * A plugin can register a native right-sidebar panel that docks beside
 * GeoLibre's built-in Style panel and behaves like a first-class part of the
 * workspace, instead of emulating one with a fixed overlay. The host renders
 * the panel chrome (header, collapse/close buttons, a collapsible rail, and a
 * resize handle); the plugin owns only the body via `render(container)`, using
 * plain DOM so it never has to share the host's UI framework.
 *
 * This module is intentionally self-contained so it is easy to copy, adapt, or
 * delete. Wire it from the plugin's `activate`/`deactivate` hooks (see
 * `src/geolibre.ts`).
 */

/** Stable id for this plugin's right panel. Replace with your own. */
export const RIGHT_PANEL_ID = "spatio-terrain-hydrology-panel";
let _app : GeoLibreAppAPI;
let _method : HTMLSelectElement;
let _methodForm : HTMLElement;

export function selectMethod(method : string){
  if(_method && _methodForm){
    _method.value = method;
    loadMethodForm(_methodForm, method);
  }
}


function isNumericValue(value: unknown): boolean {
    if (typeof value === "number" && !isNaN(value)) return true;
    if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) return true;
    return false;
}

function getNumericOnlyKeys(geojson : FeatureCollection<Geometry, GeoJsonProperties>): string[]{
  if (!geojson || geojson.type !== "FeatureCollection") {
      throw new Error("Invalid GeoJSON FeatureCollection");
  }
  const keyStatus: Record<string, boolean> = {};
  geojson.features.forEach(feature => {
      const props: GeoJsonProperties = feature.properties || {};

      // First time seeing a key → assume true until proven otherwise
      Object.keys(props).forEach(key => {
          if (!(key in keyStatus)) {
              keyStatus[key] = true;
          }
          if (!isNumericValue(props[key])) {
              keyStatus[key] = false;
          }
      });

      // Keys missing in this feature → mark as false
      Object.keys(keyStatus).forEach(key => {
          if (!(key in props)) {
              keyStatus[key] = false;
          }
      });
  });
  return Object.keys(keyStatus).filter(key => keyStatus[key]);
}

function createBandOptions(num : number, mode : boolean){
  const tcs : string[] = [];
  for(let i = 0; i<num; i++){
    let tc = String(i+1);
    if(mode) tc = "Band " + (i+1);
    tcs.push(tc);
  }
  return tcs;
}

function drawDropdownOptions(dropdown : HTMLElement, methods : string[], textContents? : string[]){
  methods.forEach((method, index) => {
    const methodOption = document.createElement("option");
    methodOption.className = "spazio-dropdown-options";
    applyRightPanelStyle(methodOption, "selectOption");
    methodOption.value = method;
    if(!textContents || index >= textContents.length){
      methodOption.textContent = method;
    }else{
      methodOption.textContent = textContents[index];
    }
    
    dropdown.appendChild(methodOption);
  });
}


function loadMethodForm(wrapper: HTMLElement, method : string){
  removeAllChildElements(wrapper);
  ///Base Forms
  if(method === "Raster Analysis"){
    const methodFunctionSelect = document.createElement("select");
    const methodFunctionPlaceholder = document.createElement("select");
    methodFunctionPlaceholder.value = "";
    methodFunctionPlaceholder.textContent = "Select Raster Analysis Function";
    // {lang:id} Pilih Fungsi Analisa Raster
    methodFunctionSelect.appendChild(methodFunctionPlaceholder);
    wrapper.appendChild(methodFunctionSelect);
    const methodFunctionOptions = ["", "Slope", "NDVI", "NDWI"];
    // {lang:id} ["", "Kemiringan", "NDVI", NDWI]
    const methodFunctionOptionsTC = ["Select Analysis Function", "Slope", "NDVI", "NDWI"];
    // {lang:id} ["Pilih fungsi analisa", Kemiringan, NDVI, NDVI]
    const raMethodForm = document.createElement("div");
    wrapper.appendChild(raMethodForm);
    drawDropdownOptions(methodFunctionSelect, methodFunctionOptions, methodFunctionOptionsTC);
    methodFunctionSelect.addEventListener("change", () => {
        loadMethodForm(raMethodForm, methodFunctionSelect.value);
        styleRightPanelTree(wrapper);
      })
  }
  else if(method === "Network Analysis"){
    // ── Constants ──
    const MAX_LAYERS = 5;

    // ── State ──
    interface LayerState {
      file: File | null;
      geojson: FeatureCollection | null;
      numericAttrs: string[];
      selectedAttr: string;
      weight: number;
      checked: boolean;
    }
    interface PanelState {
      numLayers: number;
      layers: LayerState[];
      method: string;
      startCoord: [number, number] | null;
      destCoord: [number, number] | null;
      snappingTolerance: number;
      obstacleFiles: File[];
      obstacleGeojsons: FeatureCollection[];
      isBenefit: boolean;
      previousLayerIds: string[];
      isPickingStart: boolean;
      isPickingDest: boolean;
    }
    function createDefaultLayerState(): LayerState {
      return { file: null, geojson: null, numericAttrs: [], selectedAttr: 'Distance', weight: 1, checked: false };
    }
    const naState: PanelState = {
      numLayers: 1,
      layers: [createDefaultLayerState()],
      method: '',
      startCoord: null,
      destCoord: null,
      snappingTolerance: 0,
      obstacleFiles: [],
      obstacleGeojsons: [],
      isBenefit: false,
      previousLayerIds: [],
      isPickingStart: false,
      isPickingDest: false,
    };

    // ── DOM refs ──
    let naStatusEl: HTMLElement | null = null;
    let naAnalyzeBtn: HTMLButtonElement | null = null;
    let naDownloadBtn: HTMLButtonElement | null = null;
    let naLayerListEl: HTMLElement | null = null;
    let naRouteFormEl: HTMLElement | null = null;
    let naStartInput: HTMLInputElement | null = null;
    let naDestInput: HTMLInputElement | null = null;
    let naPickStartBtn: HTMLButtonElement | null = null;
    let naPickDestBtn: HTMLButtonElement | null = null;
    let naFileInputsContainer: HTMLElement | null = null;
    let naLastRouteGeoJson: FeatureCollection | null = null;

    // ── Helpers ──
    function extractNumericAttrs(geojson: FeatureCollection): string[] {
      const attrSet = new Set<string>();
      for (const feature of geojson.features) {
        if (!feature.properties) continue;
        for (const [key, val] of Object.entries(feature.properties)) {
          if (typeof val === 'number') attrSet.add(key);
        }
      }
      return Array.from(attrSet);
    }
    function readFileAsGeoJSON(file: File): Promise<FeatureCollection> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target?.result as string) as FeatureCollection;
            resolve(parsed);
          } catch {
            reject(new Error(`Failed to parse ${file.name} as GeoJSON.`));
          }
        };
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
        reader.readAsText(file);
      });
    }
    function naSetStatus(msg: string, isError = false) {
      if (!naStatusEl) return;
      naStatusEl.textContent = msg;
      naStatusEl.style.display = msg.length > 0 ? '' : 'none';
      naStatusEl.classList.toggle('na-status--error', isError);
      naStatusEl.classList.toggle('na-status--success', !isError && msg.length > 0);
    }
    function naValidateForm(): boolean {
      if (naState.method !== 'Find Optimal Route') return false;
      if (!naState.startCoord || !naState.destCoord) return false;
      if (isNaN(naState.snappingTolerance)) return false;
      const uploadedCount = naState.layers.filter((l, i) => i < naState.numLayers && l.geojson !== null).length;
      if (uploadedCount < naState.numLayers) return false;
      const checkedCount = naState.layers.filter((l, i) => i < naState.numLayers && l.checked).length;
      if (checkedCount === 0) return false;
      return true;
    }
    function naRefreshAnalyzeBtn() {
      if (!naAnalyzeBtn) return;
      naAnalyzeBtn.disabled = !naValidateForm();
    }
    function naCancelPickingMode() {
      naState.isPickingStart = false;
      naState.isPickingDest = false;
      const map = _app.getMap?.();
      if (map) (map as { getCanvas(): { style: { cursor: string } } }).getCanvas().style.cursor = '';
      naPickStartBtn?.classList.remove('na-pick-btn--active');
      naPickDestBtn?.classList.remove('na-pick-btn--active');
      naSetStatus('');
    }
    function naEnterPickingMode(isStart: boolean) {
      const map = _app.getMap?.();
      if (!map) {
        naSetStatus('Map is not available for picking.', true);
        return;
      }
      if ((isStart && naState.isPickingStart) || (!isStart && naState.isPickingDest)) {
        naCancelPickingMode();
        return;
      }
      naCancelPickingMode();
      naState.isPickingStart = isStart;
      naState.isPickingDest = !isStart;
      (map as { getCanvas(): { style: { cursor: string } } }).getCanvas().style.cursor = 'crosshair';
      naSetStatus(isStart ? 'Picking start point on map...' : 'Picking destination point on map...');
      if (isStart) naPickStartBtn?.classList.add('na-pick-btn--active');
      else naPickDestBtn?.classList.add('na-pick-btn--active');
      (map as { once(event: string, handler: (e: { lngLat: { lng: number; lat: number } }) => void): void }).once('click', (e: { lngLat: { lng: number; lat: number } }) => {
        const { lng, lat } = e.lngLat;
        if (isStart) {
          naState.startCoord = [lng, lat];
          if (naStartInput) naStartInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        } else {
          naState.destCoord = [lng, lat];
          if (naDestInput) naDestInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
        naCancelPickingMode();
        naRefreshAnalyzeBtn();
      });
    }

    // ── Build attribute dropdown ──
    function naBuildAttrDropdown(layerIdx: number, layerState: LayerState): HTMLSelectElement {
      const sel = document.createElement('select');
      sel.className = 'na-input na-select';
      sel.id = `na-attr-${layerIdx}`;
      const distOpt = document.createElement('option');
      distOpt.value = 'Distance';
      distOpt.textContent = 'Distance (meters)';
      sel.appendChild(distOpt);
      for (const attr of layerState.numericAttrs) {
        const opt = document.createElement('option');
        opt.value = attr;
        opt.textContent = attr;
        sel.appendChild(opt);
      }
      sel.value = layerState.selectedAttr;
      sel.addEventListener('change', () => { naState.layers[layerIdx].selectedAttr = sel.value; });
      return sel;
    }
    function naBuildLayerSubForm(layerIdx: number, layerState: LayerState): HTMLElement {
      const subForm = document.createElement('div');
      subForm.className = 'na-layer-subform';
      const row1 = document.createElement('div');
      row1.className = 'na-form-row';
      const attrLabel = document.createElement('label');
      attrLabel.htmlFor = `na-attr-${layerIdx}`;
      attrLabel.className = 'na-label';
      attrLabel.textContent = 'Optimal Value';
      row1.appendChild(attrLabel);
      row1.appendChild(naBuildAttrDropdown(layerIdx, layerState));
      subForm.appendChild(row1);
      const row2 = document.createElement('div');
      row2.className = 'na-form-row';
      const wLabel = document.createElement('label');
      wLabel.htmlFor = `na-weight-${layerIdx}`;
      wLabel.className = 'na-label';
      wLabel.textContent = 'Weight';
      const weightInput = document.createElement('input');
      weightInput.type = 'number';
      weightInput.id = `na-weight-${layerIdx}`;
      weightInput.className = 'na-input';
      weightInput.min = '0';
      weightInput.step = '0.1';
      weightInput.value = String(layerState.weight);
      weightInput.addEventListener('input', () => { naState.layers[layerIdx].weight = parseFloat(weightInput.value) || 1; });
      row2.appendChild(wLabel);
      row2.appendChild(weightInput);
      subForm.appendChild(row2);
      return subForm;
    }

    // ── Rebuild layer checklist ──
    function naRebuildLayerList() {
      if (!naLayerListEl) return;
      naLayerListEl.innerHTML = '';
      for (let i = 0; i < naState.numLayers; i++) {
        const layerState = naState.layers[i];
        if (!layerState || !layerState.geojson) continue;
        const card = document.createElement('div');
        card.className = 'na-layer-card';
        const checkRow = document.createElement('div');
        checkRow.className = 'na-check-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `na-layer-cb-${i}`;
        cb.className = 'na-checkbox';
        cb.checked = layerState.checked;
        const cbLabel = document.createElement('label');
        cbLabel.htmlFor = `na-layer-cb-${i}`;
        cbLabel.className = 'na-check-label';
        cbLabel.textContent = layerState.file?.name ?? `Layer ${i + 1}`;
        checkRow.appendChild(cb);
        checkRow.appendChild(cbLabel);
        card.appendChild(checkRow);
        const subFormWrapper = document.createElement('div');
        subFormWrapper.style.display = layerState.checked ? 'block' : 'none';
        subFormWrapper.appendChild(naBuildLayerSubForm(i, layerState));
        card.appendChild(subFormWrapper);
        cb.addEventListener('change', () => {
          naState.layers[i].checked = cb.checked;
          subFormWrapper.style.display = cb.checked ? 'block' : 'none';
          naRefreshAnalyzeBtn();
        });
        naLayerListEl.appendChild(card);
      }
      styleRightPanelTree(wrapper);
      if (naRouteFormEl) {
        naRouteFormEl.style.display = naState.method === 'Find Optimal Route' ? 'flex' : 'none';
      }
    }

    // ── Rebuild file inputs ──
    function naRebuildFileInputs() {
      if (!naFileInputsContainer) return;
      naFileInputsContainer.innerHTML = '';
      while (naState.layers.length < naState.numLayers) {
        naState.layers.push(createDefaultLayerState());
      }
      for (let i = 0; i < naState.numLayers; i++) {
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'na-file-row';
        const label = document.createElement('label');
        label.htmlFor = `na-file-${i}`;
        label.className = 'na-label';
        label.textContent = `Layer ${i + 1}`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = `na-file-${i}`;
        fileInput.className = 'na-input na-file-input';
        fileInput.accept = '.geojson,application/json';
        const statusSpan = document.createElement('span');
        statusSpan.className = 'na-file-status';
        statusSpan.id = `na-file-status-${i}`;
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0] ?? null;
          naState.layers[i].file = file;
          naState.layers[i].geojson = null;
          naState.layers[i].numericAttrs = [];
          naState.layers[i].checked = false;
          if (!file) {
            statusSpan.textContent = '';
            naRebuildLayerList();
            naRefreshAnalyzeBtn();
            return;
          }
          statusSpan.textContent = 'Loading\u2026';
          try {
            const geojson = await readFileAsGeoJSON(file);
            naState.layers[i].geojson = geojson;
            naState.layers[i].numericAttrs = extractNumericAttrs(geojson);
            naState.layers[i].selectedAttr = 'Distance';
            const attrList = naState.layers[i].numericAttrs.join(', ');
            const attrInfo = attrList ? ` | Attrs: ${attrList}` : '';
            statusSpan.textContent = `\u2713 ${geojson.features.length} features${attrInfo}`;
            statusSpan.style.color = 'var(--na-success)';
          } catch (err) {
            statusSpan.textContent = `\u2717 ${(err as Error).message}`;
            statusSpan.style.color = 'var(--na-error)';
          }
          naRebuildLayerList();
          naRefreshAnalyzeBtn();
        });
        rowWrapper.appendChild(label);
        rowWrapper.appendChild(fileInput);
        rowWrapper.appendChild(statusSpan);
        naFileInputsContainer.appendChild(rowWrapper);
      }
      styleRightPanelTree(wrapper);
      if (naRouteFormEl) {
        naRouteFormEl.style.display = naState.method === 'Find Optimal Route' ? 'flex' : 'none';
      }
    }

    // ── Run Analysis ──
    async function naRunAnalysis() {
      if (!naValidateForm()) return;
      naSetStatus('Running analysis\u2026');
      naAnalyzeBtn!.disabled = true;
      if (naDownloadBtn) naDownloadBtn.style.display = 'none';
      naLastRouteGeoJson = null;
      try {
        for (const id of naState.previousLayerIds) {
          _app.unregisterExternalNativeLayer?.(id);
        }
        naState.previousLayerIds = [];
        const layers: FeatureCollection[] = [];
        const layerConfigs: LayerConfig[] = [];
        for (let i = 0; i < naState.numLayers; i++) {
          const ls = naState.layers[i];
          if (!ls.geojson) continue;
          if (ls.checked) {
            const layerIdx = layers.length;
            layers.push(ls.geojson);
            layerConfigs.push({ layerIndex: layerIdx, weight: ls.weight, optimalValueAttr: ls.selectedAttr });
          }
        }
        for (let i = 0; i < naState.numLayers; i++) {
          const ls = naState.layers[i];
          if (!ls.geojson) continue;
          const id = _app.addGeoJsonLayer(`Network: ${ls.file?.name ?? `Layer ${i + 1}`}`, ls.geojson);
          naState.previousLayerIds.push(id);
        }
        for (let i = 0; i < naState.obstacleGeojsons.length; i++) {
          const id = _app.addGeoJsonLayer(`Obstacle: ${naState.obstacleFiles[i]?.name ?? `Obstacle ${i + 1}`}`, naState.obstacleGeojsons[i]);
          naState.previousLayerIds.push(id);
        }
        const { route, clickedPoints, snappedPoints } = runNetworkAnalysis({
          layers,
          layerConfigs,
          obstacles: naState.obstacleGeojsons.length > 0 ? naState.obstacleGeojsons : undefined,
          start: naState.startCoord!,
          destination: naState.destCoord!,
          snappingTolerance: naState.snappingTolerance,
          isBenefit: naState.isBenefit,
        });
        const routeId = _app.addGeoJsonLayer('Network Analysis: Optimal Route', route);
        naState.previousLayerIds.push(routeId);
        const clickedId = _app.addGeoJsonLayer('Network Analysis: Input Points', clickedPoints);
        naState.previousLayerIds.push(clickedId);
        const snappedId = _app.addGeoJsonLayer('Network Analysis: Snapped Points', snappedPoints);
        naState.previousLayerIds.push(snappedId);
        naLastRouteGeoJson = route;
        naSetStatus('\u2713 Optimal route analysis complete.');
        if (ENABLE_DOWNLOAD && naDownloadBtn) naDownloadBtn.style.display = '';
      } catch (err) {
        naSetStatus(`Error: ${(err as Error).message}`, true);
      } finally {
        naRefreshAnalyzeBtn();
      }
    }

    // ── Download helper ──
    function naDownloadRoute() {
      if (!naLastRouteGeoJson) return;
      const jsonStr = JSON.stringify(naLastRouteGeoJson, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'optimal_route.geojson';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // ── Build the Network Analysis form UI ──
    const naWrap = document.createElement('div');
    naWrap.className = 'network-analysis-panel';

    // -- Section: Configuration --
    const naConfigSection = document.createElement('div');
    naConfigSection.className = 'na-section';
    const naConfigTitle = document.createElement('h3');
    naConfigTitle.className = 'na-section-title';
    naConfigTitle.textContent = 'Configuration';
    naConfigSection.appendChild(naConfigTitle);

    // Number of layers
    const naLayerCountRow = document.createElement('div');
    naLayerCountRow.className = 'na-form-row';
    const naLayerCountLabel = document.createElement('label');
    naLayerCountLabel.htmlFor = 'na-num-layers';
    naLayerCountLabel.className = 'na-label';
    naLayerCountLabel.textContent = 'Number of Network Layers';
    const naLayerCountInput = document.createElement('input');
    naLayerCountInput.type = 'number';
    naLayerCountInput.id = 'na-num-layers';
    naLayerCountInput.className = 'na-input na-input--small';
    naLayerCountInput.min = '1';
    naLayerCountInput.max = String(MAX_LAYERS);
    naLayerCountInput.value = '1';
    naLayerCountInput.addEventListener('change', () => {
      const val = Math.min(MAX_LAYERS, Math.max(1, parseInt(naLayerCountInput.value, 10) || 1));
      naLayerCountInput.value = String(val);
      naState.numLayers = val;
      naRebuildFileInputs();
      naRebuildLayerList();
      naRefreshAnalyzeBtn();
    });
    naLayerCountRow.appendChild(naLayerCountLabel);
    naLayerCountRow.appendChild(naLayerCountInput);
    naConfigSection.appendChild(naLayerCountRow);

    // File inputs container
    naFileInputsContainer = document.createElement('div');
    naFileInputsContainer.className = 'na-file-inputs';
    naConfigSection.appendChild(naFileInputsContainer);

    // Analysis method select
    const naMethodRow = document.createElement('div');
    naMethodRow.className = 'na-form-row';
    const naMethodLabel = document.createElement('label');
    naMethodLabel.htmlFor = 'na-method';
    naMethodLabel.className = 'na-label';
    naMethodLabel.textContent = 'Analysis Method';
    const naMethodSelect = document.createElement('select');
    naMethodSelect.id = 'na-method';
    naMethodSelect.className = 'na-input na-select';
    const naEmptyOpt = document.createElement('option');
    naEmptyOpt.value = '';
    naEmptyOpt.textContent = '\u2014 Select method \u2014';
    const naRouteOpt = document.createElement('option');
    naRouteOpt.value = 'Find Optimal Route';
    naRouteOpt.textContent = 'Find Optimal Route';
    naMethodSelect.appendChild(naEmptyOpt);
    naMethodSelect.appendChild(naRouteOpt);
    naMethodSelect.addEventListener('change', () => {
      naState.method = naMethodSelect.value;
      naRouteFormEl!.style.display = naState.method === 'Find Optimal Route' ? 'flex' : 'none';
      naRefreshAnalyzeBtn();
    });
    naMethodRow.appendChild(naMethodLabel);
    naMethodRow.appendChild(naMethodSelect);
    naConfigSection.appendChild(naMethodRow);
    naWrap.appendChild(naConfigSection);

    // -- Section: Optimal Route Parameters --
    naRouteFormEl = document.createElement('div');
    naRouteFormEl.className = 'na-section na-route-form';
    naRouteFormEl.style.display = 'none';
    const naRouteTitle = document.createElement('h3');
    naRouteTitle.className = 'na-section-title';
    naRouteTitle.textContent = 'Optimal Route Parameters';
    naRouteFormEl.appendChild(naRouteTitle);

    // Start coordinate
    const naStartRow = document.createElement('div');
    naStartRow.className = 'na-form-row na-coord-row';
    const naStartLabel = document.createElement('label');
    naStartLabel.htmlFor = 'na-start-coord';
    naStartLabel.className = 'na-label';
    naStartLabel.textContent = 'Start';
    naStartInput = document.createElement('input');
    naStartInput.type = 'text';
    naStartInput.id = 'na-start-coord';
    naStartInput.className = 'na-input na-coord-input';
    naStartInput.readOnly = true;
    naStartInput.placeholder = 'Click "Pick on Map"';
    naPickStartBtn = document.createElement('button');
    naPickStartBtn.type = 'button';
    naPickStartBtn.className = 'na-pick-btn';
    naPickStartBtn.id = 'na-pick-start';
    naPickStartBtn.title = 'Pick start point on map';
    naPickStartBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Pick';
    naPickStartBtn.addEventListener('click', () => naEnterPickingMode(true));
    naStartRow.appendChild(naStartLabel);
    naStartRow.appendChild(naStartInput);
    naStartRow.appendChild(naPickStartBtn);
    naRouteFormEl.appendChild(naStartRow);

    // Destination coordinate
    const naDestRow = document.createElement('div');
    naDestRow.className = 'na-form-row na-coord-row';
    const naDestLabel = document.createElement('label');
    naDestLabel.htmlFor = 'na-dest-coord';
    naDestLabel.className = 'na-label';
    naDestLabel.textContent = 'Destination';
    naDestInput = document.createElement('input');
    naDestInput.type = 'text';
    naDestInput.id = 'na-dest-coord';
    naDestInput.className = 'na-input na-coord-input';
    naDestInput.readOnly = true;
    naDestInput.placeholder = 'Click "Pick on Map"';
    naPickDestBtn = document.createElement('button');
    naPickDestBtn.type = 'button';
    naPickDestBtn.className = 'na-pick-btn';
    naPickDestBtn.id = 'na-pick-dest';
    naPickDestBtn.title = 'Pick destination point on map';
    naPickDestBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg> Pick';
    naPickDestBtn.addEventListener('click', () => naEnterPickingMode(false));
    naDestRow.appendChild(naDestLabel);
    naDestRow.appendChild(naDestInput);
    naDestRow.appendChild(naPickDestBtn);
    naRouteFormEl.appendChild(naDestRow);

    // Snapping tolerance
    const naSnapRow = document.createElement('div');
    naSnapRow.className = 'na-form-row';
    const naSnapLabel = document.createElement('label');
    naSnapLabel.htmlFor = 'na-snap-tolerance';
    naSnapLabel.className = 'na-label';
    naSnapLabel.textContent = 'Snapping Tolerance (m)';
    const naSnapInput = document.createElement('input');
    naSnapInput.type = 'number';
    naSnapInput.id = 'na-snap-tolerance';
    naSnapInput.className = 'na-input na-input--small';
    naSnapInput.min = '0';
    naSnapInput.step = '1';
    naSnapInput.value = '0';
    naSnapInput.placeholder = '0 = snap unconditionally';
    naSnapInput.addEventListener('input', () => {
      naState.snappingTolerance = parseFloat(naSnapInput.value) || 0;
      naRefreshAnalyzeBtn();
    });
    naSnapRow.appendChild(naSnapLabel);
    naSnapRow.appendChild(naSnapInput);
    naRouteFormEl.appendChild(naSnapRow);

    // Layer checklist title
    const naLayerListTitle = document.createElement('p');
    naLayerListTitle.className = 'na-sublabel';
    naLayerListTitle.textContent = 'Select Layers to Include in Analysis';
    naRouteFormEl.appendChild(naLayerListTitle);

    naLayerListEl = document.createElement('div');
    naLayerListEl.className = 'na-layer-list';
    naRouteFormEl.appendChild(naLayerListEl);

    // Obstacles file input
    const naObstacleRow = document.createElement('div');
    naObstacleRow.className = 'na-form-row';
    const naObstacleLabel = document.createElement('label');
    naObstacleLabel.htmlFor = 'na-obstacles';
    naObstacleLabel.className = 'na-label';
    naObstacleLabel.textContent = 'Obstacles (optional)';
    const naObstacleInput = document.createElement('input');
    naObstacleInput.type = 'file';
    naObstacleInput.id = 'na-obstacles';
    naObstacleInput.className = 'na-input na-file-input';
    naObstacleInput.accept = '.geojson,application/json';
    naObstacleInput.multiple = true;
    naObstacleInput.addEventListener('change', async () => {
      naState.obstacleFiles = Array.from(naObstacleInput.files ?? []);
      naState.obstacleGeojsons = [];
      for (const file of naState.obstacleFiles) {
        try {
          const gj = await readFileAsGeoJSON(file);
          naState.obstacleGeojsons.push(gj);
        } catch (err) {
          naSetStatus(`Error loading obstacle ${file.name}: ${(err as Error).message}`, true);
        }
      }
    });
    naObstacleRow.appendChild(naObstacleLabel);
    naObstacleRow.appendChild(naObstacleInput);
    naRouteFormEl.appendChild(naObstacleRow);

    // Optimization goal (radio)
    const naGoalRow = document.createElement('div');
    naGoalRow.className = 'na-form-row na-radio-row';
    const naGoalLabel = document.createElement('span');
    naGoalLabel.className = 'na-label';
    naGoalLabel.textContent = 'Optimization Goal';
    const naRadioGroup = document.createElement('div');
    naRadioGroup.className = 'na-radio-group';
    const naCostLabel = document.createElement('label');
    naCostLabel.className = 'na-radio-label';
    const naCostRadio = document.createElement('input');
    naCostRadio.type = 'radio';
    naCostRadio.name = 'na-goal';
    naCostRadio.value = 'cost';
    naCostRadio.checked = true;
    naCostRadio.className = 'na-radio';
    naCostLabel.appendChild(naCostRadio);
    naCostLabel.append(' Cost');
    const naBenefitLabel = document.createElement('label');
    naBenefitLabel.className = 'na-radio-label';
    const naBenefitRadio = document.createElement('input');
    naBenefitRadio.type = 'radio';
    naBenefitRadio.name = 'na-goal';
    naBenefitRadio.value = 'benefit';
    naBenefitRadio.className = 'na-radio';
    naBenefitLabel.appendChild(naBenefitRadio);
    naBenefitLabel.append(' Benefit');
    naCostRadio.addEventListener('change', () => { naState.isBenefit = false; });
    naBenefitRadio.addEventListener('change', () => { naState.isBenefit = true; });
    naRadioGroup.appendChild(naCostLabel);
    naRadioGroup.appendChild(naBenefitLabel);
    naGoalRow.appendChild(naGoalLabel);
    naGoalRow.appendChild(naRadioGroup);
    naRouteFormEl.appendChild(naGoalRow);
    naWrap.appendChild(naRouteFormEl);

    // -- Section: Actions --
    const naActionsSection = document.createElement('div');
    naActionsSection.className = 'na-section na-actions';

    naAnalyzeBtn = document.createElement('button');
    naAnalyzeBtn.type = 'button';
    naAnalyzeBtn.id = 'na-analyze-btn';
    naAnalyzeBtn.className = 'na-btn na-btn--primary';
    naAnalyzeBtn.textContent = 'Find Optimal Route';
    naAnalyzeBtn.disabled = true;
    naAnalyzeBtn.addEventListener('click', () => { void naRunAnalysis(); });

    naStatusEl = document.createElement('div');
    naStatusEl.className = 'na-status';
    naStatusEl.id = 'na-status';

    naActionsSection.appendChild(naAnalyzeBtn);

    if (ENABLE_DOWNLOAD) {
      naDownloadBtn = document.createElement('button');
      naDownloadBtn.type = 'button';
      naDownloadBtn.id = 'na-download-btn';
      naDownloadBtn.className = 'na-btn na-btn--secondary';
      naDownloadBtn.textContent = 'Download Route';
      naDownloadBtn.style.display = 'none';
      naDownloadBtn.addEventListener('click', () => naDownloadRoute());
      naActionsSection.appendChild(naDownloadBtn);
    }

    naActionsSection.appendChild(naStatusEl);
    naWrap.appendChild(naActionsSection);
    wrapper.appendChild(naWrap);

    // Initialize file inputs
    naRebuildFileInputs();
  }
  else if(method  === "Terrain & Hydrology Analysis"){
    const methodFunctionSelect = document.createElement("select");
    const methodFunctionOptions = ["","Hazard Vulnerability Modeling", "Hazard Resistance Analysis"];
      // {lang:id} ["", "Pemodelan Kerentanan Bahaya", "Penataan Ruang Tangguh Bahaya"]
    const methodFunctionTC = ["Select Terrain & Hydrology Analysis","Hazard Vulnerability Modeling", "Hazard Resistance Analysis"];
    // {lang:id} ["Pilih Analisis Medan dan Hidrologi",  "Pemodelan Kerentanan Bahaya", "Penataan Ruang Tangguh Baahaya"]
    const thaMethodForm = document.createElement("div");
    drawDropdownOptions(methodFunctionSelect, methodFunctionOptions, methodFunctionTC);
    wrapper.appendChild(methodFunctionSelect);
    wrapper.appendChild(thaMethodForm);
    methodFunctionSelect.addEventListener("change", () => {
        loadMethodForm(thaMethodForm, methodFunctionSelect.value);
        styleRightPanelTree(wrapper);
      })
  }
  else if(method === "Watershed Delineation"){
    const section = (title: string) => { 
      const element = document.createElement("section"); 
      element.className = "spazio-section"; 
      const heading = document.createElement("h3"); 
      heading.className = "spazio-title"; 
      heading.textContent = title; 
      element.appendChild(heading); 
      wrapper.appendChild(element); 
      return element; 
    };
    const label = (text: string) => { 
      const element = document.createElement("label"); 
      element.className = "spazio-input-label"; 
      element.textContent = text; 
      return element; 
    };
    const status = document.createElement("div"); 
    status.className = "spazio-wd-progress"; 
    status.textContent = "Select a DEM to begin.";
    // {lang:id} Pilih DEM untuk memulai
    let currentDem: DemData | null = null;
    let currentResult: DelineationResult | null = null;
    //const download = (name: string, blob: Blob) => { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
    const rasterBlob = (data: Float32Array, dem: DemData) => new Blob([writeFloat32TiledGeoTIFF(dem.width, dem.height, data, dem.geotransform, dem.crsCode, 1)], { type: "image/tiff" });
    const setStatus = (message: string, error = false) => { 
      status.textContent = message; 
      status.className = `spazio-wd-progress ${error ? "spazio-wd-badge-error" : ""}`; 
    };
    const runButton = document.createElement("button"); 
    runButton.type = "button"; 
    runButton.textContent = "Run Analysis"; 
    // {lang:id} Lakukan Analisis
    runButton.disabled = true;
    const updateRunButtonState = () => { runButton.disabled = !currentDem; };

    const inputSection = section("Input DEM");
    const fileInput = document.createElement("input"); fileInput.type = "file"; fileInput.accept = ".tif,.tiff"; inputSection.appendChild(fileInput);
    const metadata = document.createElement("div"); metadata.className = "spazio-input-description"; inputSection.appendChild(metadata);
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        currentDem = null;
        metadata.textContent = "";
        updateRunButtonState();
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        currentDem = null;
        updateRunButtonState();
        setStatus("DEM exceeds the 50 MB limit.", true);
        return;
      }
      try {
        const dem = await readRasterFromFile(file);
        if (dem.width * dem.height > 16777216 || dem.data.length !== dem.width * dem.height) {
          currentDem = null;
          updateRunButtonState();
          setStatus("DEM exceeds the 4096 x 4096 single-band limit.", true);
          return;
        }
        currentDem = dem; 
        metadata.textContent = `${file.name} | ${dem.width} x ${dem.height} | ${(dem.width * dem.height).toLocaleString()} cells`;
        if (_app.addCogLayer) await _app.addCogLayer("Source DEM", URL.createObjectURL(await generateGeoTIFFBlobFromRaster(file)), { colormap: "terrain", nodata: dem.noDataValue });
        updateRunButtonState();
        setStatus("DEM loaded. Ready to run analysis.");
      } catch (error) {
        currentDem = null;
        updateRunButtonState();
        setStatus(error instanceof Error ? error.message : "Unable to read DEM.", true);
      }
    });

    const parameterSection = section("Delineation Parameters");
    const zLimit = document.createElement("input"); zLimit.type = "number"; zLimit.min = "0"; zLimit.step = "0.1"; zLimit.value = "0";
    parameterSection.append(label("Z-limit (0 = unlimited)"), zLimit);
    const thresholdRow = document.createElement("div"); thresholdRow.className = "spazio-wd-slider-control";
    const threshold = document.createElement("input"); threshold.type = "range"; threshold.min = "0"; threshold.max = "5000"; threshold.value = "500"; threshold.className = "spazio-slider";
    const thresholdNumber = document.createElement("input"); thresholdNumber.type = "number"; thresholdNumber.min = "0"; thresholdNumber.max = "5000"; thresholdNumber.value = "500"; thresholdNumber.className = "spazio-wd-number-input";
    threshold.addEventListener("input", () => { thresholdNumber.value = threshold.value; }); thresholdNumber.addEventListener("input", () => { threshold.value = thresholdNumber.value; }); thresholdRow.append(threshold, thresholdNumber); parameterSection.append(label("Stream threshold"), thresholdRow);
    parameterSection.append(runButton, status);
    const resultActions = document.createElement("div"); resultActions.className = "spazio-flex-col"; parameterSection.appendChild(resultActions);
    runButton.addEventListener("click", async () => {
      if (!currentDem) return;
      runButton.disabled = true;
      try {
        currentResult = await runDelineation(currentDem, { zLimit: Number(zLimit.value) || 0, threshold: Number(thresholdNumber.value) || 0 }, (step, message) => setStatus(`Step ${step}: ${message}`));
        if (_app.addCogLayer) {
          await _app.addCogLayer("Sink-filled DEM", URL.createObjectURL(rasterBlob(currentResult.filledElevation, currentDem)), { colormap: "terrain", nodata: currentDem.noDataValue });
          const logAccumulation = Float32Array.from(currentResult.flowAccumulation, value => Math.log1p(value));
          await _app.addCogLayer("Flow Accumulation", URL.createObjectURL(rasterBlob(logAccumulation, currentDem)), { colormap: "blues" });
          await _app.addCogLayer("Subbasins (Raster)", URL.createObjectURL(rasterBlob(Float32Array.from(currentResult.basinIdArray), currentDem)), { colormap: "rainbow", nodata: 0 });
        }
        _app.addGeoJsonLayer("Channel Network", currentResult.channelNetwork); _app.addGeoJsonLayer("Watershed Basins", currentResult.basinPolygons);
        setStatus(`Analysis complete: ${currentResult.basinPolygons.features.length} basins found.`);
        resultActions.textContent = "";
        //if (ENABLE_DOWNLOAD) { const filled = document.createElement("button"); filled.textContent = "Download filled DEM"; filled.onclick = () => download("filled-dem.tif", rasterBlob(currentResult!.filledElevation, currentDem!)); resultActions.appendChild(filled); const network = document.createElement("button"); network.textContent = "Download network GeoJSON"; network.onclick = () => download("network.geojson", new Blob([JSON.stringify(currentResult!.channelNetwork)], { type: "application/geo+json" })); resultActions.appendChild(network); }
      } catch (error) { 
        setStatus(error instanceof Error ? error.message : "Analysis failed.", true); 
      } finally { 
        runButton.disabled = false; 
      }
    });

    const statsSection = section("Clip & Elevation Statistics"); 
    const basinInput = document.createElement("input"); 
    basinInput.type = "number"; 
    basinInput.min = "1"; 
    basinInput.placeholder = "Basin ID"; 
    const clipButton = document.createElement("button"); 
    clipButton.textContent = "Clip Basin"; 
    // {lang:id} Potong Basin?
    const statsGrid = document.createElement("div"); 
    statsGrid.className = "wd-stats-grid"; 
    statsSection.append(label("Target basin ID"), basinInput, clipButton, statsGrid);
    clipButton.addEventListener("click", () => {
      if (!currentDem || !currentResult) return;
      const selected = Number(basinInput.value);
      const clipped = clipAndComputeStats(currentDem.width, currentDem.height, currentResult.filledElevation, currentResult.basinIdArray, selected, currentDem.noDataValue, currentDem.geotransform);
      statsGrid.textContent = "";
      const statRows: Array<[string, number, boolean]> = [
        ["Min", clipped.statistics.min, true],
        ["Max", clipped.statistics.max, true],
        ["Mean", clipped.statistics.mean, true],
        ["Std dev", clipped.statistics.stdDev, true],
        ["Sum", clipped.statistics.sum, true],
        ["Valid Cells", clipped.statistics.validCells, false],
        ["No-data cells", clipped.statistics.noDataCells, false],
      ];
      for (const [name, value, isElevation] of statRows) {
        const item = document.createElement("div");
        item.className = "spazio-wd-stat-item";
        const itemLabel = document.createElement("span");
        itemLabel.className = "spazio-wd-stat-label";
        itemLabel.textContent = name;
        const itemValue = document.createElement("span");
        itemValue.className = "spazio-wd-stat-value";
        itemValue.textContent = isElevation ? `${value.toFixed(2)} m` : value.toLocaleString();
        item.append(itemLabel, itemValue);
        statsGrid.appendChild(item);
      }
      if (_app.addCogLayer) {
        const clippedDem = {
          ...currentDem,
          width: clipped.width,
          height: clipped.height,
          geotransform: clipped.geotransform,
          data: clipped.clippedElevation,
        };
        const clippedBlob = new Blob([
          writeFloat32TiledGeoTIFF(clippedDem.width, clippedDem.height, clippedDem.data, clippedDem.geotransform, clippedDem.crsCode, 1)
        ], { type: "image/tiff" });
        void _app.addCogLayer(
          `Clipped Basin DEM ${selected}`,
          URL.createObjectURL(clippedBlob),
          { colormap: "terrain", nodata: currentDem.noDataValue }
        );
      }
    });
    const map = _app.getMap?.(); map?.on("click", (event: unknown) => { const feature = (event as { features?: Array<{ properties?: { basinId?: number } }> }).features?.[0]; if (feature?.properties?.basinId) { basinInput.value = String(feature.properties.basinId); clipButton.click(); } });
    styleRightPanelTree(wrapper);
  }
  //Raster Analysis Forms
  else if(method === "Slope"){
    const fileInputLabel = document.createElement("h2");
    fileInputLabel.className = "spazio-title";
    fileInputLabel.textContent = "DEM Raster";
    wrapper.appendChild(fileInputLabel);
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".tiff, .tif";
    fileInput.className ="spazio-text-field";
    wrapper.appendChild(fileInput);
    const unitSelectLabel = document.createElement("h2");
    unitSelectLabel.className = "spazio-title";
    unitSelectLabel.textContent = "Select Slope Unit";
    // {lang:id} Pilih unit kemiringan
    const unitSelect = document.createElement("select");
    drawDropdownOptions(unitSelect, ["Degrees", "Percent", "Ratio"]);
        // {lang:id} ["", "Derajat", "Persen", "Rasio"]
    const slopeZFactor = document.createElement("input");
    slopeZFactor.type = "number";
    slopeZFactor.min = "0";
    slopeZFactor.value = "1";
    wrapper.appendChild(unitSelectLabel);
    wrapper.appendChild(unitSelect);
    wrapper.appendChild(slopeZFactor);

    const processingButton = document.createElement("button");
    processingButton.type = "button";
    processingButton.className = "spazio-submit-button";
    processingButton.textContent = "Generate Slope";
    // {lang:id} Buat Kemiringan
    wrapper.appendChild(processingButton);
    processingButton.addEventListener("click", async()=>{
      const file = fileInput.files?.[0];
      if(file){
        const slopeRasterBlob = await generateSlope(file, unitSelect.value, Number(slopeZFactor.value));
        if(_app.addCogLayer){
          _app.addCogLayer("Slope Raster", URL.createObjectURL(slopeRasterBlob));
        }else{
          console.log("The app doesn't support the api")
        }
        
      }
    })



  }
  // (nir-red)/(nir+red)
  else if(method === "NDVI"){
    const fileInputALabel = document.createElement("h1");
    fileInputALabel.textContent = "NIR Raster";
    wrapper.appendChild(fileInputALabel);
    const fileInputA = document.createElement("input");
    fileInputA.type = "file";
    fileInputA.accept = ".tiff, .tif";
    fileInputA.className ="spatio-file-input";
    wrapper.appendChild(fileInputA);
    const nirSelectLabel = document.createElement("h1");
    nirSelectLabel.textContent = 'Select raster band for "NIR"';
    wrapper.appendChild(nirSelectLabel)
    const nirSelect = document.createElement("select");
    wrapper.appendChild(nirSelect);
    const fileInputBLabel = document.createElement("h2");
    fileInputBLabel.className = "spazio-title";
    fileInputBLabel.textContent = "Red Raster";
    wrapper.appendChild(fileInputBLabel);
    const fileInputB = document.createElement("input");
    fileInputB.type = "file";
    fileInputB.accept = ".tiff, .tif";
    fileInputB.className ="spatio-file-input";
    wrapper.appendChild(fileInputB);
    const redSelectLabel = document.createElement("h2");
    redSelectLabel.className = "spazio-title";
    redSelectLabel.textContent = 'Select raster band for "Red"';
    wrapper.appendChild(redSelectLabel);
    const redSelect = document.createElement("select");
    wrapper.appendChild(redSelect);
    fileInputA.addEventListener('change', async () =>{
      const bands = fileInputA.files ? await getGeoTIFFBandCount(fileInputA.files?.[0]) : 0;
      drawDropdownOptions(nirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    fileInputB.addEventListener('change', async ()=>{
      const bands  = fileInputB.files ? await getGeoTIFFBandCount(fileInputB.files?.[0]) : 0;
      drawDropdownOptions(redSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "spatio-action-button";
    actionButton.textContent = "Generate NDVI";
    // {lang:id} Buat NDVI
    wrapper.appendChild(actionButton);
    actionButton.addEventListener('click', async () => {
      if(fileInputA.files?.[0] && fileInputB.files?.[0] && Number(nirSelect.value) > 0 && Number(redSelect.value) > 0){
        const ndviRasterBlob = await generateNDVI(fileInputA.files?.[0], Number(nirSelect.value), fileInputB.files?.[0], Number(redSelect.value));
        if(_app.addCogLayer){
            _app.addCogLayer("NDVI Raster", URL.createObjectURL(ndviRasterBlob));
          }else{
            console.log("The app doesn't support the api")
          }
      }
      else{
        console.log("incomplete form");
      }
      

    })
    
    //update bands on file input changes

  }
  //(Green - NIR)/(Green + NIR)
  else if(method === "NDWI"){
    const fileInputALabel = document.createElement("h1");
    fileInputALabel.textContent = "NIR Raster";
    wrapper.appendChild(fileInputALabel);
    const fileInputA = document.createElement("input");
    fileInputA.type = "file";
    fileInputA.accept = ".tiff, .tif";
    fileInputA.className ="spatio-file-input";
    wrapper.appendChild(fileInputA);
    const nirSelectLabel = document.createElement("h1");
    nirSelectLabel.textContent = 'Select raster band for "NIR"';
    wrapper.appendChild(nirSelectLabel)
    const nirSelect = document.createElement("select");
    wrapper.appendChild(nirSelect);
    const fileInputBLabel = document.createElement("h2");
    fileInputBLabel.className = "spazio-title";
    fileInputBLabel.textContent = "Green Raster";
    wrapper.appendChild(fileInputBLabel);
    const fileInputB = document.createElement("input");
    fileInputB.type = "file";
    fileInputB.accept = ".tiff, .tif";
    fileInputB.className ="spatio-file-input";
    wrapper.appendChild(fileInputB);
    const greenSelectLabel = document.createElement("h2");
    greenSelectLabel.className = "spazio-title";
    greenSelectLabel.textContent = 'Select raster band for "Green"';
    wrapper.appendChild(greenSelectLabel);
    const greenSelect = document.createElement("select");
    wrapper.appendChild(greenSelect);
    fileInputA.addEventListener('change', async () =>{
      const bands = fileInputA.files ? await getGeoTIFFBandCount(fileInputA.files?.[0]) : 0;
      drawDropdownOptions(nirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    fileInputB.addEventListener('change', async ()=>{
      const bands  = fileInputB.files ? await getGeoTIFFBandCount(fileInputB.files?.[0]) : 0;;
      drawDropdownOptions(greenSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "spatio-action-button";
    actionButton.textContent = "Generate NDWI";
    // {lang:id} Buat NDWI
    wrapper.appendChild(actionButton);
    actionButton.addEventListener('click', async () => {
      if(fileInputA.files?.[0] && fileInputB.files?.[0] && Number(nirSelect.value) > 0 && Number(greenSelect.value) > 0){
        const ndviRasterBlob = await generateNDWI(fileInputA.files?.[0], Number(nirSelect.value), fileInputB.files?.[0], Number(greenSelect.value));
        if(_app.addCogLayer){
            _app.addCogLayer("NDWI Raster", URL.createObjectURL(ndviRasterBlob));
          }else{
            console.log("The app doesn't support the api")
          }
      }
      else{
        console.log("incomplete form");
      }
    })
  }
  else if (method === "Hazard Vulnerability Modeling") {
    // State references
    let loadedInputLayer: FeatureCollection | null = null;
    let loadedJoinLayer: FeatureCollection | null = null;
    let bufferedLayer: FeatureCollection | null = null;

    // Clean up helper
    const registerLayer = (name: string, data: FeatureCollection) => {
      if (_app.addGeoJsonLayer) {
        const id = _app.addGeoJsonLayer(name, data);
        return id;
      }
      return "";
    };


    // Form elements
    const form = document.createElement("div");
    form.className = "spazio-form-container";

    const createField = (labelText: string, input: HTMLElement, helpText?: string): HTMLDivElement => {
      const field = document.createElement("div");
      field.className = "spazio-section";
      const label = document.createElement("label");
      label.className = "spazio-input-label";
      label.textContent = labelText;
      field.appendChild(label);
      field.appendChild(input);
      if (helpText) {
        const hint = document.createElement("div");
        hint.className = "spazio-input-description";
        hint.textContent = helpText;
        field.appendChild(hint);
      }
      return field;
    };

    const statusEl = document.createElement("div");
    statusEl.className = "spazio-status";
    statusEl.textContent = "";

    const setStatus = (msg: string) => {
      statusEl.textContent = msg;
    };

    // 1. Input Layer Choice
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "spazio-flex-col";

    const inputFileInput = document.createElement("input");
    inputFileInput.type = "file";
    inputFileInput.accept = ".geojson,.json";
    inputFileInput.className = "spazio-text-field";

    const inputNameInput = document.createElement("input");
    inputNameInput.type = "text";
    inputNameInput.className = "spazio-text-field";
    inputNameInput.placeholder = "Input layer name";

    const inputLoadBtn = document.createElement("button");
    inputLoadBtn.type = "button";
    inputLoadBtn.className = "spazio-submit-button";
    inputLoadBtn.textContent = "Load Input";
    // {lang:id} Muat Input

    const inputRow = document.createElement("div");
    inputRow.className = "spazio-flex-row";
    inputRow.appendChild(inputNameInput);
    inputRow.appendChild(inputLoadBtn);
    inputWrapper.appendChild(inputFileInput);
    inputWrapper.appendChild(inputRow);

    const inputStatusText = document.createElement("div");
    inputStatusText.className = "spazio-status";
    inputStatusText.textContent = "No input layer loaded";
    // {lang:id} Tidak ada layer input yang termuat

    // 2. Buffer distance & units
    const distanceInput = document.createElement("input");
    distanceInput.type = "number";
    distanceInput.min = "0";
    distanceInput.step = "0.1";
    distanceInput.value = "1";
    distanceInput.className = "spazio-text-field";

    const unitSelect = document.createElement("select");
    unitSelect.className = "spazio-dropdown";
    unitSelect.innerHTML = `
      <option value="kilometers">Kilometers</option>
      <option value="meters">Meters</option>
      <option value="miles">Miles</option>
    `;

    const bufferBtn = document.createElement("button");
    bufferBtn.type = "button";
    bufferBtn.className = "spazio-submit-button";
    bufferBtn.textContent = "Buffer Only";
    // {lang:id} Hanya Buffer
    bufferBtn.disabled = true;

    // 3. Join Layer Choice
    const joinWrapper = document.createElement("div");
    joinWrapper.className = "spazio-flex-col";

    const joinFileInput = document.createElement("input");
    joinFileInput.type = "file";
    joinFileInput.accept = ".geojson,.json";
    joinFileInput.className = "spazio-text-field";

    const joinNameInput = document.createElement("input");
    joinNameInput.type = "text";
    joinNameInput.className = "spazio-text-field";
    joinNameInput.placeholder = "Join layer name";

    const joinLoadBtn = document.createElement("button");
    joinLoadBtn.type = "button";
    joinLoadBtn.className = "spazio-submit-button";
    joinLoadBtn.textContent = "Load Join";
    // {lang:id} Muat layer penggabungan

    const joinRow = document.createElement("div");
    joinRow.className = "spazio-flex-row";
    joinRow.appendChild(joinNameInput);
    joinRow.appendChild(joinLoadBtn);
    joinWrapper.appendChild(joinFileInput);
    joinWrapper.appendChild(joinRow);

    const joinStatusText = document.createElement("div");
    joinStatusText.className = "spazio-status";
    joinStatusText.textContent = "No join layer loaded";
    // {lang:id} Tidak ada layer penggabungan yang termuat

    // 4. Summarization configurations
    const joinAttributeSelect = document.createElement("select");
    joinAttributeSelect.className = "spazio-dropdown";
    joinAttributeSelect.disabled = true;

    const relationshipSelect = document.createElement("select");
    relationshipSelect.className = "spazio-dropdown";
    relationshipSelect.innerHTML = `
      <option value="intersects">Intersects</option>
      <option value="within">Within</option>
      <option value="contains">Contains</option>
    `;

    const joinTypeSelect = document.createElement("select");
    joinTypeSelect.className = "spazio-dropdown";
    joinTypeSelect.innerHTML = `
      <option value="inner">Inner Join</option>
      <option value="left">Left Join</option>
    `;

    const outputNameInput = document.createElement("input");
    outputNameInput.type = "text";
    outputNameInput.className = "spazio-text-field";
    outputNameInput.placeholder = "Analysis Results";
    outputNameInput.value = "Hazard Vulnerability Output";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "spazio-submit-button";
    analyzeBtn.textContent = "Run Analysis";
    // {lang:id} Jalankan Analisis
    analyzeBtn.disabled = true;

    // Enable/disable actions helper
    const updateButtonStates = () => {
      bufferBtn.disabled = !loadedInputLayer;
      analyzeBtn.disabled = !(loadedInputLayer && loadedJoinLayer && joinAttributeSelect.value);
    };

    // Load handlers
    inputLoadBtn.addEventListener("click", async () => {
      const file = inputFileInput.files?.[0];
      if (!file) {
        setStatus("Select an input GeoJSON file first.");
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as FeatureCollection;
        loadedInputLayer = parsed;
        bufferedLayer = null;
        const layerName = inputNameInput.value.trim() || file.name;
        inputStatusText.textContent = `Loaded: ${layerName}`;
        registerLayer(layerName, parsed);
        setStatus(`Successfully loaded ${layerName}`);
      } catch {
        setStatus("Failed to load input file.");
      }
      updateButtonStates();
    });

    joinLoadBtn.addEventListener("click", async () => {
      const file = joinFileInput.files?.[0];
      if (!file) {
        setStatus("Select a join GeoJSON file first.");
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as FeatureCollection;
        loadedJoinLayer = parsed;
        const layerName = joinNameInput.value.trim() || file.name;
        joinStatusText.textContent = `Loaded: ${layerName}`;
        registerLayer(layerName, parsed);

        // Collect attributes
        const attrs = new Set<string>();
        getNumericOnlyKeys(parsed).forEach(attr => {
          attrs.add(attr);
        })

        joinAttributeSelect.innerHTML = "";
        if (attrs.size > 0) {
          attrs.forEach(attr => {
            const opt = document.createElement("option");
            applyRightPanelStyle(opt, "selectOption");
            opt.value = attr;
            opt.textContent = attr;
            joinAttributeSelect.appendChild(opt);
          });
          joinAttributeSelect.disabled = false;
        } else {
          joinAttributeSelect.disabled = true;
        }
        setStatus(`Successfully loaded ${layerName}`);
      } catch {
        setStatus("Failed to load join file.");
      }
      updateButtonStates();
    });

    // Run handlers
    bufferBtn.addEventListener("click", () => {
      if (!loadedInputLayer) return;
      const dist = parseFloat(distanceInput.value);
      const units = unitSelect.value as BufferUnits;
      if (isNaN(dist) || dist <= 0) {
        setStatus("Distance must be a positive number.");
        return;
      }
      try {
        setStatus("Generating buffer...");
        bufferedLayer = createBufferedLayer(loadedInputLayer, dist, units);
        const outName = (inputNameInput.value.trim() || "Input") + " Buffer";
        registerLayer(outName, bufferedLayer);
        setStatus(`Buffered layer "${outName}" created.`);
      } catch (err) {
        setStatus("Buffering failed: " + (err as Error).message);
      }
    });

    analyzeBtn.addEventListener("click", () => {
      if (!loadedInputLayer || !loadedJoinLayer) return;
      const dist = parseFloat(distanceInput.value);
      const units = unitSelect.value as BufferUnits;
      const rel = relationshipSelect.value as SpatialRelationship;
      const jType = joinTypeSelect.value as JoinType;
      const attr = joinAttributeSelect.value;
      const outName = outputNameInput.value.trim() || "Analysis Result";

      if (isNaN(dist) || dist <= 0) {
        setStatus("Distance must be a positive number.");
        return;
      }

      try {
        setStatus("Running spatial overlay analysis...");
        // If the user already generated a buffer, use it, otherwise generate a temporary buffer
        const baseLayer = bufferedLayer || createBufferedLayer(loadedInputLayer, dist, units);

        const result = analyzeBufferZone({
          inputLayer: baseLayer,
          joinLayer: loadedJoinLayer,
          bufferDistance: dist,
          bufferUnits: units,
          spatialRelationship: rel,
          joinType: jType,
          joinAttribute: attr
        });

        registerLayer(outName, result);
        setStatus(`Analysis layer "${outName}" created.`);
      } catch (err) {
        setStatus("Analysis failed: " + (err as Error).message);
      }
    });

    // Append everything
    form.appendChild(createField("Input Layer", inputWrapper, "Upload the geojson layer to buffer."));
    form.appendChild(inputStatusText);
    form.appendChild(createField("Buffer Distance", distanceInput));
    form.appendChild(createField("Buffer Units", unitSelect));

    const bufRow = document.createElement("div");
    bufRow.className = "spazio-flex-row";
    bufRow.appendChild(bufferBtn);
    form.appendChild(bufRow);

    form.appendChild(createField("Join Layer (Summarize)", joinWrapper, "Upload the attribute/points layer to overlay."));
    form.appendChild(joinStatusText);
    form.appendChild(createField("Join Numeric Attribute", joinAttributeSelect));
    form.appendChild(createField("Spatial Relationship", relationshipSelect));
    form.appendChild(createField("Overlay Join Type", joinTypeSelect));
    form.appendChild(createField("Output Layer Name", outputNameInput));

    form.appendChild(analyzeBtn);
    form.appendChild(statusEl);

    wrapper.appendChild(form);

  }
  else if(method ==="Hazard Resistance Analysis"){
    const app = _app;
    const form = document.createElement("form");
    form.className = "spazio-form-container";

    // ── createField helper (scoped to this block) ──
    const createField = (labelText: string, input: HTMLElement, helpText?: string): HTMLDivElement => {
      const field = document.createElement("div");
      field.className = "spazio-section";
      const label = document.createElement("label");
      label.className = "spazio-input-label";
      label.textContent = labelText;
      field.appendChild(label);
      field.appendChild(input);
      if (helpText) {
        const hint = document.createElement("div");
        hint.className = "spazio-input-description";
        hint.textContent = helpText;
        field.appendChild(hint);
      }
      return field;
    };

    // ── Input Layer File Field ──
    const inputLayerWrapper = document.createElement("div");
    const inputLayerInput = document.createElement("input");
    inputLayerInput.type = "file";
    inputLayerInput.accept = ".geojson,.json,application/geo+json";
    inputLayerInput.className = "spazio-text-field";
    inputLayerWrapper.appendChild(inputLayerInput);

    // ── Data Layers Count Field ──
    const countWrapper = document.createElement("div");
    const countInput = document.createElement("input");
    countInput.type = "number";
    countInput.min = "0";
    countInput.max = "10";
    countInput.value = "0";
    countInput.className = "spazio-text-field";
    countWrapper.appendChild(countInput);

    // ── Container for dynamic data layers file inputs ──
    const dataLayersContainer = document.createElement("div");

    // ── Method Selector (AND / OR) ──
    const methodWrapper = document.createElement("div");
    const methodSelect = document.createElement("select");
    methodSelect.className = "spazio-dropdown";
    drawDropdownOptions(methodSelect, ["OR", "AND"], ["OR (Union)", "AND (Intersection)"]);
    methodWrapper.appendChild(methodSelect);

    // ── Clip Checkbox ──
    const clipWrapper = document.createElement("div");
    const clipCheckbox = document.createElement("input");
    clipCheckbox.type = "checkbox";
    clipCheckbox.id = "hra-clip-checkbox";
    const clipLabel = document.createElement("label");
    clipLabel.htmlFor = "hra-clip-checkbox";
    clipLabel.textContent = " Clip output features to input layer boundaries";
    // {lang:id} Potong fitur-fitur output ke batas-batas layer input
    clipLabel.style.marginLeft = "8px";
    clipWrapper.append(clipCheckbox, clipLabel);

    // ── Output layer name input ──
    const outputNameWrapper = document.createElement("div");
    const outputNameInput = document.createElement("input");
    outputNameInput.type = "text";
    outputNameInput.value = "hazard_resistance_output";
    outputNameInput.className = "spazio-text-field";
    outputNameWrapper.appendChild(outputNameInput);

    // ── Status Element ──
    const statusEl = document.createElement("div");
    statusEl.className = "spazio-status";
    statusEl.style.marginTop = "10px";

    // ── Action Buttons Container ──
    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "spazio-flex-col";
    actionsWrapper.style.display = "flex";
    actionsWrapper.style.flexDirection = "column";
    actionsWrapper.style.gap = "8px";
    actionsWrapper.style.marginTop = "15px";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "spazio-submit-button";
    analyzeBtn.textContent = "Run Analysis";
    // {lang:id} Jalankan Analisis

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "spazio-button";
    resetBtn.textContent = "Reset Form";
    // {lang:id} Reset Formulir

    actionsWrapper.append(analyzeBtn, resetBtn);

    // ── Optional Download Buttons (controlled by ENABLE_DOWNLOAD) ──
    let downloadFinalBtn: HTMLButtonElement | null = null;
    let downloadIntermediateBtn: HTMLButtonElement | null = null;

    if (ENABLE_DOWNLOAD) {
      downloadFinalBtn = document.createElement("button");
      downloadFinalBtn.type = "button";
      downloadFinalBtn.className = "spazio-button";
      downloadFinalBtn.textContent = "Download Final GeoJSON";
      // {lang:id} Download GeoJSON terakhir
      downloadFinalBtn.disabled = true;

      downloadIntermediateBtn = document.createElement("button");
      downloadIntermediateBtn.type = "button";
      downloadIntermediateBtn.className = "spazio-button";
      downloadIntermediateBtn.textContent = "Download Intermediate GeoJSON";
      // {lang:id} Download GeoJSON proses
      downloadIntermediateBtn.disabled = true;

      actionsWrapper.append(downloadFinalBtn, downloadIntermediateBtn);
    }

    // ── Form State ──
    let inputLayerFile: File | null = null;
    const dataLayerFiles: (File | null)[] = [];
    let finalOutput: FeatureCollection<Geometry, GeoJsonProperties> | null = null;
    let intermediateOutput: FeatureCollection<Geometry, GeoJsonProperties> | null = null;

    const setStatus = (message: string, isError = false) => {
      statusEl.textContent = message;
      statusEl.style.color = isError ? "#dc2626" : "#4b5563";
    };


    const updateDownloadButtons = () => {
      if (downloadFinalBtn) downloadFinalBtn.disabled = !finalOutput;
      if (downloadIntermediateBtn) downloadIntermediateBtn.disabled = !intermediateOutput;
    };

    // ── Dynamic Input Builder for Data Layers ──
    const rebuildDataLayerInputs = () => {
      dataLayersContainer.innerHTML = "";
      const count = Math.max(0, Math.min(10, parseInt(countInput.value, 10) || 0));
      dataLayerFiles.length = count;

      for (let i = 0; i < count; i++) {
        const itemField = document.createElement("div");
        itemField.style.marginTop = "8px";

        const label = document.createElement("label");
        label.textContent = `Data Layer ${i + 1}`;
        label.className = "spazio-input-label";

        const fileIn = document.createElement("input");
        fileIn.type = "file";
        fileIn.accept = ".geojson,.json,application/geo+json";
        fileIn.className = "spazio-text-field";

        fileIn.addEventListener("change", () => {
          dataLayerFiles[i] = fileIn.files?.[0] || null;
        });

        itemField.append(label, fileIn);
        dataLayersContainer.appendChild(itemField);
      }
      styleRightPanelTree(wrapper);
    };

    // ── Event Listeners ──
    inputLayerInput.addEventListener("change", () => {
      inputLayerFile = inputLayerInput.files?.[0] || null;
    });

    countInput.addEventListener("change", rebuildDataLayerInputs);

    // ── Helper to read File to GeoJSON ──
    const readFileAsGeoJson = async (file: File): Promise<LoadedLayer> => {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.type !== "FeatureCollection") {
        throw new Error(`File ${file.name} is not a valid GeoJSON FeatureCollection`);
      }
      return {
        name: file.name.replace(/\.[^/.]+$/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        data: parsed,
      };
    };

    // ── Helper to trigger Browser Download ──
    const triggerDownload = (filename: string, content: FeatureCollection<Geometry, GeoJsonProperties>) => {
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    // ── Reset Handler ──
    resetBtn.addEventListener("click", () => {
      form.reset();
      inputLayerFile = null;
      dataLayerFiles.length = 0;
      finalOutput = null;
      intermediateOutput = null;
      rebuildDataLayerInputs();
      updateDownloadButtons();
      setStatus("Form cleared. Upload new layers to analyze.");
    });

    // ── Analyze Handler ──
    analyzeBtn.addEventListener("click", async () => {
      try {
        setStatus("Processing spatial analysis...");
        analyzeBtn.disabled = true;

        if (!inputLayerFile) {
          throw new Error("Please upload an Input Layer.");
        }

        const count = dataLayerFiles.length;
        for (let i = 0; i < count; i++) {
          if (!dataLayerFiles[i]) {
            throw new Error(`Please upload a GeoJSON file for Data Layer ${i + 1}.`);
          }
        }

        const inputLayer = await readFileAsGeoJson(inputLayerFile);
        const dataLayers = await Promise.all(
          dataLayerFiles.map(file => readFileAsGeoJson(file!))
        );

        const methodVal = methodSelect.value;
        const clipToInput = clipCheckbox.checked;


        const result = methodVal === "AND"
          ? runAndAnalysisWithIntermediate(inputLayer, dataLayers, clipToInput)
          : runOrAnalysisWithIntermediate(inputLayer, dataLayers, clipToInput);

        finalOutput = result.finalOutput;
        intermediateOutput = result.intermediateOutput;
        updateDownloadButtons();

        if (app.addGeoJsonLayer) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          app.addGeoJsonLayer(outName, finalOutput);
          setStatus(`Success! Added layer "${outName}" to map.`);
        } else {
          setStatus("Analysis complete. (Note: host app does not support displaying layers).");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), true);
      } finally {
        analyzeBtn.disabled = false;
      }
    });

    if (downloadFinalBtn) {
      downloadFinalBtn.addEventListener("click", () => {
        if (finalOutput) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          triggerDownload(`${outName}_final.geojson`, finalOutput);
        }
      });
    }

    if (downloadIntermediateBtn) {
      downloadIntermediateBtn.addEventListener("click", () => {
        if (intermediateOutput) {
          const outName = outputNameInput.value.trim() || "hazard_resistance_output";
          triggerDownload(`${outName}_intermediate.geojson`, intermediateOutput);
        }
      });
    }

    // ── Append Fields to Form ──
    form.appendChild(createField("Input Layer (Boundary)", inputLayerWrapper, "Upload the base layer defining analysis boundaries."));
    form.appendChild(createField("Number of Data Layers", countWrapper, "Specify how many additional layers to intersect/union."));
    form.appendChild(dataLayersContainer);
    form.appendChild(createField("Analysis Method", methodWrapper, "Select spatial logical combination operator."));
    form.appendChild(clipWrapper);
    form.appendChild(createField("Output Layer Name", outputNameWrapper));
    form.appendChild(actionsWrapper);
    form.appendChild(statusEl);

    wrapper.appendChild(form);

    // Initial load
    rebuildDataLayerInputs();

    return () => {
      form.remove();
    };
  }
}

function removeAllChildElements(parent:  HTMLElement){
  if(!parent) return;

  while(parent.firstChild){
    parent.removeChild(parent.firstChild);
  }
}

/**
 * Register and open the template's right-sidebar panel.
 *
 * @param app - The GeoLibre host API passed to the plugin's `activate` hook.
 * @returns A disposer that closes and unregisters the panel, or `null` when the
 *   host does not provide a right sidebar (so the caller can skip cleanup).
 */
export function registerTemplateRightPanel<TControl extends GeoLibreControl>(
  app: GeoLibreAppAPI<TControl>,
): (() => void) | null {
  _app = app as GeoLibreAppAPI;
  // Attach getMap to _app for use by the Network Analysis picking mode
  // Right panels are an optional host capability; degrade gracefully when the
  // host (or standalone usage) does not provide them.
  if (!app.registerRightPanel) return null;

  const unregister = app.registerRightPanel({
    id: RIGHT_PANEL_ID,
    title: "THA",
    defaultWidth: 320,
    render(container) {
      //Wrapper
      const wrap = document.createElement("div");
      wrap.className = "geolibre-plugin-right-panel";

      //Description
      const heading = document.createElement("h2");
      heading.textContent = "Terrain & Hydrological Analysis Workbench";
      // {lang:id} Workbench Analisa Medan & Hidrologi

      //Method Select
      const method = document.createElement("select");
      method.className = "spazio-dropdown";
      /*
      const methodPlaceholder = document.createElement("option");
      methodPlaceholder.value = "";
      methodPlaceholder.textContent = "Select Geoprocessing function";
      methodPlaceholder.className = "geoprocessing-method-option";
      method.appendChild(methodPlaceholder);
      */
      drawDropdownOptions(method,BASE_METHODS, BASE_METHODS_TC);
      _method = method;
      //Method Form Container
      const methodFormContainer = document.createElement("div");
      methodFormContainer.className = "spazio-form-container";

      const body = document.createElement("p");
      _methodForm = methodFormContainer;

      wrap.append(heading, body, method, methodFormContainer);
      container.appendChild(wrap);
      styleRightPanelTree(wrap);

      //Event: Method selected
      method.addEventListener("change", () => {
        loadMethodForm(methodFormContainer, method.value);
        styleRightPanelTree(wrap);
      })

      // Optional cleanup, run when the panel closes or is unregistered.
      return () => {
        wrap.remove();
      };
    },
  });

  // Open it right away so the example is visible on activation. Remove this call
  // (or gate it behind a button in your control) if you would rather open the
  // panel on demand instead of every time the plugin activates.
  app.openRightPanel?.(RIGHT_PANEL_ID);

  return () => {
    app.closeRightPanel?.(RIGHT_PANEL_ID);
    unregister();
  };
}
