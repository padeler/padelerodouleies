# Icon Catalog Reference

**359 SVG icons** available to exercise bundles. All icons are Lucide SVGs - stroke-based, 24x24 viewBox, `currentColor` fill.

## How to Use in Exercises

In a bundle manifest, reference an icon by its **name** (e.g. `apple`). Each icon is served at:

`/api/icons/svg/<name>`  e.g. `/api/icons/svg/apple`

Source files: `backend/app/icons/svg/<name>.svg`
Full catalog endpoint: `GET /api/icons/catalog`

## Using in a Bundle

The bundle validator requires every asset reference to exist inside the bundle's
`assets/` directory. To use an icon:

1. **Browse** this file to find the icon name you need.
2. **Copy** the SVG from `backend/app/icons/svg/<name>.svg` into your bundle's
   `assets/` directory.
3. **Reference** it in the manifest as `"image": "assets/<name>.svg"`.

For example, to use the apple icon:

```jsonc
{
  "type": "multiple_choice",
  "prompt": "Τι φρούτο αυτό;",
  "image": "assets/apple.svg",     // ← copied from backend/app/icons/svg/apple.svg
  "options": ["μήλο", "μπαλί", "πορτοκάλι"],
  "answer": "μήλο"
}
```

Do **not** reference the icon source path directly (e.g. `icons/svg/apple.svg`) —
the validator will reject it as a missing asset. Always copy into the bundle.

---

## Characters & Emojis (Avatars) (45 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``anchor`` | anchor, sea, strong, steady | άγκυρα, θάλασσα, δύναμη |
| ``angry`` | angry, mad, face | θυμωμένος, οργή, πρόσωπο |
| ``annoyed`` | annoyed, face, mood | ενοχλημένος, πρόσωπο, διάθεση |
| ``award`` | award, badge, achievement, winner | βραβείο, επίτευγμα, νίκη |
| ``axe`` | axe, viking, tool | τσεκούρι, βίκινγκ, εργαλείο |
| ``biceps-flexed`` | strong, muscle, power | δυνατός, μυς, δύναμη |
| ``bot`` | robot, bot, fun | ρομπότ, μπότ |
| ``bot-message-square`` | robot, chat, bot | ρομπότ, συνομιλία, μποτ |
| ``candy`` | candy, sweet, lollipop, treat | γλυκό, ζαχαρωτό, καραμέλα |
| ``candy-off`` | no candy, no sweets, forbidden | όχι γλυκά, απαγορευμένο |
| ``circle-user-round`` | user, avatar, profile | χρήστης, άβαταρ, προφίλ |
| ``club`` | club, card, symbol | σπαθί, τράπουλα, σύμβολο |
| ``diamond`` | diamond, gem, symbol | καρό, διαμάντι, σύμβολο |
| ``drama`` | theatre, masks, drama | θέατρο, μάσκες, δράμα |
| ``ferris-wheel`` | ferris wheel, amusement, fun | ρόδα, θέαμα, διασκέδαση |
| ``flame`` | flame, fire, hot, energy | φλόγα, φωτιά, ενέργεια |
| ``flame-kindling`` | fire, campfire, warm | φωτιά, κάμπινγκ, ζεστασιά |
| ``fox`` | fox, animal, cute, clever | αλεπού, ζώο, έξυπνο |
| ``frown`` | frown, sad, face | κατσούφης, λυπημένος, πρόσωπο |
| ``gem`` | gem, diamond, jewel, precious | κόσμημα, διαμάντι, πολύτιμο |
| ``ghost`` | ghost, spooky, spirit, fun | φάντασμα, πνεύμα, διασκεδαστικό |
| ``hard-hat`` | helmet, builder, work | κράνος, οικοδόμος, δουλειά |
| ``laugh`` | laugh, happy, joy, funny | γέλιο, χαρά, αστείο |
| ``medal`` | medal, winner, gold, prize | μετάλλιο, νικητής, βραβείο |
| ``meh`` | meh, neutral, face | αδιάφορος, ουδέτερος, πρόσωπο |
| ``paint-bucket`` | paint, creative, artist, color | χρώμα, δημιουργικό, καλλιτέχνης |
| ``person-standing`` | person, kid, standing | άτομο, παιδί, όρθιος |
| ``puzzle`` | puzzle, smart, clever, think | παζλ, έξυπνο, σκέψη |
| ``rainbow`` | rainbow, colors, happy | ουράνιο τόξο, χρώματα, χαρά |
| ``rocket`` | rocket, space, launch, fast | πύραυλος, διάστημα, ταχύτητα |
| ``scan-face`` | face, id, scan | πρόσωπο, ταυτότητα, σάρωση |
| ``shield-check`` | shield, trusted, reliable, protect | ασπίδα, αξιόπιστο, προστασία |
| ``shield-half`` | shield, guard, hero | ασπίδα, φύλακας, ήρωας |
| ``skull`` | skull, edgy, cool, skeleton | κρανίο, δροσερό, σκελετός |
| ``smile`` | smile, happy, face, cheerful | χαμόγελο, χαρούμενο, πρόσωπο |
| ``smile-plus`` | smile, happy, add | χαμόγελο, χαρά, προσθήκη |
| ``snowflake`` | snow, winter, cold | χιόνι, χειμώνας, νιφάδα |
| ``spade`` | spade, card, symbol | μπαστούνι, τράπουλα, σύμβολο |
| ``sword`` | sword, hero, knight | σπαθί, ήρωας, ιππότης |
| ``swords`` | swords, warrior, brave, knight | σπαθιά, πολεμιστής, γενναίος, ιππότης |
| ``unicorn`` | unicorn, magic, fantasy, cute | μονόκερος, μαγικό, φαντασία |
| ``user-round`` | user, person, profile | χρήστης, άτομο, προφίλ |
| ``venetian-mask`` | mask, costume, play | μάσκα, μεταμφίεση |
| ``wand-sparkles`` | magic, wand, sparkle | μαγικό, ραβδί, λάμψη |
| ``zap`` | zap, lightning, energy, power | κεραυνός, ενέργεια, ηλεκτρισμός |

