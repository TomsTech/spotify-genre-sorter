## 2024-05-24 - Strict ARIA Type Requirements
**Learning:** When dynamically updating ARIA attributes via JavaScript (like `setAttribute('aria-expanded', value)`), the value must be explicitly cast to a string (e.g., `"true"` or `"false"`). Passing a boolean value violates strict accessibility and DOM standards, and fails linting/review.
**Action:** Always wrap boolean values in string conversions (e.g., `(!isCollapsed).toString()`) or use explicit string assignments when setting ARIA attributes dynamically.
