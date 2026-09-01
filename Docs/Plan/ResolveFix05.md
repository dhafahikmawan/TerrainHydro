# Implementation Plan: Resolve Fix 05

This plan implements the styling overhaul, style registry migration, and legacy registry deprecation/deletion described in [Docs/Fix/Fix05.md](../Fix/Fix05.md). It is written with explicit, step-by-step instructions, complete code examples, and exact class mappings suitable for a junior developer or a low-cost AI agent.

---

## 1. Problem & Requirement Summary

### Objective
Migrate all right-panel styling in `src/lib/geolibre/right-panel.ts` and its test suite from the legacy registry (`src/lib/styles/right-panel-styles.ts`) directly to the standardized Spazio style registry in `src/lib/styles/spazio-right-panel-styles.ts`.

### Deprecation & Potential Deletion of Legacy Registry (`right-panel-styles.ts`)
- **Current State**: The codebase has two style registries:
  - `src/lib/styles/right-panel-styles.ts` (legacy, with `right-panel-*`, `plugin-control-*`, and ad-hoc prefixes)
  - `src/lib/styles/spazio-right-panel-styles.ts` (target registry, using the unified `spazio-` taxonomy)
- **Potential Deletion**: The legacy registry `src/lib/styles/right-panel-styles.ts` is scheduled for complete deletion. To ensure seamless deletion:
  1. All imports in `src/lib/geolibre/right-panel.ts` and `tests/right-panel.test.ts` must be repointed directly to `spazio-right-panel-styles.ts`.
  2. No code in `src/` or `tests/` should have any remaining dependencies on `right-panel-styles.ts`.
  3. `src/lib/styles/right-panel-styles.ts` can either be deleted immediately or converted into a temporary deprecated shim that re-exports `spazio-right-panel-styles.ts` until deleted in a cleanup pass.

### Core Architectural Principles
1. **Clean Spazio Registry**: `src/lib/styles/spazio-right-panel-styles.ts` indexes only modern `spazio-*` class names without legacy class mappings.
2. **Direct Class Initialization**: `src/lib/geolibre/right-panel.ts` is updated directly at every `document.createElement` site to initialize elements with their corresponding `spazio-*` classes.
3. **Zero Legacy Dependencies**: When `right-panel-styles.ts` is deleted from the filesystem, the project builds and all tests pass with 0 errors.

---

## 2. Complete Class Name Mapping & Initiation Rules

All DOM element initializations across `src/lib/geolibre/right-panel.ts` must use the following standard classes:

| Role / Element Type | New Spazio Class | Replaces Legacy Classes | Description & Usage |
| :--- | :--- | :--- | :--- |
| **Main Container** | `spazio-container` | `geolibre-plugin-right-panel` | Root right-panel container (`wrap`) |
| **Plugin Title** | `spazio-title` | `na-section-title`, `h1`/`h2` without class | Main title and section headings |
| **Plugin Description** | `spazio-description` | `body` paragraph in right panel | Main plugin description paragraph |
| **Dropdowns** | `spazio-dropdown` | `geoprocessing-method-select`, `na-select`, `plugin-control-input` on select | All `<select>` elements |
| **Dropdown Options** | `spazio-dropdown-options` | `geoprocessing-method-option` | All `<option>` elements |
| **Text / Number Inputs** | `spazio-text-field` | `na-input`, `na-coord-input`, `na-input--small`, `plugin-control-input` | Text and numeric `<input>` fields |
| **File Inputs** | `spazio-file-field` | `spatio-file-input`, `na-file-input`, `plugin-control-input` on file inputs | File upload `<input type="file">` |
| **Sliders** | `spazio-slider` | `wd-slider`, range inputs | Stream threshold and range `<input type="range">` |
| **Slider Number Input** | `spazio-wd-number-input` | `wd-number-input` | Numeric box alongside range slider |
| **Checkboxes** | `spazio-checkbox` | `na-checkbox`, checkboxes | Checkbox `<input type="checkbox">` |
| **Radio Buttons** | `spazio-radio` | `na-radio`, radios | Radio `<input type="radio">` |
| **Input Labels** | `spazio-input-label` | `na-label`, `na-sublabel`, `plugin-control-label` | `<label>` elements for inputs |
| **Field Descriptions** | `spazio-input-description` | `plugin-control-help`, `na-file-status` | Help/description/sub-label text |
| **Submit / Processing Buttons** | `spazio-submit-button` | `spatio-action-button`, `na-analyze-btn`, `plugin-control-button` | Primary action buttons ("Run Analysis", "Generate Slope", "Find Route", "Clip Basin") |
| **Other / Secondary Buttons** | `spazio-button` | `na-pick-btn`, `plugin-control-button-secondary` | Secondary buttons ("Pick Coordinates", download buttons) |
| **Status Text** | `spazio-status` | `na-status`, `plugin-control-status`, `geoprocessing-status` | Status and result log containers |
| **Calculator Expression** | `spazio-expression-field` | Textarea for raster calculations (if any) | Expression formula textarea |
| **Calculator Buttons** | `spazio-calculator-button` | Calculator operator buttons (if any) | Calculator pad buttons |
| **AHP Table** | `spazio-ahp-table` | Analytical Hierarchy Process matrix `<table>` | Matrix comparison table |
| **AHP Table Fields** | `spazio-ahp-field` | Cell input elements in AHP tables | Numeric inputs inside matrix cells |
| **AHP Table Headers** | `spazio-ahp-headers` | `<th>` headers (Raster 1, Raster 2, ...) | Column/row header cells |
| **Forms / Group Containers** | `spazio-form-container` | `geoprocessing-method-form-container`, `plugin-control-form` | Vertical form wrappers |
| **Sections** | `spazio-section` | `na-section`, `plugin-control-group` | Major sub-sections in forms |
| **Flex Row** | `spazio-flex-row` | `na-form-row`, `na-check-row`, `na-radio-group`, `plugin-control-flex` | Horizontal flex row |
| **Flex Column** | `spazio-flex-col` | `plugin-control-flex-col` | Vertical flex column |
| **Divider** | `spazio-divider` | `right-panel-divider` | Horizontal `<hr>` or separator |
| **Layer List** | `spazio-layer-list` | `na-layer-list` | Container for layer cards |
| **Layer Card** | `spazio-layer-card` | `na-layer-card` | Card component for layers |
| **Layer Subform** | `spazio-layer-subform` | `na-layer-subform` | Expanded sub-form in layer card |
| **Layer Check Label** | `spazio-check-label` | `na-check-label` | Checkbox label inside layer card |
| **Watershed Slider Row** | `spazio-wd-slider-control` | `wd-slider-control` | Flex row containing slider + number box |
| **Watershed Stats Grid** | `spazio-wd-stats-grid` | `wd-stats-grid` | 2-column grid for basin statistics |
| **Watershed Stat Item** | `spazio-wd-stat-item` | `wd-stat-item` | Single statistic card |
| **Watershed Stat Label** | `spazio-wd-stat-label` | `wd-stat-label` | Stat metric label |
| **Watershed Stat Value** | `spazio-wd-stat-value` | `wd-stat-value` | Stat metric numeric value |
| **Watershed Progress** | `spazio-wd-progress` | `wd-progress` | Progress step banner |
| **Watershed Badges** | `spazio-wd-badge`, `spazio-wd-badge-ok`, `spazio-wd-badge-error`, `spazio-wd-badge-running` | `wd-badge`, `wd-badge--*` | Status pill badges |


The styles already in `src/lib/styles/spazio-right-panel-styles.ts` takes priority over the old style.
---

## 3. Scope of Changes

1. **`src/lib/styles/spazio-right-panel-styles.ts`**:
   - Define `RIGHT_PANEL_STYLES` indexed cleanly by `spazio-*` class names.
   - Implement `applySpazioStyles(element, ...classNames)` and `styleRightPanelTree(root)`.
   - Export `applyRightPanelStyles` (as alias to `applySpazioStyles`) for backward compatibility during migration.
2. **`src/lib/geolibre/right-panel.ts`**:
   - Update style imports from `../styles/right-panel-styles` directly to `../styles/spazio-right-panel-styles`.
   - Update every element creation site to initialize with the corresponding `spazio-*` class.