## Food & Meals (37 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``apple`` | apple, fruit, snack, healthy | μήλο, φρούτο, σνακ, υγιεινό |
| ``banana`` | banana, fruit, snack | μπανάνα, φρούτο, σνακ |
| ``bean`` | bean, legume, vegetable | φασόλι, όσπριο, λαχανικό |
| ``beef`` | meat, beef, protein | κρέας, μοσχάρι |
| ``cake`` | cake, birthday, dessert, sweet | κέικ, έτος, γλυκό |
| ``cake-slice`` | cake, slice, dessert | τούρτα, κομμάτι, γλυκό |
| ``carrot`` | carrot, vegetable, healthy, snack | καρότο, λαχανικό, υγιεινό |
| ``chef-hat`` | chef, hat, cook, kitchen | σεφ, καψάκι, μαγείρεμα, κουζίνα |
| ``cherry`` | cherry, fruit | κεράσι, φρούτο |
| ``citrus`` | citrus, lemon, orange, fruit | εσπεριδοειδές, λεμόνι, πορτοκάλι, φρούτο |
| ``coffee`` | coffee, drink, morning, cup | καφές, ποτό, πρωινό |
| ``cookie`` | cookie, sweet, snack, treat | μπισκότο, γλυκό, σνακ |
| ``croissant`` | croissant, bread, bakery, pastry | κρουασάν, ψωμί, αρτοπολείο |
| ``cup-soda`` | soda, drink, cup, beverage | ποτό, χυμός, λίχανο |
| ``dessert`` | dessert, sweet, pudding | επιδόρπιο, γλυκό |
| ``donut`` | donut, sweet, treat | ντόνατ, γλυκό, λουκουμάς |
| ``drumstick`` | chicken, meat, drumstick | κοτόπουλο, κρέας, μπούτι |
| ``egg-fried`` | egg, breakfast, fried | αυγό, πρωινό |
| ``fish-symbol`` | fish, seafood, protein | ψάρι, θαλασσινά, πρωτεΐνη |
| ``glass-water`` | water, glass, drink, hydrate | νερό, πιάτο, πότο |
| ``grape`` | grape, fruit | σταφύλι, φρούτο |
| ``ham`` | ham, meat | ζαμπόν, κρέας |
| ``hand-platter`` | plate, dish, serve, platter | πιάτο, σερβίρισμα, δίσκος, πιάτα |
| ``ice-cream-bowl`` | ice cream, bowl, dessert | παγωτό, μπολ, γλυκό |
| ``milk`` | milk, dairy, drink, calcium | γάλα, ποτό, γαλακτικό |
| ``nut`` | nut, snack, healthy | ξηρός καρπός, σνακ, υγιεινό |
| ``pizza`` | pizza, food, cheese, italian | πιτσα, φαγητό, τυρί |
| ``plate`` | plate, food, meal, eat, dishes | πιάτο, φαγητό, γεύμα, φαγω |
| ``popcorn`` | popcorn, snack, movie | ποπ κορν, σνακ |
| ``popsicle`` | popsicle, ice, treat | παγωτό, ξυλάκι |
| ``salad`` | salad, greens, vegetable, healthy | σαλάτα, λαχανικά, φυλλο |
| ``sandwich`` | sandwich, lunch, bread, snack | σάντουιτς, γεύμα, ψωμί |
| ``soup`` | soup, bowl, warm | σούπα, μπολ |
| ``utensils`` | utensils, fork, knife, silverware | κουτάλια, χαλβάδια, πιρούνι |
| ``utensils-crossed`` | utensils, restaurant, fork, knife | κουτάλια, εστιατόριο |
| ``vegan`` | vegan, plant, healthy | βίγκαν, φυτικό, υγιεινό |
| ``wheat`` | wheat, bread, grain | σιτάρι, ψωμί, δημητριακά |

