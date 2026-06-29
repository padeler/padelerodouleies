# TODOs
# Features / Bugs

In number-adventure and letter-adventure:
- [x] When the game starts there is a screen that has a welcome text and a start button. It is redundant, remove it.
- [x] When you win a level the "Μπραβο!"  screen is not layed out correctly, the text is rendered on top of the image.
- [x] In all screens There should be a border around the game area as it is in other games
- [x] On matching-letters levels, when you press the last pair it emediatelly switches to the "Μπράβο!" screen. It should show the result for a second to allow to the TTS to finish.
- [x] On the rodering exercise when you select the last item it switches to the "Μπραβο!" screen emediatelly. See above. It should be similar to how the exercises allow the user to see the correct result before proceeding.
- [x] in matching levels it should colorize pairs differently similar to the matching execrises.
- [x] sometimes during a phase you get the same exercise over and over again. This should never happen. (no-repeat: a round never reproduces the previous round's question signature)
- [x] make the speeker icon most subtle. It takes too much space. You can move it on the top right of the game area similar to the chore cards

Still open (need a curated Greek word→icon vocabulary dataset + a design decision — see notes below):
- [ ] matching letters (lower-case with capital) is too simple it needs to be more engaging. For example it could be match the icons with the first letter of the word.
- [ ] the falling letters need to be more engaging.
      - [ ] Add falling icons with the letters/numbers
      - [ ] add variations like
            - [ ] "click on all letter A" (multiple letters) or
            - [ ] "click on all items that start with B" or
            - [ ] spell the word (i.e spell "γάτα" -> press letters in the correct order, or count to 5 -> press numbers in the correct order)
- [ ] progressive intra-tier difficulty (less time allowed, faster drops, larger numbers) — the no-repeat fix is landed; ramping within a tier is a follow-up.