3. **`tests/right-panel.test.ts`**:
   - Update import from `../src/lib/styles/right-panel-styles` directly to `../src/lib/styles/spazio-right-panel-styles`.
   - Update assertions to test `spazio-*` class names and styling.
4. **`src/lib/styles/right-panel-styles.ts` (Legacy File Lifecycle)**:
   - Option A (Immediate deletion): Delete `src/lib/styles/right-panel-styles.ts` once all imports are repointed.
   - Option B (Deprecated transition shim): Mark with `@deprecated` docstring and re-export from `spazio-right-panel-styles.ts` until deleted in subsequent cleanup.

---

## 4. Step-by-Step Implementation Instructions

### Step 1: Update `src/lib/styles/spazio-right-panel-styles.ts`

Replace `src/lib/styles/spazio-right-panel-styles.ts` with the clean, unified `spazio-` registry:

```typescript
export type RightPanelStyle = Partial<CSSStyleDeclaration>;

export const RIGHT_PANEL_STYLES: Record<string, RightPanelStyle> = {
  // Main Container & Layout
  "spazio-container": {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.12)",
    fontSize: "13px",
    lineHeight: "1.5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  "spazio-title": {
    margin: "0",
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "600",
  },
  "spazio-description": {
    margin: "0",
    color: "#475569",
    fontSize: "12px",
    lineHeight: "1.4",
  },
  "spazio-text": {
    color: "#334155",
    fontSize: "13px",
  },
  "spazio-form-container": {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  "spazio-section": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  "spazio-flex-row": {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  "spazio-flex-col": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  "spazio-divider": {
    height: "1px",
    margin: "12px 0",
    backgroundColor: "#d1d5db",
  },

  // Input Labels & Descriptions
  "spazio-input-label": {
    display: "block",
    marginBottom: "4px",
    color: "#374151",
    fontSize: "12px",
    fontWeight: "500",
  },
  "spazio-input-description": {
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: "1.4",
  },

  // Form Controls
  "spazio-text-field": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontFamily: "inherit",
  },
  "spazio-file-field": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "6px 8px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
  },
  "spazio-dropdown": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontFamily: "inherit",
  },
  "spazio-dropdown-options": {
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  "spazio-slider": {
    width: "100%",
    accentColor: "#1d4ed8",
    flex: "1 1 auto",
    minWidth: "0",
  },
  "spazio-checkbox": {
    width: "16px",
    height: "16px",
    accentColor: "#1d4ed8",
    cursor: "pointer",
  },
  "spazio-radio": {
    accentColor: "#1d4ed8",
    cursor: "pointer",
  },
  "spazio-expression-field": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "96px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "monospace",
    resize: "vertical",
  },

  // Buttons
  "spazio-submit-button": {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "center",
  },
  "spazio-button": {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 12px",
    border: "1px solid #6b7280",
    borderRadius: "4px",
    backgroundColor: "#4b5563",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },
  "spazio-calculator-button": {
    boxSizing: "border-box",
    minHeight: "32px",
    padding: "6px 10px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },

  // Status
  "spazio-status": {
    margin: "0",
    color: "#4b5563",
    fontSize: "12px",
    overflowWrap: "break-word",
    lineHeight: "1.4",
  },
  "spazio-status-success": {
    color: "#15803d",
    fontSize: "12px",
    fontWeight: "500",
  },
  "spazio-status-error": {
    color: "#dc2626",
    fontSize: "12px",
    fontWeight: "500",
  },

  // AHP Table
  "spazio-ahp-table": {
    borderCollapse: "collapse",
    width: "100%",
    marginTop: "8px",
    marginBottom: "8px",
  },
  "spazio-ahp-headers": {
    padding: "6px 8px",
    color: "#334155",
    fontWeight: "600",
    backgroundColor: "#f1f5f9",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
    textAlign: "left",
  },
  "spazio-ahp-field": {
    boxSizing: "border-box",
    width: "72px",
    minHeight: "32px",
    padding: "6px",
    color: "#111827",
    backgroundColor: "#ffffff",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    fontSize: "13px",
    textAlign: "center",
  },
  "spazio-ahp-cell": {
    padding: "6px",
    border: "1px solid #cbd5e1",
    color: "#334155",
    fontSize: "13px",
  },

  // Network Analysis Components
  "spazio-layer-list": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  "spazio-layer-card": {
    boxSizing: "border-box",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    backgroundColor: "#f9fafb",
    boxShadow: "0 1px 2px rgba(17, 24, 39, 0.08)",
  },
  "spazio-check-label": {
    overflow: "hidden",
    color: "#111827",
    fontSize: "12px",
    fontWeight: "500",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  },
  "spazio-layer-subform": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid #d1d5db",
  },

  // Watershed Delineation Components
  "spazio-wd-slider-control": {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
  },
  "spazio-wd-number-input": {
    boxSizing: "border-box",
    width: "82px",
    minWidth: "82px",
    maxWidth: "82px",
    minHeight: "36px",
    padding: "6px 8px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
    textAlign: "right",
    flex: "0 0 82px",
  },
  "spazio-wd-stats-grid": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
  },
  "spazio-wd-stat-item": {
    padding: "8px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    backgroundColor: "#f9fafb",
  },
  "spazio-wd-stat-label": {
    display: "block",
    color: "#6b7280",
    fontSize: "11px",
  },
  "spazio-wd-stat-value": {
    display: "block",
    color: "#111827",
    fontSize: "14px",
    fontWeight: "600",
  },
  "spazio-wd-progress": {
    padding: "8px",
    backgroundColor: "#eff6ff",
    color: "#1e3a8a",
    fontSize: "12px",
    borderRadius: "4px",
  },
  "spazio-wd-badge": {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    backgroundColor: "#e5e7eb",
    color: "#374151",
    fontSize: "11px",
    fontWeight: "600",
  },
  "spazio-wd-badge-ok": { backgroundColor: "#dcfce7", color: "#166534" },
  "spazio-wd-badge-error": { backgroundColor: "#fee2e2", color: "#991b1b" },
  "spazio-wd-badge-running": { backgroundColor: "#dbeafe", color: "#1e40af" },
};

/**
 * Applies Spazio styles and adds class names if not present.
 */
export function applySpazioStyles(
  element: HTMLElement | SVGElement,
  ...classNames: string[]
): void {
  for (const className of classNames) {
    if (className && !element.classList.contains(className)) {
      element.classList.add(className);
    }
    const style = RIGHT_PANEL_STYLES[className];
    if (style && "style" in element) {
      Object.assign((element as HTMLElement).style, style);
    }
  }
}

/** Backward compatibility alias for applySpazioStyles */
export const applyRightPanelStyles = applySpazioStyles;

/**
 * Derives style roles strictly based on assigned spazio classes and native HTML tags.
 */
export function getSpazioStyleRoles(element: Element, isRoot: boolean): string[] {
  const roles: string[] = [];
  const classNames = Array.from(element.classList);
  const tagName = element.tagName.toLowerCase();

  // Root container
  if (isRoot || classNames.includes("spazio-container")) {
    roles.push("spazio-container");
  }

  // Preserve all explicitly set spazio-* classes
  for (const cls of classNames) {
    if (cls.startsWith("spazio-") && !roles.includes(cls)) {
      roles.push(cls);
    }
  }

  // Tag fallbacks (only if no explicit spazio class was set for the role)
  if (roles.length === 0 || (roles.length === 1 && roles[0] === "spazio-container" && !isRoot)) {
    if (tagName === "h1" || tagName === "h2" || tagName === "h3") {
      roles.push("spazio-title");
    } else if (tagName === "p") {
      roles.push("spazio-description");
    } else if (tagName === "label") {
      roles.push("spazio-input-label");
    } else if (tagName === "select") {
      roles.push("spazio-dropdown");
    } else if (tagName === "option") {
      roles.push("spazio-dropdown-options");
    } else if (tagName === "textarea") {
      roles.push("spazio-expression-field");
    } else if (tagName === "input") {
      const input = element as HTMLInputElement;
      if (input.type === "file") roles.push("spazio-file-field");
      else if (input.type === "range") roles.push("spazio-slider");
      else if (input.type === "checkbox") roles.push("spazio-checkbox");
      else if (input.type === "radio") roles.push("spazio-radio");
      else roles.push("spazio-text-field");
    } else if (tagName === "button") {
      roles.push("spazio-submit-button");
    } else if (tagName === "table") {
      roles.push("spazio-ahp-table");
    } else if (tagName === "th") {
      roles.push("spazio-ahp-headers");
    } else if (tagName === "td") {
      roles.push("spazio-ahp-cell");
    }
  }

  return roles;
}

/**
 * Traverses the DOM tree under root and applies all Spazio styling rules.
 */
export function styleRightPanelTree(root: HTMLElement): void {
  applySpazioStyles(root, ...getSpazioStyleRoles(root, true));
  root.querySelectorAll<HTMLElement | SVGElement>("*").forEach((element) => {
    applySpazioStyles(element, ...getSpazioStyleRoles(element, false));
  });
}
```

