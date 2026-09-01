import { describe, it, expect, vi } from "vitest";
import type {
  GeoLibreAppAPI,
  GeoLibreControl,
  GeoLibreRightPanelRegistration,
} from "../src/lib/geolibre/host-api";
import {
  RIGHT_PANEL_ID,
  registerTemplateRightPanel,
} from "../src/lib/geolibre/right-panel";
import { styleRightPanelTree } from "../src/lib/styles/spazio-right-panel-styles";
import { writeFloat32TiledGeoTIFF } from "../src/lib/utils/geotiff-processor";
import { runDelineation } from "../src/lib/tha/watershed-delineation";

/**
 * Minimal stub of the host API. Captures the right-panel registration so the
 * test can drive its `render` callback the way GeoLibre would.
 */
function createApp(withRightPanel = true) {
  let registered: GeoLibreRightPanelRegistration | null = null;
  const unregister = vi.fn();
  const app: GeoLibreAppAPI<GeoLibreControl> = {
    addMapControl: () => true,
    removeMapControl: () => undefined,
  };

  if (withRightPanel) {
    app.registerRightPanel = (panel) => {
      registered = panel;
      return unregister;
    };
    app.openRightPanel = vi.fn(() => true);
    app.closeRightPanel = vi.fn();
  }

  return {
    app,
    unregister,
    getRegistered: () => registered,
  };
}

