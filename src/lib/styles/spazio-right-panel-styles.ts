export type RightPanelStyle = Partial<CSSStyleDeclaration>;

export const RIGHT_PANEL_STYLES: Record<string, RightPanelStyle> = {
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
  "spazio-title": { margin: "0", color: "#0f172a", fontSize: "16px", fontWeight: "600" },
  "spazio-description": { margin: "0", color: "#475569", fontSize: "12px", lineHeight: "1.4" },
  "spazio-text": { color: "#334155", fontSize: "13px" },
  "spazio-form-container": { display: "flex", flexDirection: "column", gap: "10px" },
  "spazio-section": { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" },
  "spazio-flex-row": { display: "flex", gap: "8px", alignItems: "center" },
  "spazio-flex-col": { display: "flex", flexDirection: "column", gap: "8px" },
  "spazio-divider": { height: "1px", margin: "12px 0", backgroundColor: "#d1d5db" },
  "spazio-input-label": { display: "block", marginBottom: "4px", color: "#374151", fontSize: "12px", fontWeight: "500" },
  "spazio-input-description": { color: "#6b7280", fontSize: "12px", lineHeight: "1.4" },
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
  "spazio-dropdown-options": { backgroundColor: "#ffffff", color: "#000000" },
  "spazio-slider": { width: "100%", accentColor: "#1d4ed8", flex: "1 1 auto", minWidth: "0" },
  "spazio-checkbox": { width: "16px", height: "16px", accentColor: "#1d4ed8", cursor: "pointer" },
  "spazio-radio": { accentColor: "#1d4ed8", cursor: "pointer" },
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
    padding: "8px 14px",
    border: "1px solid #6b7280",
    borderRadius: "4px",
    backgroundColor: "#4b5563",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  "spazio-status": { color: "#4b5563", fontSize: "12px", overflowWrap: "break-word" },
  "spazio-status-success": { color: "#15803d" },
  "spazio-status-error": { color: "#dc2626" },
  "spazio-layer-list": { display: "flex", flexDirection: "column", gap: "6px" },
  "spazio-layer-card": { boxSizing: "border-box", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#f9fafb", boxShadow: "0 1px 2px rgba(17, 24, 39, 0.08)" },
  "spazio-check-label": { overflow: "hidden", color: "#111827", fontSize: "12px", fontWeight: "500", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" },
  "spazio-layer-subform": { display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #d1d5db" },
  "spazio-wd-slider-control": { display: "flex", gap: "8px", alignItems: "center", width: "100%", boxSizing: "border-box" },
  "spazio-wd-number-input": { boxSizing: "border-box", width: "82px", minWidth: "82px", maxWidth: "82px", minHeight: "36px", padding: "6px 8px", border: "1px solid #b8c1cc", borderRadius: "4px", outline: "none", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", textAlign: "right", flex: "0 0 82px" },
  "spazio-wd-stats-grid": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  "spazio-wd-stat-item": { padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#f9fafb" },
  "spazio-wd-stat-label": { display: "block", color: "#6b7280", fontSize: "11px" },
  "spazio-wd-stat-value": { display: "block", color: "#111827", fontSize: "14px", fontWeight: "600" },
  "spazio-wd-progress": { padding: "8px", backgroundColor: "#eff6ff", color: "#1e3a8a", fontSize: "12px" },
  "spazio-output": { color: "#0f172a", fontWeight: "600" },
  "spazio-legend": { padding: "0 4px", color: "#334155", fontWeight: "600" },
  "spazio-hidden": { display: "none" },
  "spazio-visible-flex": { display: "flex" },
  "spazio-visible-grid": { display: "grid" },
  "right-panel": { ...({} as RightPanelStyle) },
  "right-panel-form": { ...({} as RightPanelStyle) },
  "right-panel-flex": { ...({} as RightPanelStyle) },
  "right-panel-flex-column": { ...({} as RightPanelStyle) },
  "right-panel-section": { ...({} as RightPanelStyle) },
  "right-panel-heading": { ...({} as RightPanelStyle) },
  "right-panel-label": { ...({} as RightPanelStyle) },
  "right-panel-control": { ...({} as RightPanelStyle) },
  "right-panel-select": { ...({} as RightPanelStyle) },
  "right-panel-option": { ...({} as RightPanelStyle) },
  "right-panel-button": { ...({} as RightPanelStyle) },
  "right-panel-button-secondary": { ...({} as RightPanelStyle) },
  "right-panel-status": { ...({} as RightPanelStyle) },
  "right-panel-status-success": { ...({} as RightPanelStyle) },
  "right-panel-status-error": { ...({} as RightPanelStyle) },
  "right-panel-help": { ...({} as RightPanelStyle) },
  "right-panel-checkbox": { ...({} as RightPanelStyle) },
  "right-panel-layer-list": { ...({} as RightPanelStyle) },
  "right-panel-layer-card": { ...({} as RightPanelStyle) },
  "right-panel-check-label": { ...({} as RightPanelStyle) },
  "right-panel-layer-subform": { ...({} as RightPanelStyle) },
  "right-panel-divider": { ...({} as RightPanelStyle) },
  "wd-badge": { display: "inline-block", padding: "3px 8px", borderRadius: "999px", backgroundColor: "#e5e7eb", color: "#374151", fontSize: "11px", fontWeight: "600" },
  "wd-badge--ok": { backgroundColor: "#dcfce7", color: "#166534" },
  "wd-badge--error": { backgroundColor: "#fee2e2", color: "#991b1b" },
  "wd-badge--running": { backgroundColor: "#dbeafe", color: "#1e40af" },
  "wd-slider-control": { display: "flex", gap: "8px", alignItems: "center", width: "100%", boxSizing: "border-box" },
  "wd-slider": { flex: "1 1 auto", minWidth: "0" },
  "wd-number-input": { boxSizing: "border-box", width: "82px", minWidth: "82px", maxWidth: "82px", minHeight: "36px", padding: "6px 8px", border: "1px solid #b8c1cc", borderRadius: "4px", outline: "none", backgroundColor: "#ffffff", color: "#111827", fontSize: "13px", textAlign: "right", flex: "0 0 82px" },
  "wd-stats-grid": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  "wd-stat-item": { padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px", backgroundColor: "#f9fafb" },
  "wd-stat-label": { display: "block", color: "#6b7280", fontSize: "11px" },
  "wd-stat-value": { display: "block", color: "#111827", fontSize: "14px", fontWeight: "600" },
  "wd-progress": { padding: "8px", backgroundColor: "#eff6ff", color: "#1e3a8a", fontSize: "12px" },
};

const LEGACY_CLASS_MAP: Record<string, string> = {
  "right-panel": "spazio-container",
  "right-panel-form": "spazio-form-container",
  "right-panel-flex": "spazio-flex-row",
  "right-panel-flex-column": "spazio-flex-col",
  "right-panel-section": "spazio-section",
  "right-panel-heading": "spazio-title",
  "right-panel-label": "spazio-input-label",
  "right-panel-control": "spazio-text-field",
  "right-panel-select": "spazio-dropdown",
  "right-panel-option": "spazio-dropdown-options",
  "right-panel-button": "spazio-submit-button",
  "right-panel-button-secondary": "spazio-button",
  "right-panel-status": "spazio-status",
  "right-panel-status-success": "spazio-status-success",
  "right-panel-status-error": "spazio-status-error",
  "right-panel-help": "spazio-input-description",
  "right-panel-checkbox": "spazio-checkbox",
  "right-panel-layer-list": "spazio-layer-list",
  "right-panel-layer-card": "spazio-layer-card",
  "right-panel-check-label": "spazio-check-label",
  "right-panel-layer-subform": "spazio-layer-subform",
  "right-panel-divider": "spazio-divider",
  "wd-slider-control": "spazio-wd-slider-control",
  "wd-slider": "spazio-slider",
  "wd-number-input": "spazio-wd-number-input",
  "wd-stats-grid": "spazio-wd-stats-grid",
  "wd-stat-item": "spazio-wd-stat-item",
  "wd-stat-label": "spazio-wd-stat-label",
  "wd-stat-value": "spazio-wd-stat-value",
  "wd-progress": "spazio-wd-progress",
  "wd-badge": "spazio-wd-badge",
  "wd-badge--ok": "spazio-wd-badge-ok",
  "wd-badge--error": "spazio-wd-badge-error",
  "wd-badge--running": "spazio-wd-badge-running",
  "geolibre-plugin-right-panel": "spazio-container",
  "na-section": "spazio-section",
  "na-form-row": "spazio-flex-row",
  "na-check-row": "spazio-flex-row",
  "na-radio-group": "spazio-flex-row",
  "na-section-title": "spazio-title",
  "na-label": "spazio-input-label",
  "na-input": "spazio-text-field",
  "na-input--small": "spazio-text-field",
  "na-select": "spazio-dropdown",
  "na-checkbox": "spazio-checkbox",
  "na-radio": "spazio-radio",
  "na-status": "spazio-status",
  "na-status--error": "spazio-status-error",
  "na-status--success": "spazio-status-success",
  "plugin-control-form": "spazio-form-container",
  "plugin-control-group": "spazio-section",
  "plugin-control-flex": "spazio-flex-row",
  "plugin-control-flex-col": "spazio-flex-col",
  "plugin-control-label": "spazio-input-label",
  "plugin-control-help": "spazio-input-description",
  "plugin-control-input": "spazio-text-field",
  "plugin-control-button": "spazio-submit-button",
  "plugin-control-button-secondary": "spazio-button",
  "plugin-control-status": "spazio-status",
  "geoprocessing-method-select": "spazio-dropdown",
  "geoprocessing-method-option": "spazio-dropdown-options",
  "geoprocessing-form": "spazio-form-container",
  "geoprocessing-status": "spazio-status",
  "spatio-file-input": "spazio-file-field",
  "spatio-action-button": "spazio-submit-button",
  "spatio-button": "spazio-button",
  "na-layer-list": "spazio-layer-list",
  "na-layer-card": "spazio-layer-card",
  "na-check-label": "spazio-check-label",
  "na-layer-subform": "spazio-layer-subform",
  "na-pick-btn": "spazio-button",
  "na-pick-btn--active": "spazio-submit-button",
  "na-file-status": "spazio-input-description",
};

function addMatchingClasses(element: Element, isRoot = false): string[] {
  const matches = new Set<string>();
  const classes = Array.from(element.classList);
  const tagName = element.tagName.toLowerCase();

  if (isRoot || classes.includes("geolibre-plugin-right-panel") || classes.includes("right-panel")) {
    matches.add("spazio-container");
  }
  if (tagName === "form" || classes.includes("plugin-control-form") || classes.includes("geoprocessing-form") || classes.includes("na-section")) {
    matches.add("spazio-form-container");
  }
  if (tagName === "h1" || tagName === "h2" || tagName === "h3" || classes.includes("na-section-title")) {
    matches.add("spazio-title");
  }
  if (tagName === "label" || classes.includes("plugin-control-label") || classes.includes("na-label")) {
    matches.add("spazio-input-label");
  }
  if (tagName === "select") {
    matches.add("spazio-dropdown");
  } else if (tagName === "option") {
    matches.add("spazio-dropdown-options");
  } else if (tagName === "input") {
    const input = element as HTMLInputElement;
    if (input.type === "range" || classes.includes("wd-slider")) {
      matches.add("spazio-slider");
    } else if (input.type === "checkbox" || input.type === "radio") {
      matches.add(input.type === "checkbox" ? "spazio-checkbox" : "spazio-radio");
    } else if (classes.includes("wd-number-input")) {
      matches.add("spazio-wd-number-input");
    } else if (classes.includes("na-file-input") || classes.includes("spatio-file-input") || classes.includes("plugin-control-input")) {
      matches.add("spazio-file-field");
    } else {
      matches.add("spazio-text-field");
    }
  } else if (tagName === "button") {
    matches.add("spazio-submit-button");
    if (classes.includes("na-btn--secondary") || classes.includes("plugin-control-button-secondary") || classes.includes("na-pick-btn")) {
      matches.add("spazio-button");
    }
  }
  if (classes.includes("plugin-control-flex") || classes.includes("na-form-row") || classes.includes("na-check-row") || classes.includes("na-radio-group")) {
    matches.add("spazio-flex-row");
  }
  if (classes.includes("na-layer-list")) {
    matches.add("spazio-layer-list");
  }
  if (classes.includes("na-layer-card")) {
    matches.add("spazio-layer-card");
  }
  if (classes.includes("na-check-label")) {
    matches.add("spazio-check-label");
  }
  if (classes.includes("na-layer-subform")) {
    matches.add("spazio-layer-subform");
  }
  if (classes.includes("plugin-control-help") || classes.includes("na-file-status")) {
    matches.add("spazio-input-description");
  }
  if (classes.includes("wd-slider-control")) {
    matches.add("spazio-wd-slider-control");
  }
  if (classes.some((className) => className.includes("status"))) {
    matches.add("spazio-status");
  }
  for (const className of classes) {
    const mapped = LEGACY_CLASS_MAP[className];
    if (mapped) matches.add(mapped);
  }

  return [...matches];
}

export function applySpazioStyles(element: HTMLElement | SVGElement, ...classNames: string[]): void {
  for (const className of classNames) {
    const name = className.trim();
    if (!name) continue;
    const style = RIGHT_PANEL_STYLES[name] ?? RIGHT_PANEL_STYLES[LEGACY_CLASS_MAP[name] ?? name];
    if (style) Object.assign(element.style, style);
    if (name.startsWith("spazio-") || name.startsWith("wd-") || name.startsWith("na-") || name.startsWith("plugin-control-") || name.startsWith("geoprocessing-") || name.startsWith("spatio-")) {
      element.classList.add(name);
    }
  }
}

export const applyRightPanelStyles = applySpazioStyles;

export function styleRightPanelTree(root: HTMLElement): void {
  applySpazioStyles(root, ...addMatchingClasses(root, true));
  root.querySelectorAll<HTMLElement | SVGElement>("*").forEach((element) => {
    applySpazioStyles(element, ...addMatchingClasses(element));
  });
}

export type RightPanelStyleName = keyof typeof RIGHT_PANEL_STYLES;

export function applyRightPanelStyle(element: HTMLElement, styleName: RightPanelStyleName): void {
  const styles = RIGHT_PANEL_STYLES[styleName];
  if (styles) Object.assign(element.style, styles);
  const className = LEGACY_CLASS_MAP[styleName] ?? styleName;
  if (className.startsWith("spazio-")) element.classList.add(className);
}
