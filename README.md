# padelerodouleies

### Home-Server Gamified Chore & Reward Web Application

`padelerodouleies` is a self-hosted, lightweight, and highly visual web application designed to gamify household chores for two children (ages 4 and 9). The frontend is a **Vite + React + TypeScript** single-page app; the backend is a **FastAPI** service that also serves the built SPA assets. The whole stack runs locally inside a single Docker container on a home server, providing responsive, real-time access across family tablets, smartphones, and PCs.

The application balances a highly visual, zero-literacy interface for the 4-year-old with a text-and-numerical interface for the 9-year-old, managed completely by parental administrators via an authorization PIN system.

---

## 🎯 Project Goals & Requirements

### Primary Objectives

* **Gamification:** Motivate children to complete daily habits and tasks by rewarding them with "Stars" (points) that can be saved and redeemed for custom rewards.
* **Kid-Friendly UX:** Provide a vibrant, colorful, and highly touch-responsive interface optimized for mobile and tablet screens.
* **Low Friction Shared-Device Login:** Implement an incredibly fast user-switching profile screen suitable for children who cannot read or type usernames.
* **Single-Container Architecture:** A Vite-built React SPA served by the FastAPI backend out of one process. One image, one port, one bind-mount — chosen to simplify long-term self-hosted maintenance.
* **Localization:** Support bilingual toggles natively, displaying **Greek (Default)** and **English (Secondary)**.

### Infrastructure Requirements

* **Containerized Deployment:** Fully packaged within a single multi-stage `Dockerfile` and managed via `docker-compose`.
* **Data Persistence:** Lightweight local state preservation using an embedded **SQLite** database, bind-mounted safely to host storage (RAID).
* **Network Availability:** Accessible locally via HTTP/WebSockets on any browser within the home local area network (LAN).

---

## 👥 Users & Roles

The system operates strictly on a two-role paradigm separated by 4-digit PIN access numbers.

### 1. Admin Role (Parents)

Admins have full command over the system variables, state modifications, and approvals.

* **Chore Customization:** Create, edit, and configure the scope and time constraints of tasks.
* **The Ledger / Verification Pipeline:** Approve or decline pending chore claims submitted by users.
* **Reward Management:** Create, toggle availability for, and mark rewards as "awarded" (fulfilled).
* **Manual Overrides:** Directly award or deduct stars from a specific user accompanied by a short textual reason (e.g., *"+5 Stars for extra kindness"* or *-5 Stars for retroactive chore decline*).
* **User Management:** Create new user/admin profiles, assign names, set descriptions, and select profile avatars.

### 2. User Role (The Kids)

Users interact with a locked-down, visual dashboard.

* **Claim Tasks:** View active available tasks, see their point values, and claim them upon completion.
* **Monitor Metrics:** View cumulative star balance and historical timelines of approved/declined actions.
* **Redeem Marketplace:** Browse enabled rewards and spend saved stars to claim individual or collaborative items.

---

## 📦 Application Modules

### 1. Authentication Module ("Fast Switcher")

To accommodate shared home devices (like a kitchen or living room tablet), standard authentication forms are replaced by a visual roster:

* **Avatar Selection Grid:** The landing screen displays large circular profile avatars for all kids and admins.
* **Pop-Up PIN Pad:** Tapping an avatar launches a massive, kid-friendly 3x4 numeric touch keypad.
* **Session Management:** Entering a valid 4-digit PIN logs the user into their specific dashboard view. Users and admins can change their own PINs directly from their respective settings.

### 2. Chore Management Module

Chores represent tasks that earn stars. They feature properties mapped dynamically by the server code:

* **Visual Icon Feature:** Every chore is bound to an icon name mapping from an embedded icon collection (e.g., FontAwesome/Bootstrap Icons). The admin selects these via a keyword search in the creation form, ensuring the 4-year-old can visually recognize tasks (e.g., a toothbrush icon for brushing teeth).
* **Scoping Logic:**
* **Individual Scope:** Assigned to all matching users independently (e.g., "Brush teeth"—Child A claiming it does not hide it from Child B).
* **Pooled Scope:** Open to the household on a first-come, first-served basis (e.g., "Empty the dishwasher"—once claimed, it disappears from the active pool).


