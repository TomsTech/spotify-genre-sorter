## 2024-05-13 - [Aria Expanded for Toggle Buttons]
**Learning:** For UI toggle buttons that control collapsible panels (like the stats dashboard), ensuring they have `aria-controls` and dynamically update `aria-expanded` is a critical accessibility improvement for screen readers to understand the state and target of the collapsible section.
**Action:** Always add `aria-expanded` and `aria-controls` to toggle buttons and update the `aria-expanded` attribute programmatically when the panel's visibility changes.
