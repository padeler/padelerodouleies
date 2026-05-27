# Unstructured list of TODOs/bugs from using the application

## Completed
- [x] Chores can also have no specific time frame — start_time is now nullable
- [x] No need for EN and EL titles — single title field, admin uses any language they like
- [x] Many icons are still missing — icon catalog expanded
- [x] Username should be unique (case insensitive) — enforced on create/update
- [x] Activity tab Action column — now shows user-friendly labels instead of raw action_type strings
- [x] Frontend test suite — 113 Vitest tests all passing

## Remaining
- [ ] When selecting a time the clock should be 24h format. It should popup a widget to allow easy selection of the time (mobile friendly)
- [ ] Image upload fails even for images <2MB — investigate server-side validation / Pillow processing
- [ ] The side panel when you scroll down does not extend all the way
- [ ] When creating new chores it should also be possible to upload an image for the icon
- [ ] Chore deletion does not work (Delete button)
- [ ] All buttons should have icons and when the screen space is too limited only the icon should be visible on the button
