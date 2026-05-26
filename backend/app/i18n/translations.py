"""Bilingual translation dictionary and helper.

All static UI strings live here. The frontend fetches the full dict on boot.
Keys that are missing raise KeyError — no silent fallback.
"""

TRANSLATIONS: dict[str, dict[str, str]] = {
    # Login / auth
    "login.welcome": {"el": "Καλωσήρθες", "en": "Welcome"},
    "login.select_profile": {"el": "Επίλεξε το προφίλ σου", "en": "Select your profile"},
    "login.enter_pin": {"el": "Είσελε το PIN", "en": "Enter your PIN"},
    "login.wrong_pin": {"el": "Λάθος PIN, προσπάθησε ξανά", "en": "Wrong PIN, try again"},
    "login.locked": {"el": "Κλειδωμένο για {seconds} δευτερόλεπτα", "en": "Locked for {seconds} seconds"},
    "login.first_run_title": {"el": "Δημιουργία Admin Λογαριασμού", "en": "Create Admin Account"},
    "login.cancel": {"el": "Ακύρωση", "en": "Cancel"},
    # Navigation
    "nav.dashboard": {"el": "Πίνακας", "en": "Dashboard"},
    "nav.chores": {"el": "Χόρες", "en": "Chores"},
    "nav.marketplace": {"el": "Αγορά", "en": "Marketplace"},
    "nav.history": {"el": "Ιστορικό", "en": "History"},
    "nav.leaderboard": {"el": "Κατάταξη", "en": "Leaderboard"},
    "nav.admin": {"el": "Admin", "en": "Admin"},
    "nav.approvals": {"el": "Εγκρίσεις", "en": "Approvals"},
    "nav.rewards": {"el": "Βραβεία", "en": "Rewards"},
    "nav.users": {"el": "Χρήστες", "en": "Users"},
    "nav.fulfillment": {"el": "Εκτέλεση", "en": "Fulfillment"},
    "nav.activity": {"el": "Δραστηριότητα", "en": "Activity"},
    "nav.logout": {"el": "Έξοδος", "en": "Logout"},
    "nav.settings": {"el": "Ρυθμίσεις", "en": "Settings"},
    # Common
    "common.save": {"el": "Αποθήκευση", "en": "Save"},
    "common.delete": {"el": "Διαγραφή", "en": "Delete"},
    "common.edit": {"el": "Επεξεργασία", "en": "Edit"},
    "common.cancel": {"el": "Ακύρωση", "en": "Cancel"},
    "common.confirm": {"el": "Επιβεβαίωση", "en": "Confirm"},
    "common.success": {"el": "Επιτυχία!", "en": "Success!"},
    "common.error": {"el": "Σφάλμα", "en": "Error"},
    "common.loading": {"el": "Φόρτωση…", "en": "Loading…"},
    # Chores
    "chore.claim": {"el": "Διεκδίκηση", "en": "Claim"},
    "chore.pending": {"el": "Σε αναμονή", "en": "Pending"},
    "chore.approved": {"el": "Εγκρίθηκε", "en": "Approved"},
    "chore.declined": {"el": "Αρνήθηκε", "en": "Declined"},
    "chore.points": {"el": "+{points} ⭐", "en": "+{points} ⭐"},
    "chore.scope_individual": {"el": "Ατομικό", "en": "Individual"},
    "chore.scope_pooled": {"el": "Κοινό", "en": "Pooled"},
    "chore.new": {"el": "Νέο Χόρε", "en": "New Chore"},
    "chore.title_el_placeholder": {"el": "Τίτλος στα Ελληνικά", "en": "Title in Greek"},
    "chore.title_en_placeholder": {"el": "Τίτλος στα Αγγλικά", "en": "Title in English"},
    "chore.already_claimed": {"el": "Κάποιος άλλος το διεκδίκησε πρώτος!", "en": "Someone else claimed this first!"},
    "chore.none_visible": {"el": "Δεν υπάρχουν χόρες αυτή τη στιγμή", "en": "No chores available right now"},
    # Rewards
    "reward.redeem": {"el": "Εξαργύρωση", "en": "Redeem"},
    "reward.contribute": {"el": "Συνεισφορά", "en": "Contribute"},
    "reward.insufficient": {"el": "Αρκετά αστέρια!", "en": "Not enough stars!"},
    "reward.collaborative_goals": {"el": "Επικοί Στόχοι", "en": "Epic Goals"},
    "reward.fulfilled": {"el": "Εκτελέστηκε", "en": "Fulfilled"},
    "reward.claimed": {"el": "Διεκδικήθηκε", "en": "Claimed"},
    "reward.complete": {"el": "Στόχος επιτεύχτηκε!", "en": "Goal reached!"},
    # Stars
    "stars.current": {"el": "{count} ⭐", "en": "{count} ⭐"},
    "stars.adjust": {"el": "Ρύθμιση Αστέρων", "en": "Adjust Stars"},
    "stars.manual_note": {"el": "Σχόλιο", "en": "Note"},
    # History
    "history.action_approved": {"el": "Εγκρίθηκε", "en": "Approved"},
    "history.action_declined": {"el": "Αρνήθηκε από Γονέα: {reason}", "en": "Declined by Parent: {reason}"},
    "history.action_manual": {"el": "Χειροκίνητη ρύθμιση: {reason}", "en": "Manual adjustment: {reason}"},
    "history.action_purchase": {"el": "Αγόρασε: {title}", "en": "Purchased: {title}"},
    "history.empty": {"el": "Δεν υπάρχει ιστορικό ακόμα", "en": "No history yet"},
    # Admin
    "admin.approve": {"el": "Έγκριση", "en": "Approve"},
    "admin.decline": {"el": "Άρνηση", "en": "Decline"},
    "admin.reason_placeholder": {"el": "Λόγος (προαιρετικό)", "en": "Reason (optional)"},
    "admin.mark_fulfilled": {"el": "Έγινε", "en": "Mark Fulfilled"},
    "admin.pending_badge": {"el": "Εγκρίσεις", "en": "Approvals"},
    # Bootstrap
    "bootstrap.name": {"el": "Όνομα", "en": "Name"},
    "bootstrap.pin": {"el": "PIN (4 ψηφία)", "en": "PIN (4 digits)"},
    "bootstrap.pin_confirm": {"el": "Επιβεβαίωση PIN", "en": "Confirm PIN"},
    "bootstrap.avatar": {"el": "Εικόνα προφίλ", "en": "Profile picture"},
    "bootstrap.pin_mismatch": {"el": "Τα PIN δεν ταιριάζουν", "en": "PINs do not match"},
    # PIN reset
    "pin_reset.title": {"el": "Αλλαγή PIN", "en": "Change PIN"},
    "pin_reset.current": {"el": "Τρέχον PIN", "en": "Current PIN"},
    "pin_reset.new": {"el": "Νέο PIN", "en": "New PIN"},
    "pin_reset.confirm": {"el": "Επιβεβαίωση Νέου PIN", "en": "Confirm New PIN"},
    # Icon picker
    "icon_picker.search": {"el": "Αναζήτηση…", "en": "Search…"},
    "icon_picker.category_hygiene": {"el": "Υγιεινή", "en": "Hygiene"},
    "icon_picker.category_meals": {"el": "Φαγητό", "en": "Meals"},
    "icon_picker.category_tidying": {"el": "Τακτοποίηση", "en": "Tidying"},
    "icon_picker.category_school": {"el": "Σχολείο", "en": "School"},
    "icon_picker.category_pets": {"el": "Καταστήματα & Έξω", "en": "Pets & Outdoor"},
    "icon_picker.category_avatars": {"el": "Προφίλ", "en": "Avatars"},
    "icon_picker.category_parent": {"el": "Γονείς", "en": "Parent"},
    "icon_picker.category_rewards": {"el": "Βραβεία", "en": "Rewards"},
    "icon_picker.tab_icon": {"el": "Εικονίδιο", "en": "Icon"},
    "icon_picker.tab_upload": {"el": "Ανέβασμα", "en": "Upload"},
    # Errors
    "error.generic": {"el": "Προέκυψε σφάλμα", "en": "An error occurred"},
    "error.not_found": {"el": "Δεν βρέθηκε", "en": "Not found"},
    "error.unauthorized": {"el": "Μη εξουσιοδοτημένη πρόσβαση", "en": "Unauthorized"},
    "leaderboard.empty": {"el": "Δεν υπάρχουν δεδομένα κατάταξης", "en": "No leaderboard data yet"},
    "marketplace.empty": {"el": "Δεν υπάρχουν βραβεία ακόμα", "en": "No rewards available yet"},
    "auth.locale": {"el": "el", "en": "en"},
}


def t(key: str, locale: str = "el") -> str:
    """Translate a key to the given locale.

    Raises KeyError on missing keys or missing locale translations.
    """
    try:
        return TRANSLATIONS[key][locale]
    except KeyError as exc:
        raise KeyError(f"Missing translation: key={key!r}, locale={locale!r}") from exc


def pick_bilingual(row_el: str | None, row_en: str | None, locale: str) -> str:
    """Pick the appropriate locale title from bilingual content columns.

    Falls back to the other locale if the primary is empty/None.
    Raises KeyError if both are missing.
    """
    if locale == "el":
        primary, fallback = row_el, row_en
    else:
        primary, fallback = row_en, row_el

    if primary:
        return primary
    if fallback:
        return fallback
    raise KeyError("Both bilingual titles are missing")
