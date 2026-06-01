## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-01 - Sync Responsive State with ARIA Attributes
**Learning:** When UI elements change their visual state responsively (like auto-collapsing a sidebar on mobile), their ARIA attributes (like aria-expanded) must be explicitly synchronized during component mount to match the initial visual state, otherwise screen readers receive incorrect information.
**Action:** Always ensure responsive initialization logic updates both the visual classes and the corresponding ARIA attributes and icon states simultaneously.