describe("registerTemplateRightPanel", () => {
  it("registers and opens the panel, and renders into the container", () => {
    const { app, getRegistered } = createApp();

    const dispose = registerTemplateRightPanel(app);
    expect(dispose).toBeTypeOf("function");

    const panel = getRegistered();
    expect(panel?.id).toBe(RIGHT_PANEL_ID);
    expect(app.openRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);

    const container = document.createElement("div");
    const cleanup = panel?.render(container);
    expect(container.querySelector("h2")?.textContent).toBe("Terrain & Hydrological Analysis Workbench");

    // The returned cleanup removes the plugin's own DOM.
    expect(cleanup).toBeTypeOf("function");
    (cleanup as () => void)();
    expect(container.querySelector("h2")).toBeNull();
  });

  it("applies registry styles without replacing native controls", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);

    const root = container.querySelector(".geolibre-plugin-right-panel") as HTMLElement;
    const methodSelect = root.querySelector("select") as HTMLSelectElement;
    const firstOption = methodSelect.querySelector("option") as HTMLOptionElement;

    expect(root.classList.contains("spazio-container")).toBe(true);
    expect(methodSelect.classList.contains("spazio-dropdown")).toBe(true);
    expect(firstOption.classList.contains("spazio-dropdown-options")).toBe(true);
    expect(methodSelect.style.border).not.toBe("");
    expect(firstOption.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(firstOption.style.color).toBe("rgb(0, 0, 0)");

    methodSelect.value = "Raster Analysis";
    methodSelect.dispatchEvent(new Event("change"));
    const rasterSelect = root.querySelectorAll("select")[1] as HTMLSelectElement;
    rasterSelect.value = "Slope";
    rasterSelect.dispatchEvent(new Event("change"));

    const fileInput = root.querySelector('input[type="file"]') as HTMLInputElement;
    const actionButton = Array.from(root.querySelectorAll("button")).find(
      (button) => button.textContent === "Generate Slope",
    ) as HTMLButtonElement;

    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    expect(fileInput.type).toBe("file");
    expect(fileInput.style.border).not.toBe("");
    expect(actionButton).toBeInstanceOf(HTMLButtonElement);
    expect(actionButton.style.border).not.toBe("");
  });

  it("styles the complete optimal route submenu when pick buttons contain SVG", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);
    const root = container.querySelector(".geolibre-plugin-right-panel") as HTMLElement;
    const methodSelect = root.querySelector("select") as HTMLSelectElement;

    methodSelect.value = "Network Analysis";
    methodSelect.dispatchEvent(new Event("change"));
    const networkMethodSelect = root.querySelectorAll("select")[1] as HTMLSelectElement;
    networkMethodSelect.value = "Find Optimal Route";
    networkMethodSelect.dispatchEvent(new Event("change"));

    expect(root.querySelector("#na-start-coord")).not.toBeNull();
    expect(root.querySelector("#na-dest-coord")?.getAttribute("style")).toContain("border");
    expect(root.querySelector("#na-snap-tolerance")?.getAttribute("style")).toContain("border");
    expect(root.querySelector("#na-pick-dest")?.getAttribute("style")).toContain("border");
    expect(root.querySelector("#na-analyze-btn")?.getAttribute("style")).toContain("border");
  });

  it("styles Network Analysis layer-selection cards from the registry", () => {
    const root = document.createElement("div");
    const layerList = document.createElement("div");
    layerList.className = "na-layer-list";
    const card = document.createElement("div");
    card.className = "na-layer-card";
    const label = document.createElement("label");
    label.className = "na-check-label";
    const subForm = document.createElement("div");
    subForm.className = "na-layer-subform";
    card.append(label, subForm);
    layerList.appendChild(card);
    root.appendChild(layerList);

    styleRightPanelTree(root);

    expect(layerList.classList.contains("spazio-layer-list")).toBe(true);
    expect(card.classList.contains("spazio-layer-card")).toBe(true);
    expect(label.classList.contains("spazio-check-label")).toBe(true);
    expect(subForm.classList.contains("spazio-layer-subform")).toBe(true);
    expect(card.style.border).not.toBe("");
    expect(card.style.backgroundColor).toBe("rgb(249, 250, 251)");
    expect(label.style.color).toBe("rgb(17, 24, 39)");
    expect(subForm.style.borderTop).not.toBe("");
  });

  it("closes and unregisters the panel when disposed", () => {
    const { app, unregister } = createApp();
    const dispose = registerTemplateRightPanel(app);

    dispose?.();
    expect(app.closeRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);
    expect(unregister).toHaveBeenCalledOnce();
  });

  it("enables the watershed run button after a valid DEM upload", async () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);

    const methodSelect = container.querySelector("select") as HTMLSelectElement;
    methodSelect.value = "Watershed Delineation";
    methodSelect.dispatchEvent(new Event("change"));

    const fileInput = Array.from(container.querySelectorAll('input[type="file"]')).find(
      (input) => input.getAttribute("accept")?.includes(".tif"),
    ) as HTMLInputElement;

    const data = new Float32Array(10 * 10).fill(12.5);
    const buffer = writeFloat32TiledGeoTIFF(10, 10, data, [0, 1, 0, 0, 0, -1], 3857, 1);
    const file = new File([buffer], "sample.tif", { type: "image/tiff" });

    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change"));

    const runButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Run Analysis",
    ) as HTMLButtonElement;

    await vi.waitFor(() => {
      expect(runButton).toBeTruthy();
      expect(runButton.disabled).toBe(false);
    });
  });

  it("keeps the watershed threshold slider and number input side by side without full-width overlap", () => {
    const root = document.createElement("div");
    const row = document.createElement("div");
    row.className = "wd-slider-control";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "wd-slider";
    const numberInput = document.createElement("input");
    numberInput.type = "number";
    numberInput.className = "wd-number-input";
    row.append(slider, numberInput);
    root.appendChild(row);

    styleRightPanelTree(root);

    expect(slider.classList.contains("spazio-slider")).toBe(true);
    expect(numberInput.classList.contains("spazio-wd-number-input")).toBe(true);
    expect(slider.style.flex).toBe("1 1 auto");
    expect(numberInput.style.width).toBe("82px");
    expect(numberInput.style.minWidth).toBe("82px");
    expect(numberInput.style.maxWidth).toBe("82px");
  });

  it("falls back to direct delineation when the worker cannot initialize", async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error Test override
    globalThis.Worker = class {
      constructor() {
        throw new Error("Invalid URL");
      }
    };

    const result = await runDelineation(
      {
        width: 2,
        height: 2,
        data: new Float32Array([1, 2, 3, 4]),
        geotransform: [0, 1, 0, 0, 0, -1],
        crsCode: 3857,
        noDataValue: -9999,
        bandCount: 1,
      },
      { zLimit: 0, threshold: 1 },
    );

    expect(result).toHaveProperty("filledElevation");
    expect(result).toHaveProperty("basinPolygons");
    expect(result.basinPolygons.type).toBe("FeatureCollection");

    globalThis.Worker = originalWorker;
  });

  it("returns null when the host has no right sidebar", () => {
    const { app } = createApp(false);
    expect(registerTemplateRightPanel(app)).toBeNull();
  });
});
