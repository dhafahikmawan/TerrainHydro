# Right Panel Styling Implementation Plan

This plan implements the requirements in [`Docs/Fix/Styling.md`](../Fix/Styling.md). It is intentionally explicit so a junior developer or a low-cost AI agent can complete the work without needing to infer the panel architecture.

## Objective

Make the GeoLibre right panel readable and consistent by moving its styles into a TypeScript registry at [`src/lib/styles/right-panel-styles.ts`](../../src/lib/styles/right-panel-styles.ts), then applying those registered styles to every element created by [`src/lib/geolibre/right-panel.ts`](../../src/lib/geolibre/right-panel.ts).

The implementation must preserve the current UI behavior and HTML control types. A `select` must remain a `select`, a file input must remain a file input, and a range/number input must not be replaced with another control.

## Current State and Root Cause

The right panel currently uses several styling approaches at once:

- Local class names such as `na-input`, `spatio-file-input`, and `spatio-action-button`.
- Shared `plugin-control.css` classes such as `plugin-control-input`, `plugin-control-button`, `plugin-control-flex`, and `plugin-control-group`.
- Inline styles for visibility, status colors, spacing, and layout.
- Some elements are created without any class or style, including several `select` and `input` elements.

This makes the panel look inconsistent and leaves important controls without guaranteed borders or readable option colors. The fix is to make the TypeScript registry the source of truth for right-panel presentation, while keeping event handlers, form values, and analysis logic unchanged.

## Scope

### In Scope

- Add `src/lib/styles/right-panel-styles.ts`.
- Add a typed registry of class-name/style pairs.
- Add a small helper for applying one or more registered styles to an element.
- Update all UI construction paths in `src/lib/geolibre/right-panel.ts` to use the registry.
- Port the relevant styling currently inherited from `plugin-control.css`.
- Add or update right-panel tests for style application and required control types.

### Out of Scope

- Changing raster, network, terrain, or hydrology analysis behavior.
- Replacing DOM controls with custom components.
- Redesigning `PluginControl.ts` or the floating/toolbar panels.
- Removing `plugin-control.css` from the package if it is still used by other components.
- Adding a new UI framework or styling dependency.

## Constraints

1. Use plain TypeScript and the existing DOM APIs.
2. Keep the registry local to the right-panel styling concern.
3. Do not duplicate a large CSS parser or introduce a CSS-in-JS dependency.
4. Do not rely on browser default styles for selects, options, inputs, or buttons.
5. Preserve existing classes where they are useful for selectors and tests, but ensure their visual styles come from the registry.
6. Keep dynamic behavior such as `display: none`, disabled state, active picking state, and success/error status updates working.

## Proposed Registry Contract

Create `src/lib/styles/right-panel-styles.ts` with a simple exported type and registry. Use the class name as the registry key and store a `CSSStyleDeclaration`-compatible object as the value.

Recommended shape:

```ts
export type RightPanelStyle = Partial<CSSStyleDeclaration>;

export const RIGHT_PANEL_STYLES: Record<string, RightPanelStyle> = {
  "right-panel": {
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    color: "#111827",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    border: "1px solid #d1d5db",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.12)",
  },
  "right-panel-control": {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  "right-panel-option": {
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  "right-panel-button": {
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
  },
};

export function applyRightPanelStyles(
  element: HTMLElement,
  ...classNames: string[]
): void {
  for (const className of classNames) {
    const style = RIGHT_PANEL_STYLES[className];
    if (style) Object.assign(element.style, style);
  }
}
```

The exact colors may be adjusted during implementation, but the registry must explicitly provide visible borders, white select/option backgrounds, dark option text, and bordered buttons.

## Implementation Steps

### Phase 1: Inventory the Existing Right-Panel UI

Before editing behavior, inspect every `document.createElement` call in `right-panel.ts` and make a table of:

- Element type (`div`, `select`, `option`, `input`, `button`, `label`, etc.).
- Existing class name(s).
- Existing inline styles.
- Whether the element is created once or rebuilt dynamically.
- Whether its style changes after creation.

The inventory must include all branches of `loadMethodForm`:

- Base method and raster-analysis selectors.
- Network analysis controls and dynamically rebuilt layer/file rows.
- Slope, NDVI, and NDWI controls.
- Hazard Vulnerability Modeling controls.
- Hazard Resistance Analysis controls.

Do not skip dynamically created options or controls in helper functions such as `drawDropdownOptions`, `naBuildAttrDropdown`, `naBuildLayerSubForm`, and `naRebuildFileInputs`.

### Phase 2: Create the Registry and Helper

1. Add `src/lib/styles/right-panel-styles.ts`.
2. Define named registry entries for the repeated visual roles. At minimum include:
   - Panel/container.
   - Form and vertical/horizontal layout wrappers.
   - Heading and label text.
   - Standard control/input.
   - Select control.
   - Option.
   - File input.
   - Primary button.
   - Secondary/disabled button.
   - Status text, success status, and error status.
   - Network-analysis rows/cards/checklists where their existing classes represent distinct layout roles.
3. Export `applyRightPanelStyles`.
4. Make the helper tolerant of an unknown class name. It should not throw when a class has no registry entry because this keeps incremental migration safe.
5. Keep the registry in TypeScript; do not move these right-panel rules back into a CSS file.

### Phase 3: Apply Styles in `right-panel.ts`

Import the helper and registry from `right-panel-styles.ts`. For each created element:

