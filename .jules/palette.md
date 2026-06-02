## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-02 - Responsive ARIA Initialization
**Learning:** ARIA attributes like aria-expanded must be initialized correctly during component load to match the initial responsive state, and values must be passed as explicitly typed strings.
**Action:** Always verify initial ARIA state on responsive UI components and use string values for dynamic ARIA attributes.