## Health & Hygiene (40 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``accessibility`` | accessibility, care, body | προσβασιμότητα, φροντίδα, σώμα |
| ``activity`` | health, pulse, fitness | υγεία, παλμός, φυσική κατάσταση |
| ``baby`` | baby, infant, care, diaper | μωρό, φροντίδα, πάνα |
| ``bandage`` | bandage, wound, first aid, boo-boo | επίδεσμος, τραύμα, πρώτες βοήθειες |
| ``bath`` | bath, bathtub, tub, wash | λουτρό, βάνα, πλύσιμο |
| ``cross`` | first aid, medical, cross | πρώτες βοήθειες, ιατρικό, σταυρός |
| ``droplet`` | water drop, moisture, hydrate | σταγόνα, υγρασία |
| ``droplets`` | water, drops, soap, hydrate | σταγόνες, νερό, σαπούνι |
| ``ear`` | ear, hearing, clean, care | αυτί, ακοή, καθαριότητα |
| ``egg`` | egg, baby, breakfast, care | αβγό, μωρό, πρωινό |
| ``eye`` | eye, sight, glasses, care | μάτι, όραση, φροντίδα |
| ``fan`` | fan, air, ventilation, fresh | ανεμιστήρας, αέρας, αερισμός |
| ``footprints`` | footprints, feet, shoes, clean | πατημασιές, πόδια, παπούτσια |
| ``hand`` | hand, hands, wash, clean | χέρι, χέρια, πλύσιμο |
| ``hand-heart`` | care, love, kindness | φροντίδα, αγάπη, καλοσύνη |
| ``hand-helping`` | help, care, support | βοήθεια, φροντίδα, υποστήριξη |
| ``hand-metal`` | robot hand, metal, clean | χέρι, καθαριότητα |
| ``headphones`` | headphones, ear, hearing | ακουστικά, αυτί |
| ``heart-pulse`` | health, heartbeat, pulse | υγεία, παλμός, καρδιά |
| ``hospital`` | hospital, clinic, care | νοσοκομείο, κλινική, φροντίδα |
| ``moon`` | moon, night, bedtime, sleep | σέληνος, νύχτα, ύπνος |
| ``pill`` | pill, medicine, health | χάπι, φάρμακο, υγεία |
| ``pill-bottle`` | medicine, pills, bottle | φάρμακα, χάπια, μπουκάλι |
| ``scan-heart`` | heart, checkup, health | καρδιά, εξέταση, υγεία |
| ``shirt`` | shirt, clothes, fold, laundry | πουκάμισο, ρούχα, δίπλωμα |
| ``shower`` | shower, bath, wash, water | ντους, λουτρό, πλύσιμο, νερό |
| ``shower-head`` | shower, wash, clean | ντους, πλύσιμο, καθαριότητα |
| ``sparkle`` | clean, shine, sparkle | καθαρό, λάμψη, γυαλάδα |
| ``spray-can`` | spray, clean, disinfect | σπρέι, καθαριστικό |
| ``sun`` | sun, morning, day, rise | ήλιος, πρωί, ημέρα |
| ``sunset`` | sunset, evening, dusk, night | ηλιοβασίλεμα, βράδυ |
| ``syringe`` | syringe, vaccine, doctor | σύριγγα, ένεση, εμβόλιο |
| ``tablets`` | pills, medicine, tablets | χάπια, φάρμακα, δισκία |
| ``thermometer`` | thermometer, temperature, fever, health | θερμόμετρο, πυρετός, υγεία |
| ``toilet`` | toilet, bathroom, wc | τουαλέτα, μπάνιο, λεκάνη |
| ``tooth`` | tooth, teeth, brush, dental | δόντι, δόντια, βούρτσισμα, οδοντόβουρτσα |
| ``umbrella`` | umbrella, rain, wet, protect | ομπρέλα, βροχή |
| ``washing-machine`` | laundry, washing machine, clothes, wash | πλυντήριο, ρούχα, πλύσιμο, μπουγάδα |
| ``waves`` | water, waves, ocean, sea | κυματά, θάλασσα, κολύμβι |
| ``wind`` | wind, air, fresh, breeze | άνεμος, αέρας, φρέσκο |

