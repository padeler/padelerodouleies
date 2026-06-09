# TODOs

## Features:
- [ ] A kid should be able to get an Award at most once per day. I.e it cannot get more than one ice-screams per day even if they have the stars. You can add a "available again" on the back of the card, similar to the "Chores". However all awards are redeemable once per day per kid, unlike chores that can be per week etc.
- [ ] Add sound effects to the events. I.e when claiming a chore, an award, or when a card is flipped. Add a button to mute/unmut sounds on the top right of the screen.

## Bugs:
- [x] Some cards are still transparent and the letters on the front show on the back when it is flipped. This bug appeared when you added accent colors to the cards. It looks like the css for the cards is not handled uniformly. Go through the css and see if it needs to be cleaned-up or sanitized.
      Fixed: `.chore-card.chore-taken` used `opacity: 0.8` on the whole flip-card face, making it translucent and letting the mirrored front text bleed through the back when flipped. Now dims only the card's inner content (icon/title/points) so the face stays fully opaque.
