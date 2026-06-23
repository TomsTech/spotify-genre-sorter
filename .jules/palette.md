## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-09 - [Form Input Accessibility] **Learning:** [Custom modal components frequently lacked proper label-input association or ARIA labels, rendering them inaccessible to screen readers.] **Action:** [Always ensure new form inputs are explicitly linked with 'for' and 'id' attributes or provided with an 'aria-label' if standalone.]

## 2024-05-18 - Missing ARIA Labels on Icon-only Elements
**Learning:** Social share buttons (X, Facebook, WhatsApp) relying exclusively on text characters (e.g., '𝕏', 'f', '💬') create poor screen reader experiences (e.g., "mathematical double-struck capital X"). Similarly, dynamic progress bars missing \`aria-valuenow\` do not communicate active progress state.
**Action:** Always add explicit \`aria-label\` attributes to elements where the visual content is purely decorative or character-based. Ensure \`role="progressbar"\` containers dynamically reflect their state using \`aria-valuenow\`.
