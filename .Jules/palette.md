## 2024-11-20 - Contextual Labels on Repeated List Items
**Learning:** When generating multiple list items (like genre rows) that all contain identically named action buttons (e.g., "Create"), screen reader users lose context. Repeated generic text makes navigation confusing.
**Action:** Always append dynamic contextual data (like the item name) to the `aria-label` of repeated generic buttons to ensure screen readers announce a unique and descriptive action (e.g., "Create Rock").