* **Dynamic Repeating Logic:** Tasks can be configured to auto-repeat daily within precise time windows (e.g., *"Morning Teeth Brushing is available starting at 07:00 for a duration window of 4 hours"*). The system calculates chore visibility on-the-fly dynamically when the dashboard page loads based on `datetime.now()`, avoiding complex background database crunching.

### 3. Verification & History Ledger

The application maintains absolute transparency regarding point transactions.

* **Immediate Gratification / Immediate Claiming:** When a child completes a chore and taps "Claim," they are visually rewarded instantly.
* **The Retroactive Decline Pipeline:** If a parent reviews the chore later and declines the claim, the stars are subtracted from the user's active balance.
* **The History Log:** All modifications are written cleanly as ledger rows. If a chore is declined, the child’s history view explicitly renders a negative transaction entry explaining the parent's action (e.g., `[-5 Stars] Brush teeth - Declined by Parent`).

### 4. Reward & Marketplace Module

A marketplace layout where earned stars are exchanged for incentives.

* **Reward Properties:** Every reward consists of a title/description (bilingual), a star cost, and an active toggle status managed by the Admin.
* **Collaborative "Epic" Rewards:** Admins can designate a reward as "Collaborative". This opens a pooled target savings bucket (e.g., *"Trip to the Waterpark - 500 Stars"*). Both kids can pool their saved stars together toward this joint goal, tracking progress via an overlapping visual progress bar.
* **Fulfillment Verification:** When a kid purchases a reward, it goes into a pending fulfillment queue for the admin. The admin ticks off the item once the physical reward is handed over or executed.

### 5. Gamified Leaderboard Module

A live-updating, high-contrast leaderboard view accessible to everyone in the house.

* **The Podium Layout:** Displays users ranked side-by-side on colorful, game-style podium steps.
* **Real-Time Synchronicity:** A FastAPI WebSocket endpoint pushes state changes to every connected client; the leaderboard, star counters, and approvals badge update instantly on tablet screens the moment an admin approves a chore from their smartphone — no page refreshes required.

---

## 🌐 Internationalization (i18n) Layout

The app stores all string templates inside a centralized server-side python translation dictionary (`translations.py`). A globally accessible locale state tracking variable alternates between languages via a header toggle button:

* **Default Locale:** Greek (`el`)
* **Secondary Locale:** English (`en`)

All system headers, button text, system notifications, and static UI element layouts alter dynamically, while custom fields created by admins (chore titles and descriptions) support fallback values.

---

## 🗄️ Database Schema Design (SQLite)

The backend state is handled through five relational tables managed seamlessly inside the local SQLite environment:

```text
  +-------------------+              +-------------------+
  |       USERS       |              |      CHORES       |
  +-------------------+              +-------------------+
  | id (PK)           |              | id (PK)           |
  | name              |              | title_el / title_en|
  | avatar_string     |              | icon_class        |
  | pin_hash          |              | scope (indiv/pool)|
  | role (admin/user) |              | points_value      |
  | current_stars     |              | is_repeating      |
  +---------+---------+              | start_time        |
            |                        | window_hours      |
            | 1                      +---------+---------+
            |                                  |
            | M                                | M
  +---------v----------------------------------v-------+
  |                   CHORE_HISTORY                    |
  +----------------------------------------------------+
  | id (PK)                                            |
  | user_id (FK)                                       |
  | chore_id (FK)                                      |
  | status (Pending / Approved / Declined)             |
  | timestamp                                          |
  | admin_note                                         |
  +----------------------------------------------------+

  +-------------------+              +-------------------+
  |      REWARDS      |              |  REWARD_LEDGER    |
  +-------------------+              +-------------------+
  | id (PK)           | 1          M | id (PK)           |
  | title_el/title_en | +----------> | reward_id (FK)    |
  | cost_stars        |              | user_id (FK)      |
  | is_collaborative  |              | status (claimed/  |
  | is_enabled        |              |         fulfilled)|
  +-------------------+              | timestamp         |
                                     +-------------------+

```

---

## 💻 Running a Development Environment

Start the backend and frontend as separate processes (no Docker needed). Two terminal windows:

