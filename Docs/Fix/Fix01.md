### Fix and Update List 01

1. Currently, the network analysis' find optimal route form is shown by default, it should be hidden by default and only be shown when `Find Optimal Route` is selected in the select.
2. For some reason, during testing network analysis (using the sample data in `/Docs/Sample/Data`), I tried to generate a path with no obstacle, which works fine, but when I add the obstacle (The starting and destination point is definitely outside the obstacle), it either:
    - returns an error : `Error: coordinates must contain numbers`.
    - The snapped point(s) location is not the nearest possible point the paths, which is different than the snapped points without an obstacle