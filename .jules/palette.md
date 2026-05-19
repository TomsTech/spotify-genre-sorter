## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2024-11-20 - ARIA attribute value types
**Learning:** For UI toggle buttons that control collapsible panels, updating `aria-expanded` with a boolean value instead of a string (e.g., `setAttribute('aria-expanded', !isCollapsed)`) is an anti-pattern. Strict standards require the value to be explicitly passed as a string (`'true'` or `'false'`) so it works correctly. Furthermore, it's critical to include `aria-controls="[panel-id]"` to link the control button and panel for accessibility.
**Action:** When updating ARIA attributes dynamically via JavaScript (e.g., `setAttribute('aria-expanded', value)`), always ensure the value is explicitly passed as a string (e.g., `'true'` or `'false'`), rather than a boolean. Ensure toggle buttons also have `aria-controls` properly set to the ID of the controlled panel.