## Household & Tidying (53 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``air-vent`` | vent, air, ac, duct | αεραγωγός, αέρας, κλιματισμός |
| ``archive`` | archive, storage, organize | αρχείο, αποθήκη, ταξινόμηση |
| ``armchair`` | armchair, chair, living room, furniture | πολυθρόνα, καρέκλα, έπιπλα |
| ``battery`` | battery, charge, power | μπαταρία, φόρτιση, ενέργεια |
| ``bed`` | bed, sleep, sheets, fold, bedroom | κρεβάτι, ύπνος, δίπλωμα, σεντόνια |
| ``bed-double`` | bed, bedroom, sleep | κρεβάτι, υπνοδωμάτιο, ύπνος |
| ``bed-single`` | bed, single, sleep | κρεβάτι, μονό, ύπνος |
| ``bike`` | bike, bicycle, put away, cycle | ποδήλατο, τακτοποίηση |
| ``blinds`` | blinds, window, curtain | στόρια, παράθυρο, κουρτίνα |
| ``blocks`` | blocks, build, toys | τουβλάκια, χτίσιμο, παιχνίδια |
| ``box`` | box, toy box, container, put away | κουτί, παιχνίδια, αποθήκευση |
| ``brush`` | brush, paint, clean, sweep | βούρτσα, σκούπισμα, χρώμα |
| ``car`` | car, vehicle, park, put away | αυτοκίνητο, παρκάρισμα |
| ``cooking-pot`` | pot, cooking, kitchen | κατσαρόλα, μαγείρεμα, κουζίνα |
| ``door-closed`` | door, closed, room | πόρτα, κλειστή, δωμάτιο |
| ``door-open`` | door, room, tidy, close | πόρτα, δωμάτιο, τακτοποίηση |
| ``drill`` | drill, tool, repair | τρυπάνι, εργαλείο, επισκευή |
| ``flashlight`` | flashlight, torch, light | φακός, φως, λάμπα |
| ``folder`` | folder, organize, sort, files | φάκελος, ταξινόμηση |
| ``frame`` | frame, picture, photo | κορνίζα, φωτογραφία, εικόνα |
| ``hammer`` | hammer, fix, repair | σφυρί, επισκευή, μαστόρεμα |
| ``heater`` | heater, radiator, warm | καλοριφέρ, θερμάστρα, ζέστη |
| ``house`` | house, home, chores, clean | σπίτι, οικία, δουλειές |
| ``house-plug`` | home, power, smart | σπίτι, ρεύμα, έξυπνο |
| ``lamp`` | lamp, light, room, bedside | λάμπα, φωτισμός, δωμάτιο |
| ``lamp-ceiling`` | lamp, ceiling, light | φωτιστικό, οροφή, φως |
| ``lamp-desk`` | lamp, desk, light | λάμπα, γραφείο, φως |
| ``lamp-floor`` | lamp, floor, light | λαμπατέρ, δάπεδο, φως |
| ``lamp-wall-down`` | lamp, wall, light, sconce | απλίκα, τοίχος, φως |
| ``lamp-wall-up`` | lamp, wall, light, sconce | απλίκα, τοίχος, φως |
| ``lightbulb`` | light, bulb, lamp | λάμπα, φως, γλόμπος |
| ``microwave`` | microwave, kitchen, heat | φούρνος, μικροκυμάτων, κουζίνα |
| ``package`` | package, pack, packaging, box | πακέτο, συσκευασία |
| ``paint-roller`` | paint, roller, decorate | βάψιμο, ρολό, μπογιά |
| ``paintbrush-vertical`` | paint, brush, decorate | βάψιμο, πινέλο, διακόσμηση |
| ``plug`` | plug, power, socket | πρίζα, ρεύμα, βύσμα |
| ``plug-2`` | plug, power, socket | πρίζα, ρεύμα, βύσμα |
| ``pocket-knife`` | knife, tool, fix | σουγιάς, εργαλείο, επισκευή |
| ``recycle`` | recycle, recycling, reuse, eco | ανακύκλωση, οικολογικό |
| ``refrigerator`` | fridge, kitchen, cold | ψυγείο, κουζίνα |
| ``rocking-chair`` | chair, rocking, furniture | καρέκλα, κουνιστή, έπιπλο |
| ``router`` | router, wifi, internet | ρούτερ, wifi, ίντερνετ |
| ``scissors`` | scissors, cut, craft, snip | ψαλίδι, κόψιμο, χειροτεχνία |
| ``shopping-bag`` | bag, shopping, put away, tote | τσάντα, ψώνια, τακτοποίηση |
| ``sofa`` | sofa, couch, living room, tidy | καναπές, σαλόνι, τακτοποίηση |
| ``sparkles`` | sparkle, shiny, clean, tidy | λάμψη, καθαριότητα, τάξη |
| ``table`` | table, furniture, desk | τραπέζι, έπιπλο, γραφείο |
| ``trash`` | trash, bin, garbage | σκουπίδια, κάδος, απορρίμματα |
| ``trash-2`` | trash, garbage, bin, throw away | σκουπίδια, κάδος, πέταγμα |
| ``tv-minimal`` | tv, television, screen | τηλεόραση, οθόνη |
| ``warehouse`` | storage, warehouse, store | αποθήκη, χώρος, φύλαξη |
| ``wifi`` | wifi, internet, network | wifi, ίντερνετ, δίκτυο |
| ``wrench`` | wrench, fix, tool | κλειδί, εργαλείο, επισκευή |

