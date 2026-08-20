export type RightPanelStyle = Partial<CSSStyleDeclaration>;

export const RIGHT_PANEL_STYLES: Record<string, RightPanelStyle> = {
  "right-panel-element": {
    boxSizing: "border-box",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  "right-panel": {
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
    lineHeight: "1.4",
  },
  "right-panel-form": {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  "right-panel-flex": {
    display: "flex",
    gap: "8px",
  },
  "right-panel-flex-column": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  "right-panel-section": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "12px",
  },
  "right-panel-heading": {
    margin: "0",
    color: "#111827",
    fontSize: "16px",
    fontWeight: "600",
  },
  "right-panel-label": {
    display: "block",
    marginBottom: "4px",
    color: "#374151",
    fontSize: "12px",
    fontWeight: "500",
  },
  "right-panel-control": {
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
  },
  "right-panel-select": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
  },
  "right-panel-option": {
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  "right-panel-button": {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  "right-panel-button-secondary": {
    borderColor: "#6b7280",
    backgroundColor: "#4b5563",
  },
  "right-panel-status": {
    color: "#4b5563",
    fontSize: "12px",
    overflowWrap: "break-word",
  },
  "right-panel-status-success": {
    color: "#15803d",
  },
  "right-panel-status-error": {
    color: "#dc2626",
  },
  "right-panel-help": {
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: "1.4",
  },
  "right-panel-checkbox": {
    width: "16px",
    height: "16px",
    accentColor: "#2563eb",
  },
  "right-panel-layer-list": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  "right-panel-layer-card": {
    boxSizing: "border-box",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    backgroundColor: "#f9fafb",
    boxShadow: "0 1px 2px rgba(17, 24, 39, 0.08)",
  },
  "right-panel-check-label": {
    overflow: "hidden",
    color: "#111827",
    fontSize: "12px",
    fontWeight: "500",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  },
  "right-panel-layer-subform": {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid #d1d5db",
  },
  "right-panel-divider": {
    height: "1px",
    margin: "12px 0",
    backgroundColor: "#d1d5db",
  },
};

export function applyRightPanelStyles(
  element: HTMLElement | SVGElement,
  ...classNames: string[]
): void {
  for (const className of classNames) {
    const style = RIGHT_PANEL_STYLES[className];
    if (style) Object.assign(element.style, style);
  }
}

function getRightPanelStyleRoles(element: Element, isRoot: boolean): string[] {
  const roles = ["right-panel-element"];
  const classNames = Array.from(element.classList);
  const tagName = element.tagName.toLowerCase();

  if (isRoot || classNames.includes("geolibre-plugin-right-panel")) {
    roles.push("right-panel");
  }
  if (tagName === "form" || classNames.includes("plugin-control-form") || classNames.includes("geoprocessing-form")) {
    roles.push("right-panel-form");
  }
  if (tagName === "h1" || tagName === "h2" || tagName === "h3" || classNames.includes("na-section-title")) {
    roles.push("right-panel-heading");
  }
  if (tagName === "label" || classNames.includes("plugin-control-label") || classNames.includes("na-label")) {
    roles.push("right-panel-label");
  }
  if (tagName === "select") {
    roles.push("right-panel-select");
  } else if (tagName === "option") {
    roles.push("right-panel-option");
  } else if (tagName === "input") {
    const input = element as HTMLInputElement;
    if (input.type === "checkbox" || input.type === "radio") {
      roles.push("right-panel-checkbox");
    } else {
      roles.push("right-panel-control");
    }
  } else if (tagName === "button") {
    roles.push("right-panel-button");
    if (classNames.includes("na-btn--secondary") || classNames.includes("plugin-control-button-secondary")) {
      roles.push("right-panel-button-secondary");
    }
  }
  if (
    classNames.includes("plugin-control-flex") ||
    classNames.includes("na-form-row") ||
    classNames.includes("na-check-row") ||
    classNames.includes("na-radio-group")
  ) {
    roles.push("right-panel-flex");
  }
  if (classNames.includes("na-layer-list")) {
    roles.push("right-panel-layer-list");
  }
  if (classNames.includes("na-layer-card")) {
    roles.push("right-panel-layer-card");
  }
  if (classNames.includes("na-check-label")) {
    roles.push("right-panel-check-label");
  }
  if (classNames.includes("na-layer-subform")) {
    roles.push("right-panel-layer-subform");
  }
  if (
    classNames.includes("plugin-control-flex-col") ||
    classNames.includes("network-analysis-panel") ||
    classNames.includes("na-section")
  ) {
    roles.push("right-panel-flex-column");
  }
  if (classNames.includes("plugin-control-group") || classNames.includes("na-actions")) {
    roles.push("right-panel-section");
  }
  if (
    classNames.some((className) => className.includes("status")) ||
    classNames.includes("plugin-control-status") ||
    classNames.includes("geoprocessing-status")
  ) {
    roles.push("right-panel-status");
  }
  if (classNames.includes("plugin-control-help")) {
    roles.push("right-panel-help");
  }

  return roles;
}

export function styleRightPanelTree(root: HTMLElement): void {
  applyRightPanelStyles(root, ...getRightPanelStyleRoles(root, true));
  root.querySelectorAll<HTMLElement | SVGElement>("*").forEach((element) => {
    applyRightPanelStyles(element, ...getRightPanelStyleRoles(element, false));
  });
}