**Terminal 1 — Backend:**
```bash
cd backend
pip install ".[dev]"        # core + test dependencies
pytest                       # run tests (optional, to verify setup)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser. The frontend proxies API requests to the backend on port 8000 via Vite's dev proxy.

On first run the backend will auto-create the SQLite database and bootstrap default admin users. Create any additional users, chores, or rewards through the admin panel.

---

## 🐳 Deployment & Docker Configuration

The system is deployed as a single container orchestrated through `docker-compose`.

* **Multi-stage Image:**
  * **Stage 1 (Frontend Build):** Node-based image that runs `npm ci && npm run build` against the Vite + React + TypeScript project, emitting static assets to `frontend/dist/`.
  * **Stage 2 (Runtime):** Slim Python image that installs the FastAPI dependencies, copies the backend source plus the `frontend/dist/` output from Stage 1, runs Alembic migrations on startup, and boots Uvicorn. FastAPI mounts the built SPA at `/` (with SPA fallback to `index.html`) and exposes the JSON API under `/api/` and the WebSocket under `/ws`.
* **Storage Mount:** The SQLite production database file directory (`/app/data/`) is bind-mounted out of the container volume structure into the host system’s fault-tolerant storage array (`/mnt/raid/padelerodouleies/data`), guaranteeing zero data loss during image updates or system container recreations.



## Example flows

Bellow there are some user workflows, system logic, and interactive state transitions for both standard users (the kids) and administrators (the parents).

### 1. Authentication & Profile Switching Flow

The authentication system is built to minimize friction on shared family tablets while maintaining absolute security via 4-digit numeric PINs.

#### Flow A: Child or Admin Login

1. **Landing State:** The screen presents a bright, clean grid of round user avatars (e.g., a Fox icon for the 9-year-old, a Unicorn for the 4-year-old, and a Shield icon for the Parent Admin).
2. **Profile Selection:** The user taps their respective avatar.
3. **PIN Pad Overlay:** A full-screen, oversized 3x4 numeric keypad smooth-slides into view. The child taps out their 4-digit PIN.
4. **Instant Verification:** The React PIN-pad component watches the entered-digit length. The exact microsecond the 4th digit is pressed, the frontend fires `POST /api/auth/login` to FastAPI and awaits the response:
* **Success:** The keypad slides away, and the UI redirects to either the *Kid Dashboard* or the *Admin Control Panel*.
* **Failure:** The PIN inputs shake visually, turn red, and clear instantly for a retry.



#### Flow B: Updating a User PIN

1. The logged-in user (or admin) taps the **Settings (⚙️)** gear on their dashboard.
2. They enter their current 4-digit PIN, followed by typing their preferred new 4-digit PIN twice.
3. Upon clicking **"Save"**, the server overwrites the `pin_hash` field for that user row in the SQLite database and pushes a green success confirmation banner across the screen.

---

### 2. Chore Management Workflows

#### Flow A: Admin Creates a Time-Boxed Repeating Chore

1. **Navigation:** The parent logs into the Admin panel and taps **"New Chore"**.
2. **Form Entry:** The parent fills out the localized fields:
* **Title:** `"Βούρτσισμα Δοντιών (Πρωί)"` / `"Brush Teeth (Morning)"`
* **Icon Search:** The parent types *"Tooth"* into an autocomplete field; the app pulls from the local icon library and previews a `fa-teeth` toothbrush graphic.
* **Points:** `5` Stars.
* **Scope Picker:** Set to **Individual** (so both girls must complete it independently).
* **Schedule Variables:** Set `Is_Repeating` to `True`, `Start_Time` to `07:00`, and `Window_Hours` to `4`.


3. **Execution:** Tapping **"Save Chore"** inserts the master parameters into the `CHORES` database table.

#### Flow B: Child Views and Claims a Chore

1. **Dynamic Visibility Engine:** When the 9-year-old logs into her dashboard at **08:30 AM**, the server evaluates `datetime.now()`. It checks the database and confirms:
* It is between 07:00 and 11:00 AM (Within the 4-hour window).
* No row exists in `CHORE_HISTORY` marked as `Approved` or `Pending` for this specific child today.


2. **Rendering:** The app renders a massive yellow card containing the `fa-teeth` graphic, the title, a `+5 ⭐` badge, and a giant green **"Claim / Διεκδίκηση"** button.
3. **The Action:** The child completes the real-world task and taps **"Claim"**.
4. **State Transition:** * The button instantly mutates into a spinning orange status text reading **"Pending Parent Approval / Σε αναμονή έγκρισης"**.
* A new row is written to `CHORE_HISTORY` with a status of `Pending`.
* *Note:* If the 4-year-old logs into her device, the card is still fully available for her to claim because the chore scope was set to *Individual*.



#### Flow C: Admin Declines or Approves a Claim

1. The parent opens the app on their phone and navigates to the **Approvals Queue**. They see: `[9-Year-Old] claimed [Brush Teeth (Morning)] at 08:34 AM`.

##### Scenario 1: The Parent Approves

* The parent taps the green checkmark.
* The system alters the `CHORE_HISTORY` status to `Approved`.
* The server increments the child's `current_stars` by 5 in the `USERS` table.
* The child’s open dashboard updates instantly via WebSockets—their cumulative star counter animates upward.

#### Scenario 2: The Parent Retroactively Declines (The Counter-Action Ledger)

* The parent walks into the bathroom, notices the toothbrush is dry, and realizes the chore wasn't done.
* In the app's history log, the parent taps **"Decline"** on that chore row and optionally types a quick reason: *"Toothbrush was dry!"*.
* **The Logic:** The system changes the status to `Declined`. It automatically subtracts `5` stars from the child’s active balance in the `USERS` table.
* **The History Feedback:** When the child checks her profile history timeline, she sees a transparent entry: `[-5 Stars] Βούρτσισμα Δοντιών (Πρωί) - Declined by Parent: Toothbrush was dry!`.

---

### 3. Reward & Marketplace Workflows

#### Flow A: Admin Creates an "Epic Collaborative" Reward

1. In the Admin dashboard, the parent goes to **"Rewards Maker"**.
2. They enter:
* **Title:** `"Εκδρομή στο Υδάτινο Πάρκο" / "Trip to the Waterpark"`
* **Cost:** `500` Stars.
* **Toggle Switch:** The parent switches `Is_Collaborative` to `True`.


3. Tapping save broadcasts this reward to the active marketplace page for all users.

#### Flow B: Kids Claim an Individual vs. Collaborative Reward

##### Scenario 1: Redemeing an Individual Reward (e.g., "1 Hour of Screen Time" for 20 Stars)

1. The 9-year-old opens the marketplace. She has an active balance of `35 Stars`.
2. Because `35 >= 20`, the **"Redeem / Εξαργύρωση"** button is highly colorful and unlocked. (For the 4-year-old who only has 12 stars, the button is grayed out and shows a locked padlock icon).
3. The 9-year-old taps **"Redeem"**.
4. **Database Mutation:** * 20 stars are instantly deducted from her user balance (`35 -> 15 Stars`).
* A row is written to the `REWARD_LEDGER` with the status `Claimed`.
* The admin is notified on their control panel queue under **"Rewards to Fulfill"**.



##### Scenario 2: Contributing to a Collaborative Reward (The Waterpark Goal)

1. Both girls open the Marketplace tab. They see a giant card for the Waterpark showing a combined progress bar tracking toward 500 Stars.
2. The 9-year-old decides to chip in. She hits **"Contribute Stars"**, and a tiny slider appears. She inputs `15 Stars` and hits confirm.
3. The 4-year-old opens her profile and contributes `10 Stars`.
4. **The System State:**
* 15 stars are deducted from the 9-year-old; 10 stars are deducted from the 4-year-old.
* The shared database table registers `25 / 500 Stars Saved`.
* The collaborative progress bar dynamically fills up to **5%** across all tablets in the house in real time.



#### Flow C: Admin Verifies a Reward Fulfilled

1. Once a reward is redeemed by a child, it sits in the parent's action tracker.
2. When the parent hands over the physical reward card or executes the event (e.g., grants the 1 hour of screen time), they log into the app and tap **"Mark as Awarded / Fulfilled"** next to that child's item.
3. The item moves out of the active queue and shifts into the permanent archive logs.

---

### 4. Manual Star Adjustments (Discretionary Points)

There are moments outside of structured chores where a parent wants to reward good behavior or deduct points for house rule violations.

1. The Admin opens the profile page of a specific child (e.g., the 4-year-old).
2. They click on **"Adjust Stars Manually"**.
3. The interface displays a simple plus/minus toggle control along with a mandatory description input text box.
4. **Example Action:** The parent inputs `+3`, types `"For sharing her blocks beautifully without being asked"`, and hits submit.
5. **Result:** The database immediately updates her balance, and the text explanation populates the child’s main dashboard timeline layout so she can visually correlate her good behavior with her growing star collection.