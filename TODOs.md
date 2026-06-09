# TODOs

## Features:
- [x] A kid should be able to get an Award at most once per day. I.e it cannot get more than one ice-screams per day even if they have the stars. You can add a "available again" on the back of the card, similar to the "Chores". However all awards are redeemable once per day per kid, unlike chores that can be per week etc.
      Done: `app/services/rewards.py` enforces one redemption per kid per individual reward per Athens day; redeem returns 409 once claimed today; `/api/marketplace/rewards` emits `available_again_at` (next Athens midnight). Front card shows a "Το πήρες σήμερα!" badge instead of the redeem button; the back shows a "Διαθέσιμο ξανά {when}" hint.
- [x] Add sound effects to the events. I.e when claiming a chore, an award, or when a card is flipped. Add a button to mute/unmut sounds on the top right of the screen.
      Done: `lib/sound.ts` synthesizes tones via the Web Audio API (no asset files) — `playClaim`/`playReward`/`playFlip`, wired into chore claim, reward redeem, and card flips. Mute is a persisted (localStorage) zustand store toggled by a 🔊/🔇 button in the header (top right).

## Bugs:
- [x] Some cards are still transparent and the letters on the front show on the back when it is flipped. This bug appeared when you added accent colors to the cards. It looks like the css for the cards is not handled uniformly. Go through the css and see if it needs to be cleaned-up or sanitized.
      Fixed: `.chore-card.chore-taken` used `opacity: 0.8` on the whole flip-card face, making it translucent and letting the mirrored front text bleed through the back when flipped. Now dims only the card's inner content (icon/title/points) so the face stays fully opaque.
