import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import { generateTiled } from "../tha/raster-analysis";

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
    const methodFunctionOptions = ["Slope", "NDVI", "NDSI"];
    const raMethodForm = document.createElement("div");
    wrapper.appendChild(raMethodForm);
    drawAnalysisMethods(methodFunctionSelect, methodFunctionOptions);
    methodFunctionSelect.addEventListener("change", () => {
        loadMethodForm(raMethodForm, methodFunctionSelect.value);
      })
  }
  else if(method === "Network Analysis"){

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
    const processingButton = document.createElement("button");
    processingButton.type = "button";
    processingButton.className = "spatio-action-button";
    processingButton.textContent = "Generate Slope";
    wrapper.appendChild(processingButton);
    processingButton.addEventListener("click", async()=>{
      const file = fileInput.files?.[0];
      if(file){
        const slopeRasterBlob = await generateTiled(file);
        if(_app.addCogLayer){
          _app.addCogLayer("Tiled Raster", URL.createObjectURL(slopeRasterBlob));
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
    fileInputA.addEventListener('change', () =>{
      const bands = 3;
      drawAnalysisMethods(nirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    })
    fileInputB.addEventListener('change', ()=>{
      const bands  = 3;
      drawAnalysisMethods(redSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    })
    
    //update bands on file input changes

  }
  //(Green - SWIR)/(Green + SWIR)
  else if(method === "NDSI"){
    const fileInputALabel = document.createElement("h1");
    fileInputALabel.textContent = "SWIR Raster";
    wrapper.appendChild(fileInputALabel);
    const fileInputA = document.createElement("input");
    fileInputA.type = "file";
    fileInputA.accept = ".tiff, .tif";
    fileInputA.className ="spatio-file-input";
    wrapper.appendChild(fileInputA);
    const swirSelectLabel = document.createElement("h1");
    swirSelectLabel.textContent = 'Select raster band for "SWIR"';
    wrapper.appendChild(swirSelectLabel)
    const swirSelect = document.createElement("select");
    wrapper.appendChild(swirSelect);
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
    fileInputA.addEventListener('change', () =>{
      const bands = 3;
      drawAnalysisMethods(swirSelect, createBandOptions(bands, false), createBandOptions(bands, true));
    })
    fileInputB.addEventListener('change', ()=>{
      const bands  = 3;
      drawAnalysisMethods(greenSelect, createBandOptions(bands, false), createBandOptions(bands, true));
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
      const methodPlaceholder = document.createElement("option");
      methodPlaceholder.value = "";
      methodPlaceholder.textContent = "Select Geoprocessing function";
      methodPlaceholder.className = "geoprocessing-method-option";
      method.appendChild(methodPlaceholder);
      const methodOptions = [
        "Raster Analysis",
        "Network Analysis",
        "Analisis Medan & Hidrologi",
      ]
      drawAnalysisMethods(method, methodOptions);

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