## Nature, Pets & Outdoors (34 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``bird`` | bird, pet, fly, feathers | πουλί, ζώο, φτερά |
| ``bone`` | bone, dog, treat | κόκαλο, σκύλος, λιχουδιά |
| ``bug`` | bug, insect, nature, crawling | έντομο, φύση, έρπετο |
| ``cat`` | cat, pet, kitten, animal | γάτα, ζώο, γατάκι |
| ``cloud`` | cloud, sky, weather, rain | σύννεφο, ουρανός, καιρός |
| ``dog`` | dog, pet, walk, animal, puppy | σκύλος, ζώο, βόλτα, κουτάβι |
| ``dumbbell`` | dumbbell, exercise, sport, fitness | αλτήρας, άσκηση, γυμναστική |
| ``feather`` | feather, bird, light | φτερό, πουλί, ελαφρύ |
| ``fence`` | fence, garden, yard, outside | φράχτης, κήπος, αυλή, εξωτερικό |
| ``fish`` | fish, aquarium, pet, swim | ψάρι, ενυδρείο, ζώο |
| ``flower`` | flower, bloom, nature | λουλούδι, άνθος, φύση |
| ``flower-2`` | flower, bloom, garden, plant | λουλούδι, κήπος, φυτό |
| ``heart`` | heart, love, care, affection, pet | καρδιά, αγάπη, φροντίδα, ζώο |
| ``leaf`` | leaf, nature, tree, green | φύλλο, φύση, πράσινο |
| ``leafy-green`` | leaf, plant, salad | φύλλο, φυτό, σαλάτα |
| ``mountain`` | mountain, hill, outdoor, nature | βουνό, εκδρομή, φύση |
| ``mountain-snow`` | mountain, snow, nature | βουνό, χιόνι, φύση |
| ``mouse`` | mouse, rodent, animal | ποντίκι, τρωκτικό, ζώο |
| ``origami`` | origami, paper, crane | οριγκάμι, χαρτί, γερανός |
| ``paw-print`` | paw, pet, animal, footprint | πατούσα, ζώο, αποτύπωμα |
| ``rabbit`` | rabbit, bunny, pet, hop | κουνέλι, ζώο, χαριτωμένο |
| ``rat`` | rat, mouse, animal | ποντίκι, ζώο |
| ``shell`` | shell, sea, beach | κοχύλι, θάλασσα, παραλία |
| ``snail`` | snail, slow, animal | σαλιγκάρι, ζώο |
| ``sprout`` | sprout, grow, seed, plant | βλαστάρι, ανάπτυξη, φύτεμα |
| ``squirrel`` | squirrel, animal | σκίουρος, ζώο |
| ``sunrise`` | sunrise, morning, nature | ανατολή, πρωί, φύση |
| ``tree-deciduous`` | tree, nature, forest | δέντρο, φύση, δάσος |
| ``tree-palm`` | palm, tree, tropical | φοίνικας, δέντρο, τροπικό |
| ``tree-pine`` | tree, pine, forest | δέντρο, πεύκο, δάσος |
| ``trees`` | trees, forest, nature, park | δέντρα, δάσος, φύση, πάρκο |
| ``turtle`` | turtle, slow, pet, shell | χελώνα, ζώο, καβούκι |
| ``volleyball`` | volleyball, sport, outdoor, ball | βόλεϊ, σπορ, εξωτερικό, μπάλα |
| ``worm`` | worm, bug, animal | σκουλήκι, έντομο |