---

### Step 2: Repoint Imports in `src/lib/geolibre/right-panel.ts` and `tests/right-panel.test.ts`

1. In `src/lib/geolibre/right-panel.ts` (around line 10), change:
   ```typescript
   // BEFORE:
   import { applyRightPanelStyles, styleRightPanelTree } from "../styles/right-panel-styles";

   // AFTER:
   import { applySpazioStyles, styleRightPanelTree } from "../styles/spazio-right-panel-styles";
   ```

2. In `tests/right-panel.test.ts` (around line 11), change:
   ```typescript
   // BEFORE:
   import { styleRightPanelTree } from "../src/lib/styles/right-panel-styles";

   // AFTER:
   import { styleRightPanelTree } from "../src/lib/styles/spazio-right-panel-styles";
   ```

---

### Step 3: Update Class Initiations in `src/lib/geolibre/right-panel.ts`

Replace legacy class assignments across `src/lib/geolibre/right-panel.ts` with direct `spazio-*` class assignments:

#### 1. Header & Root Container (`registerTemplateRightPanel`)
```typescript
    render(container) {
      const wrap = document.createElement("div");
      wrap.className = "spazio-container";

      const heading = document.createElement("h2");
      heading.className = "spazio-title";
      heading.textContent = "Terrain & Hydrological Analysis Workbench";

      const body = document.createElement("p");
      body.className = "spazio-description";

      const method = document.createElement("select");
      method.className = "spazio-dropdown";
      drawDropdownOptions(method, BASE_METHODS, BASE_METHODS_TC);
      _method = method;

      const methodFormContainer = document.createElement("div");
      methodFormContainer.className = "spazio-form-container";
      _methodForm = methodFormContainer;

      wrap.append(heading, body, method, methodFormContainer);
      container.appendChild(wrap);
      styleRightPanelTree(wrap);
```

