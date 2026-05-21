## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2024-05-18 - Missing ARIA Expansion States on UI Toggles
**Learning:** Discovered that the mobile sidebar toggle button lacked proper `aria-controls` and dynamically updated `aria-expanded` attributes, causing the collapsible state to be invisible to screen readers.
**Action:** When implementing or fixing toggle buttons that control collapsible regions, ensure `aria-controls` maps to the region ID, and `aria-expanded` is dynamically synced with the UI state using explicit string values ('true'/'false').
