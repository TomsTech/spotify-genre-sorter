## 2025-07-28 - Refactoring large template functions
**Learning:** Extracting large template strings into smaller helper functions improves readability and maintainability. Replacing inline event handlers (like `onclick`) with explicit `addEventListener` calls (or using event delegation) separates HTML structure from JavaScript behavior, making the code cleaner and easier to manage.
**Action:** Always look for opportunities to break down monolithic render functions and remove inline event handlers in favor of programmatic event binding.
