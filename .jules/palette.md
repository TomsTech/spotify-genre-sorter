## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2024-05-19 - Missing aria-controls and responsive aria-expanded on toggle buttons
**Learning:** Toggle buttons for sidebars or other dynamic panels must explicitly bind to their controlled elements using `aria-controls="[id]"` and accurately reflect the current DOM visibility via `aria-expanded`.
**Action:** When working on responsive components that auto-hide parts of the layout, ensure initialization scripts explicitly evaluate the visibility state (e.g., via `window.innerWidth`) and properly update ARIA properties (like `aria-expanded` with explicit string `'true'`/`'false'` instead of booleans) immediately on page load, rather than waiting for user interaction.
