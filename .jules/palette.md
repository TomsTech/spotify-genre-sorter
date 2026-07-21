## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-09 - [Form Input Accessibility] **Learning:** [Custom modal components frequently lacked proper label-input association or ARIA labels, rendering them inaccessible to screen readers.] **Action:** [Always ensure new form inputs are explicitly linked with 'for' and 'id' attributes or provided with an 'aria-label' if standalone.]

## 2024-07-18 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** The application contained a large number of icon-only buttons (like those for closing modals, navigating admin tabs, merging playlists, etc.) that did not have `aria-label`s, rendering them inaccessible to screen readers. Furthermore, a focus-visible outline on `.admin-tab` was missing, making keyboard navigation difficult.
**Action:** Always verify that every interactive button lacking text content has a descriptive `aria-label` attribute and that a `:focus-visible` outline is consistently applied across all custom interactive elements, and include immediate visual feedback (like a spinner) for slow async operations.
