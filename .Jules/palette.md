
## 2026-06-17 - [ARIA Labels on Dynamic Iterators]
**Learning:** When generating lists of interactive elements dynamically (like mapped genre items), providing an `aria-label` with contextual text variables ensures each instance uniquely identifies its purpose to screen readers.
**Action:** Always include interpolated context strings (like `genre.name`) in the `aria-label` of repeated actions (e.g. "Create [Item]") rather than relying purely on the static visible text ("Create").
