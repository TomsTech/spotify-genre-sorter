## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2026-05-14 - Incomplete ARIA Attributes on Toggles
**Learning:** Added `aria-controls` and static `aria-expanded` to a toggle button, but learned that `aria-expanded` must be dynamically updated by JavaScript to be fully effective for screen readers.
**Action:** When adding `aria-expanded` to a toggle, always ensure the corresponding JavaScript toggles its state between `true` and `false` synchronously with the visual change.