#### 2. Dropdown Options Helper (`drawDropdownOptions`)
```typescript
function drawDropdownOptions(dropdown: HTMLElement, methods: string[], textContents?: string[]) {
  methods.forEach((method, index) => {
    const methodOption = document.createElement("option");
    methodOption.className = "spazio-dropdown-options";
    methodOption.value = method;
    if (!textContents || index >= textContents.length) {
      methodOption.textContent = method;
    } else {
      methodOption.textContent = textContents[index];
    }
    dropdown.appendChild(methodOption);
  });
}
```

#### 3. Section and Label Helpers in Watershed / Delineation
```typescript
    const section = (title: string) => {
      const sec = document.createElement("div");
      sec.className = "spazio-section";
      const h3 = document.createElement("h3");
      h3.className = "spazio-title";
      h3.textContent = title;
      sec.appendChild(h3);
      wrapper.appendChild(sec);
      return sec;
    };

    const label = (text: string) => {
      const el = document.createElement("label");
      el.className = "spazio-input-label";
      el.textContent = text;
      return el;
    };
```

#### 4. Watershed Delineation Controls
- DEM File Input: `fileInput.className = "spazio-file-field";`
- Slider row: `thresholdRow.className = "spazio-wd-slider-control";`
- Threshold slider: `threshold.className = "spazio-slider";`
- Threshold number box: `thresholdNumber.className = "spazio-wd-number-input";`
- Run button: `runButton.className = "spazio-submit-button";`
- Status display: `status.className = "spazio-status";`
- Basin ID input: `basinInput.className = "spazio-text-field";`
- Clip button: `clipButton.className = "spazio-submit-button";`
- Stats grid: `statsGrid.className = "spazio-wd-stats-grid";`
- Stat items: `item.className = "spazio-wd-stat-item"; itemLabel.className = "spazio-wd-stat-label"; itemValue.className = "spazio-wd-stat-value";`

