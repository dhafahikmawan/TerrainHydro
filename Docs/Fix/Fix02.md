### Fix and Update List 02

### Problems
1. The watershed delineation slider overlaps with the stream threshold input, making it difficult or impossible to use.
2. The `Run Analysis` button stays disabled even after a valid DEM has already been uploaded.
3. When the button is force-enabled in the browser, clicking it throws `Failed to construct 'URL': Invalid URL` during the analysis startup path.

### Additional Notes
- The disabled-button issue is caused by the upload-change handler setting the button state before the async DEM load finishes.
- The invalid-URL issue is caused by the worker startup path constructing a URL from a value that is not valid in this runtime/build context, likely around `new URL(..., import.meta.url)`.
- The fix should remain limited to the watershed UI and worker bootstrap path; no large refactor of the delineation algorithm is required unless a later check proves the problem is deeper than the startup sequence.