1. Keep the existing `className` when it identifies the element or is used by behavior/tests.
2. Apply the matching registry style immediately after creating the element.
3. For repeated controls, use the same registry role rather than copying a separate style object.
4. Apply the option style to every `option` created by `drawDropdownOptions` and by the network/Hazard Vulnerability Modeling attribute lists.
5. Apply the control style to every `select`, text/number/file input, and other user-editable field.
6. Apply the button style to Processing, Generate, Load, Buffer, Analyze, Pick, Download, and other action buttons.
7. Apply layout styles to wrappers and forms so the panel has consistent spacing and controls use the available width.

Use a small local helper if needed, for example `styleElement(element, "right-panel-control")`, but do not create a second style registry inside `right-panel.ts`.

### Required Control Coverage

The implementation is incomplete unless these cases are covered:

- The top-level panel body has a near-white background, dark text, padding, box sizing, and a neutral border or shadow.
- All dropdowns have a visible border.
- All dropdown options explicitly use a white background and black text.
- All text, number, and file input fields have a visible border.
- Processing and file-upload buttons have a visible border and readable contrast.
- Network-analysis dynamically generated selects, inputs, checkboxes, file inputs, and buttons receive styles too.
- Hazard Vulnerability Modeling and Hazard Resistance Analysis controls receive styles even when they currently use `plugin-control.css` class names.

### Phase 4: Port Relevant `plugin-control.css` Rules

Use the current stylesheet as the source for behavior that must be retained, especially:

- `plugin-control-flex` and `plugin-control-flex-col` layout behavior.
- `plugin-control-group` spacing.
- `plugin-control-label` typography.
- `plugin-control-input` sizing, padding, border, focus appearance, and background/text colors.
- `plugin-control-button` sizing, contrast, focus, hover, and disabled behavior.
- `plugin-control-status` and help/status presentation.

Port only rules used by `right-panel.ts`. Do not blindly copy styles for `PluginControl.ts`, its toggle button, or the floating panel. If the right-panel code still needs CSS pseudo-classes such as `:hover` or `:focus`, represent the default style in the registry and add explicit event-based state handling only when necessary and easy to maintain. Do not remove the shared CSS import until a search confirms that no remaining component needs it.

### Phase 5: Handle Dynamic State Without Breaking Behavior

Keep behavior-changing inline assignments where they represent runtime state, but make their visual defaults registry-driven:

- `display: none` / visible toggles for hidden forms, statuses, and download buttons remain controlled by event logic.
- Disabled buttons may use a registered disabled style when the disabled state changes.
- Success/error status colors should use registered success/error styles, or a registry-backed helper, instead of hard-coded colors.
- Map canvas cursor changes are interaction behavior and should remain unchanged.
- Preserve all existing event listeners, input values, file acceptance strings, IDs, and analysis calls.

Do not accidentally assign the style for a wrapper to its child or overwrite dynamic state after an event changes it.

### Phase 6: Add Focused Tests

Extend `tests/right-panel.test.ts` or add a small styling-focused test file.

Minimum tests:

1. Rendering the right panel creates the expected existing controls.
2. A rendered `select` remains an `HTMLSelectElement` and has a non-empty border style.
3. A rendered option has `backgroundColor === "#ffffff"` and `color === "#000000"`.
4. A rendered file input remains `HTMLInputElement` with `type === "file"` and has a non-empty border style.
5. A rendered action button remains `HTMLButtonElement` and has a non-empty border style.
6. Re-rendering a method form does not throw and still replaces the previous form contents.
7. Existing right-panel registration, open, close, unregister, and cleanup tests continue to pass.

Prefer querying the rendered DOM by element type, class, ID, or button text. Avoid snapshot tests because the panel intentionally rebuilds parts of the DOM.

### Phase 7: Validate and Review

Run the checks in this order:

```powershell
npm run test -- tests/right-panel.test.ts
npm run lint
npm run build:lib
npm run test
```

If the repository's Vitest CLI does not accept the test path after `--`, run `npx vitest --run tests/right-panel.test.ts` instead.

Then perform a manual browser check:

1. Open the plugin in the GeoLibre host.
2. Open each right-panel method branch.
3. Confirm the panel remains readable and controls fit within its width.
4. Open every dropdown and confirm its options are legible.
5. Confirm file inputs and Processing/Generate/Load/Analyze buttons have visible borders.
6. Confirm Network Analysis dynamic rows and both hazard-analysis forms receive the same treatment.
7. Confirm selecting methods, uploading files, changing bands, toggling checkboxes, hiding statuses, and downloading a route still work.

## Acceptance Criteria

The work is complete when:

- `src/lib/styles/right-panel-styles.ts` exists and exports the registry and application helper.
- Every element created in `src/lib/geolibre/right-panel.ts` has a registry style role or is explicitly documented as behavior-only/non-visual.
- Dropdowns, options, inputs, file inputs, and action buttons satisfy the required border and color rules.
- Relevant styling previously supplied by `plugin-control.css` is represented in the registry for right-panel elements.
- No control type, event handler, analysis call, file acceptance rule, or panel lifecycle behavior changes.
- Focused tests, lint, build, and the full test suite pass.
- Manual inspection shows a consistent, usable right panel across all method branches.

## Common Mistakes to Avoid

- Styling only the initial panel and forgetting dynamically rebuilt network controls.
- Adding a border to the `select` but not to its `option` elements.
- Styling only `spatio-file-input` and missing file inputs that use `plugin-control-input` or no class.
- Replacing a native select or file input with a button or custom element.
- Leaving the old `plugin-control-*` classes in place without porting their visual rules.
- Overwriting runtime `display` or disabled-state changes when applying a style during a rebuild.
- Changing analysis logic while refactoring the UI construction code.