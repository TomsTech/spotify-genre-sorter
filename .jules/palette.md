## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-09 - [Form Input Accessibility] **Learning:** [Custom modal components frequently lacked proper label-input association or ARIA labels, rendering them inaccessible to screen readers.] **Action:** [Always ensure new form inputs are explicitly linked with 'for' and 'id' attributes or provided with an 'aria-label' if standalone.]
## 2024-07-17 - Missing ARIA Labels on Tab Navigation Buttons
**Learning:** Admin and Scoreboard tab interfaces were using `<button>` elements with text content, but lacked explicit `aria-label` attributes or `aria-selected` states, making navigation confusing for screen reader users when tabs are grouped together.
**Action:** Always ensure custom tab navigation structures use explicit `aria-label` attributes to clarify their purpose to screen readers, regardless of the text content.
