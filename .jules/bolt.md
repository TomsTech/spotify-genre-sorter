## 2024-05-04 - [Debouncing Search Input]
**Learning:** The frontend filters the genre list synchronously on every keystroke (`oninput="filterAndRenderGenres(this.value)"`), which can cause main thread blocking and jank when dealing with hundreds or thousands of genres.
**Action:** Implement debouncing for search input handlers to delay the filtering logic until the user pauses typing. This is a classic frontend performance optimization that is simple to add and measurably improves responsiveness.
## 2024-05-06 - [Avoid Re-rendering Long Lists on Visibility Toggles]
**Learning:** In vanilla JS apps, re-rendering large lists with `innerHTML` when toggling individual item properties (like visibility) is an anti-pattern that causes severe UI stutter, especially for >1000 items.
**Action:** Always manipulate the single DOM element's classes or perform targeted node removal instead of triggering a full re-render loop for state changes on single elements.
