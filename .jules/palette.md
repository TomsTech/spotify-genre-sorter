## 2024-05-18 - Missing ARIA Labels on Contextual Toggles
**Learning:** Found multiple instances of icon-only toggle buttons (like show/hide, modal close) that lacked `aria-label` attributes, making them opaque to screen readers despite having visual cues or `title` attributes.
**Action:** When adding or reviewing interactive icons, always ensure they are wrapped in an element with an explicit `aria-label` or accompanied by `sr-only` text, especially for dynamic states (e.g., 'Show [Item]' vs 'Hide [Item]').
## 2026-06-09 - [Form Input Accessibility] **Learning:** [Custom modal components frequently lacked proper label-input association or ARIA labels, rendering them inaccessible to screen readers.] **Action:** [Always ensure new form inputs are explicitly linked with 'for' and 'id' attributes or provided with an 'aria-label' if standalone.]
## 2024-08-01 - Missing ARIA Labels on Playlist Action Buttons
**Learning:** Found multiple instances of action buttons (like Fika dismiss, scan playlist, and back to playlists buttons) that lacked \`aria-label\` attributes, making them inaccessible to screen readers.
**Action:** When adding or reviewing action buttons, always ensure they are accompanied by \`aria-label\`, especially when they don't have descriptive text or are icon-heavy.
## 2024-05-24 - Accessibility improvements for icon-only buttons
**Learning:** Found multiple icon-only or visually-labeled buttons that did not have a clear `aria-label` attribute, which are essential for screen readers to properly interpret the UI. This issue was especially prevalent in toolbar buttons and modal triggers. Adding the correct label ensures equal access for all users.
**Action:** Always add descriptive `aria-label` attributes to icon-only buttons or interactive elements where visual context isn't sufficient for screen readers. Ensure these labels dynamically update if their purpose changes (e.g. "Show" vs "Hide"). Also, avoid overwriting the visible text entirely with an aria-label if the visible text conveys important information, ensuring compliance with WCAG 2.1 Success Criterion 2.5.3 (Label in Name).
## 2024-05-18 - Input Labels
**Learning:** Some inputs used `aria-label` but lacked a proper `<label>` with a `for` attribute. Using a visually hidden `sr-only` class on `<label>` elements provides better support for screen readers, as the `aria-label` alone can sometimes be insufficient.
**Action:** Always provide an explicit `<label for="...">` instead of just an `aria-label` for forms, hiding it with `.sr-only` if a visible label breaks the design.
