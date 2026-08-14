import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import type { FeatureCollection } from "geojson";
import { generateNDVI, generateNDWI, generateSlope } from "../tha/raster-analysis";
import { getGeoTIFFBandCount } from "../utils/geotiff-processor";
import { runNetworkAnalysis } from "../tha/network-analysis";
import type { LayerConfig } from "../tha/network-analysis";

/** Toggle to enable or disable exporting the calculated optimal route */
const ENABLE_DOWNLOAD = true;

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
export const RIGHT_PANEL_ID = "geolibre-plugin-template-workbench";
let _app : GeoLibreAppAPI;


function createBandOptions(num : number, mode : boolean){
  const tcs : string[] = [];
  for(let i = 0; i<num; i++){
    let tc = String(i+1);
    if(mode) tc = "Band " + (i+1);
    tcs.push(tc);
  }
  return tcs;
}

function drawAnalysisMethods(dropdown : HTMLElement, methods : string[], textContents? : string[]){
  methods.forEach((method, index) => {
    const methodOption = document.createElement("option");
    methodOption.className = "geoprocessing-method-option";
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
    methodFunctionSelect.appendChild(methodFunctionPlaceholder);
    wrapper.appendChild(methodFunctionSelect);
    const methodFunctionOptions = ["", "Slope", "NDVI", "NDWI"];
    const methodFunctionOptionsTC = ["Select Analysis Function", "Slope", "NDVI", "NDWI"];
    const raMethodForm = document.createElement("div");
    wrapper.appendChild(raMethodForm);
    drawAnalysisMethods(methodFunctionSelect, methodFunctionOptions, methodFunctionOptionsTC);
    methodFunctionSelect.addEventListener("change", () => {
        loadMethodForm(raMethodForm, methodFunctionSelect.value);
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
  else if(method  === "Analisis Medan & Hidrologi"){
    const methodFunctionSelect = document.createElement("select");
    const methodFunctionPlaceholder = document.createElement("select");
    methodFunctionPlaceholder.value = "";
    methodFunctionPlaceholder.textContent = "Select Analisis Medan & Hidrologi Function";
    methodFunctionSelect.appendChild(methodFunctionPlaceholder);
    const methodFunctionOptions = ["Hazard Vulnerability Modeling", "Hazard Resistance Analysis"];
    const raMethodForm = document.createElement("div");
    drawAnalysisMethods(raMethodForm, methodFunctionOptions);
    methodFunctionSelect.addEventListener("change", () => {
        loadMethodForm(raMethodForm, methodFunctionSelect.value);
      })
  }
  //Raster Analysis Forms
  else if(method === "Slope"){
    const fileInputLabel = document.createElement("h1");
    fileInputLabel.textContent = "DEM Raster";
    wrapper.appendChild(fileInputLabel);
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".tiff, .tif";
    fileInput.className ="spatio-file-input";
    wrapper.appendChild(fileInput);
    const unitSelectLabel = document.createElement("h1");
    unitSelectLabel.textContent = "Select Slope Unit";
    const unitSelect = document.createElement("select");
    drawAnalysisMethods(unitSelect, ["Degrees", "Percent", "Ratio"]);
    const slopeZFactor = document.createElement("input");
    slopeZFactor.type = "number";
    slopeZFactor.min = "0";
    slopeZFactor.value = "1";
    wrapper.appendChild(unitSelectLabel);
    wrapper.appendChild(unitSelect);
    wrapper.appendChild(slopeZFactor);

    const processingButton = document.createElement("button");
    processingButton.type = "button";
    processingButton.className = "spatio-action-button";
    processingButton.textContent = "Generate Slope";
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
    const fileInputBLabel = document.createElement("h1");
    fileInputBLabel.textContent = "Red Raster";
    wrapper.appendChild(fileInputBLabel);
    const fileInputB = document.createElement("input");
    fileInputB.type = "file";
    fileInputB.accept = ".tiff, .tif";
    fileInputB.className ="spatio-file-input";
    wrapper.appendChild(fileInputB);
    const redSelectLabel = document.createElement("h1");
    redSelectLabel.textContent = 'Select raster band for "Red"';
    wrapper.appendChild(redSelectLabel);
    const redSelect = document.createElement("select");
    wrapper.appendChild(redSelect);
    fileInputA.addEventListener('change', async () =>{
      const bands = fileInputA.files ? await getGeoTIFFBandCount(fileInputA.files?.[0]) : 0;
      drawAnalysisMethods(nirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    fileInputB.addEventListener('change', async ()=>{
      const bands  = fileInputB.files ? await getGeoTIFFBandCount(fileInputB.files?.[0]) : 0;
      drawAnalysisMethods(redSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "spatio-action-button";
    actionButton.textContent = "Generate NDVI";
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
    const fileInputBLabel = document.createElement("h1");
    fileInputBLabel.textContent = "Green Raster";
    wrapper.appendChild(fileInputBLabel);
    const fileInputB = document.createElement("input");
    fileInputB.type = "file";
    fileInputB.accept = ".tiff, .tif";
    fileInputB.className ="spatio-file-input";
    wrapper.appendChild(fileInputB);
    const greenSelectLabel = document.createElement("h1");
    greenSelectLabel.textContent = 'Select raster band for "Green"';
    wrapper.appendChild(greenSelectLabel);
    const greenSelect = document.createElement("select");
    wrapper.appendChild(greenSelect);
    fileInputA.addEventListener('change', async () =>{
      const bands = fileInputA.files ? await getGeoTIFFBandCount(fileInputA.files?.[0]) : 0;
      drawAnalysisMethods(nirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    fileInputB.addEventListener('change', async ()=>{
      const bands  = fileInputB.files ? await getGeoTIFFBandCount(fileInputB.files?.[0]) : 0;;
      drawAnalysisMethods(greenSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    });
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "spatio-action-button";
    actionButton.textContent = "Generate NDWI";
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
  else if(method === "Hazard Vulnerability Modeling"){

  }
  else if(method ==="Hazard Resistance Analysis"){

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
    title: "Workbench",
    defaultWidth: 320,
    render(container) {
      //Wrapper
      const wrap = document.createElement("div");
      wrap.className = "geolibre-plugin-right-panel";

      //Description
      const heading = document.createElement("h2");
      heading.textContent = "Plugin Workbench";

      //Method Select
      const method = document.createElement("select");
      method.className = "geoprocessing-method-select";
      /*
      const methodPlaceholder = document.createElement("option");
      methodPlaceholder.value = "";
      methodPlaceholder.textContent = "Select Geoprocessing function";
      methodPlaceholder.className = "geoprocessing-method-option";
      method.appendChild(methodPlaceholder);
      */
      const methodOptions = [
        "", //placeholder
        "Raster Analysis",
        "Network Analysis",
        "Analisis Medan & Hidrologi",
      ]
      const methodOptionsTextContents = [
        "Select Geoprocessing function",  //placeholder
        "Raster Analysis",
        "Network Analysis",
        "Analisis Medan & Hidrologi",
      ]
      drawAnalysisMethods(method,methodOptions, methodOptionsTextContents);

      //Method Form Container
      const methodFormContainer = document.createElement("div");
      methodFormContainer.className = "geoprocessing-method-form-container";

      const body = document.createElement("p");
      body.textContent =
        "This panel is rendered by the plugin through app.registerRightPanel(). " +
        "Replace this content with your own workbench, query review, or " +
        "dashboard UI. Drive it with app.openRightPanel(), collapseRightPanel(), " +
        "and closeRightPanel().";

      wrap.append(heading, body, method, methodFormContainer);
      container.appendChild(wrap);

      //Event: Method selected
      method.addEventListener("change", () => {
        loadMethodForm(methodFormContainer, method.value);
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
