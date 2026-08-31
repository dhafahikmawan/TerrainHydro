### Geolibre Plugin - Watershed Delineation Function

We want to pretty much copy the watershed delineation function in the already implemented plugin in `/Docs/Samples/Existing Working Plugin Reference/WatershedDelineation/` to our plugin, following our plugin's architecture. Copy only the right panel ui and the functionality, no need to copy the plugin control behavior. Additionally, Make it so that the download functionally is enabled and disabled by a developer variable in `/src/lib/geolibre/right-panel.ts`.


### Architecture in this plugin
- in `/src/lib/geolibre/right-panel.ts`, the form is loaded if the selected method is `"Watershed Delineation"`, draw the form accordingly, mimicking how the current `"Raster Analysis"` method form is processed.
- Just like the `"Raster Analysis"` workflow, the processing should be done in its respective file, for watershed delineation, it is in `/src/lib/tha/watershed-delineation.ts`, it will return the output files that will be then be loaded by `/src/lib/geolibre/right-panel.ts` using the `addGeoJsonLayer`, `addCogLayer` plugin api.
- `"Raster Analysis"` workflow is a great reference to how this plugin is supposed to be written. Especially pay close attention to how the `select`'s `option`s are being written.
- Match the styles of the generated HTML element to this plugin's style registry if the same type exists (e.g, dropdowns, labels, buttons, ...). If it doesn't exist, (e.g, sliders) make sure to register it in the style registry, and call the style through the registry. Any syncing behavior (e.g, syncing slider with number input) should also be ported.
