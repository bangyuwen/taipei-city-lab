## verdict

Capture check passes. Reopened all 36 exact required paths from the initial review, including every captured 1440/390/320 width and all named interaction states. No capture is missing, blank, blocked, or mismatched to its state. All PNG and seven runtime hashes match the current `results.json`; page errors are empty. Fresh bins angle/scope evidence is used as recorded. `finish-review.md` remains the full initial review; no second detector or new full audit was performed.

1. **Resolved — 3D point hierarchy and selection.** In `desktop/mobile/narrow-bins-angle.png`, `*-bins-top.png`, and `*-bins-reset.png`, white-edged deep-green existing points and larger amber recommendations now separate clearly from OSM streets and the translucent range layer. Matching colour keys identify those roles beside the layer controls. In all three `*-bins-focus.png` files, the vermilion ring makes the selected candidate unmistakable; that same selected location remains visibly ringed in the top/reset views. The pan/zoom and workspace captures retain legible point marks and readable, contained controls. The supplied implementation supports the observed result: screen-size marks change scale rather than coordinates, selection is separate from plan layers, and inspection places it at the actual selected point. This resolves both visual discoverability and selection identification in the original finding.
2. **Resolved — enabled study extent on phones.** `mobile-bins-scope.png` and `narrow-bins-scope.png` now show the complete rectangular calculation outline in a fitted top view, with surrounding city context visible beyond it. Desktop scope behaves consistently. The former unexplained top-edge fragment is gone; enabling the layer produces the recognizable extent immediately. Fresh angle/workspace captures keep the layer off by default and retain continuous streets without a raised board. The supplied handler fits on scope enablement and uses the fitting top view for reset while scope remains enabled. The caption still states the original computation extent and contextual role of surrounding streets.

## remaining

Clear. No material regression introduced by this corrective batch was identified in the supplied captures. The accepted limits remain local Chromium 154/SwiftShader and emulated touch; static capture review does not establish other-browser, physical-device, or hardware-performance coverage.

This ship covers the scored fixes, not the whole surface.

disposition: ship
