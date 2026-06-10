## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2026-06-10 - Missing ARIA Labels on Standalone Search Inputs
**Learning:** Found standalone search inputs (like genre search and admin user search) that lacked `aria-label` attributes. Without a visible `<label>` element, these inputs are not explicitly announced by screen readers, making navigation difficult.
**Action:** Always provide an explicit `aria-label` for standalone `<input>` fields that do not have a visible and correctly associated `<label>`.
