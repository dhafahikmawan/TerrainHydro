### Geolibre Plugin - Network Analysis Function

We want to pretty much copy the network analysis function in the already implemented plugin in `/Docs/Samples/Existing Working Plugin Reference/Network Analysis/` to our plugin, following our plugin's architecture. Copy only the right panel ui and the functionality, no need to copy the plugin control behavior. Additionally, Make it so that the download functionally is enabled and disabled by a developer variable in `/src/lib/geolibre/right-panel.ts`.


### Architecture in this plugin
- in `/src/lib/geolibre/right-panel.ts`, the form is loaded if the selected method is `"Network Analysis"`, draw the form accordingly, mimicking how the current `"Raster Analysis"` method form is processed.
- Just like the `"Raster Analysis"` workflow, the processing should be done in its respective file, fot network analysis, it is in `/src/lib/tha/network-analysis.ts`, it will return the vector files that will be then be loaded by `/src/lib/geolibre/right-panel.ts` using the `addGeoJsonLayer` plugin api.
- `"Raster Analysis"`workflow is a great reference to how this plugin is supposed to be written. Especially pay close attention to how the `select`'s `option`s are being written.
