## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2024-05-24 - Accurate ARIA state initialization on responsive elements
**Learning:** Responsive UI elements that dynamically change their visual state based on viewport size (like a sidebar auto-collapsing on mobile) must also initialize their corresponding ARIA attributes (e.g., `aria-expanded`) to match that responsive state, not just toggle them during user interaction.
**Action:** Always check the initial state logic (e.g., `window.innerWidth <= 1024` checks) to ensure ARIA attributes are synced alongside class list modifications.
