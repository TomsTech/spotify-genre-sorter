## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').

## 2024-05-20 - Testing Mobile-Specific Elements
**Learning:** Found that Playwright tests can fail when targeting mobile-specific elements like a sidebar toggle if the browser viewport is not set to a mobile resolution, as these elements are hidden by CSS media queries and will cause timeouts waiting for visibility.
**Action:** When writing Playwright tests that interact with responsive or mobile-only UI elements, always explicitly initialize the browser context with an appropriate mobile viewport (e.g., `viewport={'width': 375, 'height': 667}`).
