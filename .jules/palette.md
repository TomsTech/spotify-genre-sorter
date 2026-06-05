## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-05 - Responsive Sidebar ARIA States
**Learning:** Responsive elements that change their initial visual state based on viewport size (like an auto-collapsing sidebar on mobile) often have incorrect ARIA attributes on load because HTML hardcodes one state.
**Action:** Always initialize ARIA attributes (like `aria-expanded`) via JavaScript during component mount to match the actual initial state derived from the viewport or responsive classes, and explicitly pass string values ('true'/'false').
