### Geolibre Plugin - Geotiff Processing utilities

- This plugin should be capable of reading and writing a geotiff file and generate a blob for the written file, that will later be loaded to GeoLibre through addCogLayer api. 
- The functions to read and write the geotiffs should be written in /src/lib/utils/geotiff-processor.ts for later to be extracted by other files for manipulation. 
- GeoLibre unfortunately have some restrictions about loadable geotiff, so make sure to use /Docs/Analysis/StripedHandling.md as a strong reference, because it documents a successful attempt at writing a geotiff file to be loaded to geolibre. 
- For testing, currently there is a pretty much empty slope function in /src/lib/tha/raster-analysis.ts. make the function returns a tiled geotiff from the input file. 
    - It doesn't matter whether the input file is already tiled or not, the function must read the geotiff and write its own tiled geotiff.