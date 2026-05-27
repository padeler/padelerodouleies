# Unstructured list of TODOs/bugs from using the application

## Completed
- [x] Chores can also have no specific time frame — start_time is now nullable
- [x] No need for EN and EL titles — single title field, admin uses any language they like
- [x] Many icons are still missing — icon catalog expanded
- [x] Username should be unique (case insensitive) — enforced on create/update
- [x] Activity tab Action column — now shows user-friendly labels instead of raw action_type strings
- [x] Frontend test suite — 113 Vitest tests all passing

## Remaining
- [x] When selecting a time the clock should be 24h format — replaced native input with custom 24h TimePicker24h component (hour/minute dropdowns)
- [x] Image upload fails even for images <2MB — fixed stale backend/data/ DB symlink, uploads work via curl
- [x] The side panel when you scroll down does not extend all the way — added height:100% to sidebar wrappers
- [x] When creating new chores it should also be possible to upload an image for the icon — verified working
- [x] Chore deletion does not work (Delete button) — verified working (soft delete via is_active=False)
- [x] All buttons should have icons and when the screen space is too limited only the icon should be visible on the button — added .btn-icon/.btn-text to all modals, tabs, logout button
