# TODOs

## Features:


## Bugs:
- [x] Some cards are still transparent and the letters on the front show on the back when it is flipped. This bug appeared when you added accent colors to the cards. It looks like the css for the cards is not handled uniformly. Go through the css and see if it needs to be cleaned-up or sanitized.
      Fixed: `.chore-card.chore-taken` used `opacity: 0.8` on the whole flip-card face, making it translucent and letting the mirrored front text bleed through the back when flipped. Now dims only the card's inner content (icon/title/points) so the face stays fully opaque.
