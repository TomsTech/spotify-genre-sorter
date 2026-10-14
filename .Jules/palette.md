## YYYY-MM-DD - Async UI Feedback
**Learning:** Users lack immediate visual feedback on long-running async actions (like inviting users), which can make the app appear unresponsive. Appending a spinning loader to the button's HTML effectively mitigates this without modifying structural CSS.
**Action:** Added inline HTML `<span class="spinner spinner-small">` alongside text changes when a button's `disabled` state is activated during async operations.