## Parent & Admin Tools (44 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``alarm-clock`` | alarm, clock, time | ξυπνητήρι, ώρα, ρολόι |
| ``alarm-clock-check`` | alarm, done, schedule | ξυπνητήρι, ολοκληρώθηκε, πρόγραμμα |
| ``badge-check`` | verified, approved, badge | επιβεβαίωση, έγκριση |
| ``banknote`` | money, cash, allowance | χρήματα, χαρτονόμισμα, χαρτζιλίκι |
| ``bell`` | bell, notification, alert, reminder | κωδωνάριο, ειδοποίηση, υπενθύμιση |
| ``calendar-check`` | calendar, schedule, done | ημερολόγιο, πρόγραμμα |
| ``calendar-clock`` | calendar, deadline, time | ημερολόγιο, προθεσμία, ώρα |
| ``calendar-heart`` | calendar, event, special | ημερολόγιο, εκδήλωση, ξεχωριστό |
| ``clipboard`` | clipboard, list, checklist, notes | πρόχειρο, λίστα, σημειώσεις |
| ``clipboard-check`` | checklist, done, tasks | λίστα, ολοκληρωμένο, εργασίες |
| ``clipboard-list`` | list, tasks, chores | λίστα, εργασίες, δουλειές |
| ``clock`` | clock, time, schedule | ρολόι, ώρα, πρόγραμμα |
| ``credit-card`` | card, money, pay | κάρτα, χρήματα, πληρωμή |
| ``crown`` | crown, king, queen, admin, royal | στέμμα, βασιλιάς, βασιλίσσα, διαχειριστής |
| ``file-clock`` | file, history, log | αρχείο, ιστορικό, καταγραφή |
| ``file-text`` | file, document, report, paper | αρχείο, έγγραφο, αναφορά |
| ``folder-open`` | folder, files, open | φάκελος, αρχεία, άνοιγμα |
| ``glasses`` | glasses, spectacles, see, observe | γυαλιά, παρατήρηση, βλέπω |
| ``hand-coins`` | coins, money, reward, allowance | νομίσματα, χρήματα, επίδομα |
| ``handshake`` | agreement, deal, help | συμφωνία, συνεργασία, βοήθεια |
| ``id-card`` | id, card, identity | ταυτότητα, κάρτα, στοιχεία |
| ``key`` | key, access, unlock | κλειδί, πρόσβαση, ξεκλείδωμα |
| ``key-round`` | key, access, admin, open | κλειδί, πρόσβαση, διαχειριστής |
| ``lock`` | lock, secure, password, locked | κλειδαριά, ασφάλεια |
| ``lock-keyhole`` | lock, secure, keyhole, locked | κλειδαριά, ασφάλεια, κλειδαρότρυπα |
| ``lock-open`` | unlock, access, open | ξεκλείδωμα, πρόσβαση, άνοιγμα |
| ``mail-open`` | mail, message, note | αλληλογραφία, μήνυμα, σημείωμα |
| ``megaphone`` | megaphone, announcement, broadcast | μεγάφωνο, ανακοίνωση, μήνυμα |
| ``newspaper`` | newspaper, news, read | εφημερίδα, νέα, διάβασμα |
| ``phone`` | phone, call, contact | τηλέφωνο, κλήση, επικοινωνία |
| ``piggy-bank`` | savings, money, bank | κουμπαράς, χρήματα, αποταμίευση |
| ``receipt`` | receipt, bill, expense, household | απόδειξη, λογαριασμός, νοικοκυριό |
| ``settings`` | settings, gear, configure, options | ρυθμίσεις, διαμόρφωση |
| ``shield`` | shield, admin, parent, protect | ασπίδα, διαχειριστής, γονέας, προστασία |
| ``shopping-basket`` | shopping, basket, groceries | ψώνια, καλάθι, αγορές |
| ``shopping-cart`` | shopping, cart, groceries | καρότσι, ψώνια, αγορές |
| ``stethoscope`` | stethoscope, health, doctor, medical | στηθοσκόπιο, υγεία, γιατρός |
| ``user-check`` | user, approve, verify | χρήστης, έγκριση, επιβεβαίωση |
| ``user-cog`` | user, settings, manage | χρήστης, ρυθμίσεις, διαχείριση |
| ``user-plus`` | user, add, new | χρήστης, προσθήκη, νέος |
| ``users`` | users, family, group, manage | χρήστες, οικογένεια, ομάδα, διαχείριση |
| ``users-round`` | users, family, group | χρήστες, οικογένεια, ομάδα |
| ``wallet`` | wallet, money, budget | πορτοφόλι, χρήματα |
| ``wallet-cards`` | wallet, cards, money | πορτοφόλι, κάρτες, χρήματα |

