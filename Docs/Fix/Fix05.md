### Fix and Update List 05

### Update
1. Update how the plugin is styled, and how the styling is indexed. There is already an existing style registry in `src/lib/styles/spazio-right-panel-styles.ts`. We are going to use that style registry instead, with these class name rules:
    - For the dropdowns, `spazio-dropdown`.
    - For the dropdown options, `spazio-dropdown-options`.
    - For the calculator expression fields (if any), `spazio-expression-field`.
    - For the calculator buttons (if any), `spazio-calculator-button`.
    - For the input text/numeric fields, `spazio-text-field`.
    - For the input file fields, `spazio-file-field`.
    - For checkboxes (if any), `spazio-checkbox`.
    - For the sliders (if any), `spazio-slider`.
    - For the labels of the fields, dropdowns, checkboxes, sliders (basically input fields), `spazio-input-label`.
    - Input field descriptions (if any): `spazio-input-description`.
    - For AHP table (if any), `spazio-ahp-table`.
    - For AHP table fields (if any), `spazio-ahp-field`.
    - For AHP table Raster Indexes (e.g, Raster 1, Raster 2, ... (basically row 1 and col 1)) (if any), `spazio-ahp-headers`.
    - For status fields, `spazio-status`.
    - For the main container, `spazio-container`.
    - For the submit/processing buttons, `spazio-submit-button`.
    - For other buttons, `spazio-button`.
    - For the title of the plugin (`heading` variable in right panel), `spazio-title`.
    - For the description of the plugin (`body` variable in right panel, currently empty), `spazio-description`.
    - For anything else, check if there is already a suitable class in the registry. If not, create a new class in the registry and port the old styles, make sure that the class name if prefixed with `spazio-` properly.
