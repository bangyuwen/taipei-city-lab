## verdict

1. resolved — The sole material fix from finish-review.md, stale primary CSV conclusions after input edits, is cleared. Reopened desktop-csv-answer.png and mobile-csv-answer.png retain the correct completed-check answer. Reopened desktop-csv-pending.png and mobile-csv-pending.png show “資料或條件已變更，請重新執行健檢。” and “目前輸入尚未檢查” in the primary answer, with no old checked counts, CSV findings, or completed status. dist/app.js:269 now redraws that answer during invalidation; :110–117 supplies the pending conclusion and request for the same currentAnswer() used by the per-topic export.

tests/answers.test.mjs:51–63 exercises CSV, question, reference date, timezone, and contract edits after a completed check. Its assertions withdraw the old counts, require pendingAudit:true and no exported csv report, and confirm rerunning the check clears the pending state. scripts/check-answers-browser.py:56–69 additionally asserts and captures the changed-question primary answer and its matching pending JSON export at desktop/mobile widths. Reported validation is 126 tests, npm run check, legacy browser regression, 23 capture checks, and zero page errors; this reviewer inspected the source/assertions and did not rerun a browser or detector.

All 28 PNG files exist with coherent dimensions and match the current manifest hashes; all six runtime/font/provenance hashes match. Of the original 26 captures, 23 are byte-identical to review-before-fix.json and retain the prior evidence inspection. The three changed originals—desktop-traffic.png, desktop-bus.png, desktop-workbench.png—were reopened at their exact paths, alongside the four checked/pending CSV captures. No blank or wrong-state image and no material regression introduced by this fix was observed.

## remaining

clear — This ship covers the scored fix, not the whole surface. It does not certify substantive research-data sufficiency. Evidence remains local Chromium/SwiftShader with emulated touch; external tiles are blocked and workbench captures show comparison charts. No new shipping raster or second detector pass is part of this verdict.

disposition: ship