#### 5. Raster Analysis Controls (Slope, NDVI, NDWI)
- Method Select: `methodFunctionSelect.className = "spazio-dropdown";`
- Labels: `fileInputLabel.className = "spazio-input-label";`
- File Inputs: `fileInput.className = "spazio-file-field";`
- Unit Select: `unitSelect.className = "spazio-dropdown";`
- Number Inputs (ZFactor): `slopeZFactor.className = "spazio-text-field";`
- Action Buttons: `processingButton.className = "spazio-submit-button";`

#### 6. Network Analysis Controls
- Submenu Panel: `naWrap.className = "spazio-section";`
- Config Section: `naConfigSection.className = "spazio-section";`
- Section Titles: `naConfigTitle.className = "spazio-title"; naRouteTitle.className = "spazio-title";`
- Form Rows: `naLayerCountRow.className = "spazio-flex-row"; naStartRow.className = "spazio-flex-row"; naDestRow.className = "spazio-flex-row"; naSnapRow.className = "spazio-flex-row"; naObstacleRow.className = "spazio-flex-row"; naGoalRow.className = "spazio-flex-row";`
- Labels: `naLayerCountLabel.className = "spazio-input-label"; naStartLabel.className = "spazio-input-label"; naDestLabel.className = "spazio-input-label"; naSnapLabel.className = "spazio-input-label"; naObstacleLabel.className = "spazio-input-label"; naGoalLabel.className = "spazio-input-label"; naCostLabel.className = "spazio-input-label"; naBenefitLabel.className = "spazio-input-label";`
- Dropdowns: `naMethodSelect.className = "spazio-dropdown";`
- Text Inputs: `naLayerCountInput.className = "spazio-text-field"; naStartInput.className = "spazio-text-field"; naDestInput.className = "spazio-text-field"; naSnapInput.className = "spazio-text-field";`
- File Inputs: `naObstacleInput.className = "spazio-file-field"; fileInput.className = "spazio-file-field";`
- Coordinate Pick Buttons: `naPickStartBtn.className = "spazio-button"; naPickDestBtn.className = "spazio-button";`
- Radio Controls: `naRadioGroup.className = "spazio-flex-row"; naCostRadio.className = "spazio-radio"; naBenefitRadio.className = "spazio-radio";`
- Analyze Button: `naAnalyzeBtn.className = "spazio-submit-button";`
- Layer Cards & Subforms: `card.className = "spazio-layer-card"; naLayerListEl.className = "spazio-layer-list"; cb.className = "spazio-checkbox"; cbLabel.className = "spazio-check-label"; subForm.className = "spazio-layer-subform";`
- Status Display: `naStatusEl.className = "spazio-status";`

#### 7. Hazard Vulnerability Modeling & Hazard Resistance Analysis Controls
- Form Container: `form.className = "spazio-form-container";`
- Group Boxes: `group.className = "spazio-section";`
- Inputs: `input.className = "spazio-text-field";`
- File Inputs: `fileInput.className = "spazio-file-field";`
- Checkboxes: `clipCheckbox.className = "spazio-checkbox";`
- Submit Buttons: `runButton.className = "spazio-submit-button";`
- Status: `status.className = "spazio-status";`

---

### Step 4: Deprecation and Deletion of `src/lib/styles/right-panel-styles.ts`

Once Steps 1 to 3 are completed:
1. **Verify No Imports Remain**:
   Ensure zero occurrences of `from "../styles/right-panel-styles"` or `from "./styles/right-panel-styles"` remain across `src/` and `tests/`.