## Rewards & Activities (53 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``boom-box`` | boom box, music, speaker, radio | ραδιόφωνο, μουσική, ηχείο |
| ``bus`` | bus, trip, travel | λεωφορείο, εκδρομή, ταξίδι |
| ``cable-car`` | cable car, ride, trip | τελεφερίκ, βόλτα, εκδρομή |
| ``camera`` | camera, photo, picture | φωτογραφική, φωτογραφία |
| ``candy-cane`` | candy cane, sweet, christmas, treat | καλαμάκι καραμέλας, γλυκό, χριστούγεννα |
| ``car-front`` | car, ride, trip | αυτοκίνητο, βόλτα, ταξίδι |
| ``caravan`` | caravan, camping, trip | τροχόσπιτο, κάμπινγκ, εκδρομή |
| ``castle`` | castle, fun, adventure | κάστρο, διασκέδαση, περιπέτεια |
| ``clapperboard`` | clapperboard, movie, video, filming | κλαπέτο, βίντεο, σινεμά |
| ``coins`` | coins, money, allowance, earn | νομίσματα, χρήματα, επίδομα, κέρδος |
| ``dice-1`` | dice, one, game | ζάρι, ένα, παιχνίδι |
| ``dice-2`` | dice, two, game | ζάρι, δύο, παιχνίδι |
| ``dice-3`` | dice, three, game | ζάρι, τρία, παιχνίδι |
| ``dice-4`` | dice, four, game | ζάρι, τέσσερα, παιχνίδι |
| ``dice-5`` | dice, five, game | ζάρι, πέντε, παιχνίδι |
| ``dice-6`` | dice, six, game | ζάρι, έξι, παιχνίδι |
| ``dices`` | dice, game, play | ζάρια, παιχνίδι |
| ``film`` | film, movie, cinema, screen | ταινία, κινηματογράφος, οθόνη |
| ``flag`` | flag, finish, goal | σημαία, τερματισμός, στόχος |
| ``gamepad`` | gamepad, game, play, console | χειριστήριο, παιχνίδι, κονσόλα |
| ``gamepad-2`` | game, controller, play | παιχνίδι, χειριστήριο, κονσόλα |
| ``gift`` | gift, present, reward, prize | δώρο, βραβείο, παρουσίαση |
| ``ice-cream`` | ice cream, dessert, sweet, treat | παγωτό, γλυκό, επιδόρπιο |
| ``ice-cream-cone`` | ice cream cone, sweet, dessert, trip | χωνάκι παγωτού, έξοδος, γλυκό |
| ``joystick`` | joystick, game, arcade, play | χειριστήριο, αρκέιντ, παιχνίδι |
| ``lollipop`` | lollipop, sweet, candy, treat | γλειφιτζούρι, γλυκό, ζαχαρωτό |
| ``luggage`` | luggage, travel, trip, holiday | αποσκευές, ταξίδι, διακοπές |
| ``map`` | map, exploration, journey, travel | χάρτης, εξερεύνηση, ταξίδι |
| ``moon-star`` | moon, star, night | φεγγάρι, αστέρι, νύχτα |
| ``party-popper`` | party, celebration, confetti, fun | πάρτι, γιορτή, διασκέδαση |
| ``plane`` | plane, flight, travel, fly | αεροπλάνο, ταξίδι, πτήση |
| ``plane-takeoff`` | plane, trip, travel | αεροπλάνο, ταξίδι, απογείωση |
| ``radio`` | radio, music | ραδιόφωνο, μουσική |
| ``ribbon`` | ribbon, prize, award | κορδέλα, βραβείο, διάκριση |
| ``sailboat`` | boat, sail, sea | βάρκα, ιστιοφόρο, θάλασσα |
| ``ship`` | ship, boat, travel, voyage | πλοίο, κρουαζιέρα, ταξίδι, θάλασσα |
| ``ship-wheel`` | ship, sea, sail | τιμόνι, θάλασσα, πλοίο |
| ``speaker`` | speaker, music, sound | ηχείο, μουσική, ήχος |
| ``star`` | star, points, reward, shine, badge | αστέρι, πόντοι, βραβείο, λάμψη |
| ``store`` | store, shop, buy, market | κατάστημα, αγορά, ψώνια |
| ``target`` | target, goal, aim | στόχος, σκοπός, βελάκι |
| ``tent`` | tent, camping, outdoors | σκηνή, κάμπινγκ, εκδρομή |
| ``tent-tree`` | camping, tent, nature | κάμπινγκ, σκηνή, φύση |
| ``ticket`` | ticket, admission, event, pass | εισιτήριο, εκδήλωση, επίσκεψη |
| ``ticket-check`` | ticket, pass, event | εισιτήριο, πάσο, εκδήλωση |
| ``tickets`` | tickets, passes, event | εισιτήρια, πάσα, εκδήλωση |
| ``tickets-plane`` | flight, trip, tickets | πτήση, ταξίδι, εισιτήρια |
| ``toy-brick`` | toy, brick, build | παιχνίδι, τουβλάκι, χτίσιμο |
| ``train-front`` | train, trip, travel | τρένο, εκδρομή, ταξίδι |
| ``trophy`` | trophy, winner, champion, prize | κύπελλο, νικητής, βραβείο |
| ``tv`` | tv, television, screen time, watch | τηλεόραση, οθόνη, χρόνος οθόνης |
| ``wand`` | wand, magic, wish | ραβδί, μαγικό, ευχή |
| ``wine`` | wine, drink, celebration, toast | κρασί, γιορτή, ποτό |

## School & Learning (53 icons)

