- [ ] There are inconsistencies in the CSS of the frontend. Breaks when the width is small 
 - [x] in the admin's "Chores" tab, the buttons section of each row is missaligned with the rest of the row. It happens when the title column is multiple lines. (actions cell is now a normal middle-aligned table cell with an inner `.row-actions` flex row)
 - [x] the text in the buttons in the "Chores" when the width is very small collapse (only icons are shown) but there is still a lot of real estate which is unused (action buttons no longer stack vertically at ≤768px; they stay in a horizontal wrapping row)
 - [x] The icon of the "Disable" button in the "Chores" changes to two icons when it is clicked. (replaced the `👁‍🗨` ZWJ emoji, which fonts render as two glyphs, with single-codepoint `🚫`)
 - [x] Same problems as above in the "Awards" tab. (same fixes applied to RewardsPage + UsersPage)
 
 Based on the CSS inconsistencies maybe a refactoring/cleanup of the CSS now that the feature set is complete would help 