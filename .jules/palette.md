## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2024-05-18 - Missing ARIA Attributes on Collapsible Sidebar Toggle
**Learning:** Collapsible panels that are responsive and initialize based on screen size can easily have their `aria-expanded` attributes get out of sync with the actual visual state, especially during initial page load.
**Action:** When working with toggle elements, ensure `aria-controls` is present, `aria-expanded` is explicitly passed as string values (e.g., `true`/`false`), and initialize the `aria-expanded` state during component mount to match any responsive defaults (like being auto-collapsed on mobile).