| Icon Name | Description (EN) | Description (EL) |
|-----------|-----------------|-----------------|
| ``atom`` | atom, science, physics | άτομο, επιστήμη, φυσική |
| ``backpack`` | backpack, bag, school, books | σακίδιο, σχολείο, βιβλία |
| ``beaker`` | beaker, chemistry, lab | δοχείο, χημεία, εργαστήριο |
| ``binary`` | binary, code, numbers | δυαδικό, κώδικας, αριθμοί |
| ``book`` | book, read, homework, study | βιβλίο, διάβασμα, σπουδές |
| ``book-open`` | book, read, study | βιβλίο, διάβασμα, μελέτη |
| ``brain`` | brain, think, learn, study, smart | μυαλό, σκέψη, μάθηση, έξυπνο |
| ``calculator`` | calculator, math, compute, numbers | αριθμομηχανή, μαθηματικά, αριθμοί |
| ``code`` | code, programming, computer | κώδικας, προγραμματισμός, υπολογιστής |
| ``compass`` | compass, geometry, math, circle | διαβήτης, γεωμετρία, μαθηματικά |
| ``dna`` | dna, biology, science | dna, βιολογία, επιστήμη |
| ``drafting-compass`` | compass, geometry, draw | διαβήτης, γεωμετρία, σχέδιο |
| ``drum`` | drum, music, instrument | τύμπανο, μουσική, όργανο |
| ``eraser`` | eraser, rubber, erase, mistake | γόμα, διόρθωση |
| ``flask-conical`` | flask, chemistry, lab | φιάλη, χημεία, εργαστήριο |
| ``globe`` | globe, world, geography, earth | υδρόγειος, γεωγραφία, κόσμος |
| ``graduation-cap`` | graduate, cap, education, school | αποφοίτηση, εκπαίδευση, σχολείο |
| ``guitar`` | guitar, instrument, music, play | κιθάρα, μουσική, μαθήματα |
| ``highlighter`` | highlighter, marker, study | μαρκαδόρος, υπογράμμιση, μελέτη |
| ``keyboard`` | keyboard, typing, computer | πληκτρολόγιο, γραφή, υπολογιστής |
| ``keyboard-music`` | keyboard, music, piano | πληκτρολόγιο, μουσική, πιάνο |
| ``languages`` | language, translate, speak | γλώσσες, μετάφραση, ομιλία |
| ``laptop`` | laptop, computer | λάπτοπ, υπολογιστής, φορητός |
| ``library`` | library, books, reading, study | βιβλιοθήκη, βιβλία, διάβασμα |
| ``magnet`` | magnet, physics, science | μαγνήτης, φυσική, επιστήμη |
| ``mic`` | microphone, sing, record | μικρόφωνο, τραγούδι, ηχογράφηση |
| ``microscope`` | microscope, science, lab | μικροσκόπιο, επιστήμη, εργαστήριο |
| ``monitor`` | monitor, computer, screen | οθόνη, υπολογιστής |
| ``music`` | music, note, song, music class | μουσική, νότα, τραγούδι |
| ``music-2`` | music, note, song | μουσική, νότα, τραγούδι |
| ``music-3`` | music, notes, song | μουσική, νότες, τραγούδι |
| ``music-4`` | music, notes, song | μουσική, νότες, τραγούδι |
| ``notebook`` | notebook, notes, homework, journal | τετράδιο, σημειώσεις, εργασία |
| ``notebook-pen`` | notebook, write, homework | τετράδιο, γραφή, εργασία |
| ``paintbrush`` | paintbrush, paint, art, brush | πινέλο, χρώμα, τέχνη |
| ``palette`` | palette, art, colors, painting | παλέτα, τέχνη, χρώματα |
| ``pen`` | pen, write, note | στυλό, γραφή, σημείωση |
| ``pen-tool`` | pen, write, ink, edit | στυλό, γράφω, μελάνι |
| ``pencil`` | pencil, write, draw, school | μολύβι, γράφω, σχολείο |
| ``pencil-line`` | pencil, write, practice, cursive | μολύβι, γράψιμο, εξάσκηση |
| ``pencil-ruler`` | pencil, ruler, design | μολύβι, χάρακας, σχέδιο |
| ``pi`` | pi, math, number | πι, μαθηματικά, αριθμός |
| ``piano`` | piano, music, instrument | πιάνο, μουσική, όργανο |
| ``presentation`` | presentation, board, lesson | παρουσίαση, πίνακας, μάθημα |
| ``printer`` | printer, print | εκτυπωτής, εκτύπωση |
| ``ruler`` | ruler, measure, straightedge, math | χάρακας, μέτρηση, μαθηματικά |
| ``school`` | school, education, building | σχολείο, εκπαίδευση, κτίριο |
| ``sigma`` | sum, math, sigma | άθροισμα, μαθηματικά, σίγμα |
| ``sticky-note`` | note, reminder, sticky | σημείωμα, υπενθύμιση, χαρτάκι |
| ``swatch-book`` | colors, swatch, art | χρώματα, παλέτα, τέχνη |
| ``telescope`` | telescope, stars, astronomy | τηλεσκόπιο, αστέρια, αστρονομία |
| ``test-tube`` | test tube, chemistry, lab | δοκιμαστικός σωλήνας, χημεία, εργαστήριο |
| ``test-tubes`` | test tubes, science, lab | δοκιμαστικοί σωλήνες, επιστήμη, εργαστήριο |
