## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2024-05-24 - Responsive ARIA State Initialization
**Learning:** When responsive UI elements dynamically change their visual state based on viewport size, their corresponding ARIA attributes (like `aria-expanded`) must be initialized correctly in JavaScript during component load to match that responsive state, rather than relying solely on toggle interaction events.
**Action:** Always initialize ARIA states on component load based on actual viewport/element state.
