# Nonogram Studio redesign

Direction: Framed sheet; seed 1506388040. Kept the installed IBM Plex typography; no redraws.
Face: a green-grey frame, white work sheet and green pixel fills. The live puzzle itself is the signature element.
Main question: which cells can I fill, and did my last move introduce a mistake?
Actual data: puzzle clues, filled/target totals, elapsed time, best time, current incorrect cells. No sample metrics or outside imagery.

Changes: a distinct puzzle canvas, a quiet tool rail, readable numeric clues, opaque mobile toolbar, matching light/dark tokens. Incorrect cells in unique puzzles are marked red with a live count and row/column coordinates. Puzzles without proven uniqueness retain clue-based validation.

Behavior: refs keep board, history and completion current between renders; rapid input no longer builds edits on stale snapshots. Pointer handling ignores additional pointers during a stroke, consumes the final release location and handles lost capture. Validation checks placement existence rather than computing forced cells, and completion uses the inexpensive clue comparison.

Verification: TypeScript and production build passed. Existing suite: 90/90; rapid-input regressions: 4/4. These regressions deliberately keep callbacks from one render using a hook harness; they do not replace real pointer-device testing.
Source design lint on changed UI files: 0 FAIL, 12 WARN. Warnings concern numeric fonts, focus rings and inset cell-state markers; these are functional puzzle conventions, not decorative panel shadows.

Visual review remains unverified: both before/after inspector runs timed out at CDP Page.enable. Computer-use inventory returned no available browser. No screenshot critique scores or responsive measurements are claimed. Tester should verify 1440, 768 and 390px, rapid clicks/drags, right click, multitouch, undo/redo, reset, zoom and dark mode.