2. **Handle Legacy File**:
   - **Deletion**: Delete `src/lib/styles/right-panel-styles.ts`.
   - **Alternative (Transition Shim)**: If retaining temporarily before deletion, update `src/lib/styles/right-panel-styles.ts` to:
     ```typescript
     /**
      * @deprecated Use src/lib/styles/spazio-right-panel-styles instead.
      * This file is scheduled for deletion.
      */
     export * from "./spazio-right-panel-styles";
     export { applySpazioStyles as applyRightPanelStyles } from "./spazio-right-panel-styles";
     ```

---

### Step 5: Update Tests in `tests/right-panel.test.ts`

Update tests in `tests/right-panel.test.ts` to assert that all elements are initialized with the proper `spazio-*` class names:

```typescript
  it("applies Spazio registry styles and classes without replacing native controls", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);

    const root = container.querySelector(".spazio-container") as HTMLElement;
    expect(root).not.toBeNull();

    const title = root.querySelector(".spazio-title") as HTMLElement;
    expect(title).not.toBeNull();
    expect(title.textContent).toBe("Terrain & Hydrological Analysis Workbench");

    const methodSelect = root.querySelector("select.spazio-dropdown") as HTMLSelectElement;
    expect(methodSelect).toBeInstanceOf(HTMLSelectElement);
    expect(methodSelect.style.border).not.toBe("");

    const firstOption = methodSelect.querySelector("option.spazio-dropdown-options") as HTMLOptionElement;
    expect(firstOption).not.toBeNull();
    expect(firstOption.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(firstOption.style.color).toBe("rgb(0, 0, 0)");

    methodSelect.value = "Raster Analysis";
    methodSelect.dispatchEvent(new Event("change"));
    const rasterSelect = root.querySelectorAll("select")[1] as HTMLSelectElement;
    rasterSelect.value = "Slope";
    rasterSelect.dispatchEvent(new Event("change"));

    const fileInput = root.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.classList.contains("spazio-file-field")).toBe(true);
    expect(fileInput.style.border).not.toBe("");

    const actionButton = Array.from(root.querySelectorAll("button")).find(
      (button) => button.textContent === "Generate Slope",
    ) as HTMLButtonElement;

    expect(actionButton.classList.contains("spazio-submit-button")).toBe(true);
    expect(actionButton.style.border).not.toBe("");
  });
```

---

## 5. Verification Plan

### Automated Tests
Run Vitest to verify all tests pass without any dependencies on `right-panel-styles.ts`:
```bash
npx vitest run tests/right-panel.test.ts
```

### Manual Verification
1. Start the dev server:
   ```bash
   npm run serve:geolibre
   ```
2. Open GeoLibre in the browser and dock the right panel.
3. Verify:
   - Root container has `.spazio-container`.
   - Title has `.spazio-title`.
   - Method select has `.spazio-dropdown` and options have `.spazio-dropdown-options` (white background, black text).
   - In **Raster Analysis** -> **Slope**, check DEM file input has `.spazio-file-field` and button has `.spazio-submit-button`.
   - In **Watershed Delineation**, check threshold slider has `.spazio-slider`, number input has `.spazio-wd-number-input`, and "Run Analysis" has `.spazio-submit-button`.
   - In **Network Analysis**, check layer checkboxes have `.spazio-checkbox`, coordinate inputs have `.spazio-text-field`, pick buttons have `.spazio-button`, and "Find Optimal Route" has `.spazio-submit-button`.
4. Verify deleting `src/lib/styles/right-panel-styles.ts` causes zero build or test failures.

---

## 6. Delegation Guidance for Junior Developer / Cheap AI Agent

- Direct initialization of `className` using `spazio-*` is mandatory across `src/lib/geolibre/right-panel.ts`.
- `src/lib/styles/spazio-right-panel-styles.ts` is the single source of truth and must NOT contain legacy class names (e.g. `na-layer-card`, `wd-slider-control`).
- Ensure all imports across the repository target `spazio-right-panel-styles.ts` so `right-panel-styles.ts` can be safely deleted.
- Do not alter underlying event handlers, calculations, or host API calls (`_app.addCogLayer`, `_app.addGeoJsonLayer`, etc.).
