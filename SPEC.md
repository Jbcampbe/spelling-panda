# Panda World Spelling — Product & Technical Specification (v1)

This document is the source of truth for building v1. Requirements are numbered (`R-…`) so they can be referenced in commits, tests and reviews. "Must" is mandatory for v1; "should" is strongly preferred; "won't" is explicitly out of scope.

---

## 1. Product summary

A free, web-based spelling game for children aged 6–10, used at home. The child hears a word (and on Easy, briefly sees it), types it on an in-app keyboard, and gets feedback. Good lessons earn pandas that live in a polished, softly animated 3D island the child can watch and interact with. The visuals and calm, refined animation are the product's main differentiator; the large word library is the second.

- Language: **US English only** (spelling and voice).
- Audience: children 6–10, at home, typically on a parent's phone or tablet.
- No monetisation, no accounts, no backend, no analytics.

### 1.1 Out of scope for v1 (won't)

- Picture hints for words.
- Accounts, cloud sync, backup/restore, classroom/teacher features.
- Unlockable world items, free-form building or decorating.
- Day/night cycle (v1 is bright daytime only).
- Renaming, recolouring or deleting pandas.
- Paid voice providers (ElevenLabs etc.) — the architecture must allow adding one later (see §6).
- Localisation beyond US English.

---

## 2. Platform, stack and hosting

| ID | Requirement |
|---|---|
| R-PLT-1 | Must be optimised for phones and tablets (touch-first) and must also work on desktop browsers. |
| R-PLT-2 | Must support portrait and landscape. Lesson layout is portrait-first on phones and landscape-first on tablets; the 3D world works in either. |
| R-PLT-3 | Supported browsers: current and previous major versions of iOS Safari, Chrome (Android and desktop), Edge, Firefox desktop. |
| R-PLT-4 | Stack: React + TypeScript + Vite; 3D via `three` + `@react-three/fiber` (+ `@react-three/drei` where useful). |
| R-PLT-5 | Storage: IndexedDB (via a small wrapper such as `idb`). No server-side storage. |
| R-PLT-6 | Must be an installable PWA (manifest + service worker, e.g. `vite-plugin-pwa`) that works fully offline after the first successful load: app code, word library, fonts and all assets are precached. |
| R-PLT-7 | On first launch the app must call `navigator.storage.persist()` to reduce the chance of storage eviction. |
| R-PLT-8 | Hosting: static build deployed to Vercel from a GitHub repo. No serverless functions required. |
| R-PLT-9 | No network requests at runtime other than to the app's own origin. No analytics, tracking, ads, or third-party CDNs. Fonts are self-hosted. |
| R-PLT-10 | Code is strictly typed (`strict: true`), linted (ESLint) and formatted (Prettier). |

---

## 3. Profiles and persistence

| ID | Requirement |
|---|---|
| R-PRF-1 | Up to **4** local profiles per device (per browser storage). No passwords. |
| R-PRF-2 | The app opens on a **profile picker**. Each profile shows its avatar (rendered starter panda) and name. An "add profile" tile appears while fewer than 4 profiles exist. |
| R-PRF-3 | Creating a profile: the child enters a profile name (in-app keyboard, 1–12 letters), then creates a **free starter panda** (colour + name, same flow as an earned panda, §8.3). That panda is the profile's avatar and starts on the island. |
| R-PRF-4 | Profiles can only be deleted from the parent area (§11), with a confirmation. Deleting removes all of that profile's data. |
| R-PRF-5 | All progress (pandas, word progress, settings) is stored in IndexedDB and survives reloads and app restarts. There is no backup/restore; the product accepts the risk of browser data being cleared, mitigated by PWA install and `storage.persist()`. |
| R-PRF-6 | Storage writes for a lesson result must be atomic (single IndexedDB transaction) so a crash cannot leave partial results. |

### 3.1 Data model (TypeScript reference)

```ts
type Level = 'easy' | 'medium' | 'hard';
type PandaColor =
  | 'classic' | 'chocolate' | 'rose' | 'sky' | 'mint'
  | 'lavender' | 'coral' | 'slate' | 'forest' | 'plum'
  | 'golden'; // golden is never user-selectable

interface Profile {
  id: string;            // uuid
  name: string;          // 1–12 lowercase/uppercase letters as typed
  avatarPandaId: string;
  createdAt: number;
}

interface Panda {
  id: string;
  profileId: string;
  name: string;          // 1–12 letters
  color: PandaColor;
  earnedAt: number;
  onIsland: boolean;
  isStarter: boolean;
}

interface WordProgress {      // one row per (profile, word) the child has encountered
  profileId: string;
  wordId: string;
  level: Level;
  state: 'mastered' | 'missed';
  lastSeenAt: number;
  missedAt?: number;          // set when entering the missed queue; used for queue ordering
  cycle: number;              // which pass through the level pool this belongs to (see §5.2)
}

interface LevelCycle {        // per (profile, level)
  profileId: string;
  level: Level;
  cycle: number;              // starts at 1
}

interface DeviceSettings {    // device-wide, not per profile
  voiceURI?: string;          // chosen speech voice; undefined = auto
  sfxEnabled: boolean;        // default true
  ambientEnabled: boolean;    // default false
}
```

---

## 4. Lesson flow and rules

### 4.1 Difficulty levels

| ID | Requirement |
|---|---|
| R-LVL-1 | **Easy**: grade K–1 words. The word is displayed for **3 seconds**, starting when the speech of the word begins, then hidden. It is shown once only per word; it is never re-shown on replay or after a wrong try. |
| R-LVL-2 | **Medium**: grades 2–3 words. Audio only. |
| R-LVL-3 | **Hard**: grades 4–5 words. Audio only. |
| R-LVL-4 | The child picks any level freely before each lesson (three large icon buttons). No locks or progression gates. |

### 4.2 Lesson structure

| ID | Requirement |
|---|---|
| R-LSN-1 | A lesson is **10 words** from a single level, chosen per §5. |
| R-LSN-2 | The lesson is shown as an overlay above the (dimmed, paused) island. A progress indicator shows 10 dots (pending / correct / missed). |
| R-LSN-3 | For each word: the word is spoken automatically when it appears (Easy also flashes it per R-LVL-1). |
| R-LSN-4 | Always-available controls during a word: **Hear it again** (replays the word, unlimited) and **Sentence** (speaks the example sentence, unlimited). Neither affects scoring. |
| R-LSN-5 | The child types on the in-app keyboard (§7) and presses Enter to submit. Enter with an empty input does nothing. |
| R-LSN-6 | Answer check: case-insensitive, whitespace trimmed, exact match against the word. |
| R-LSN-7 | Up to **3 tries** per word. |
| R-LSN-8 | **Wrong try (tries 1–2)**: the input does a gentle wobble animation and soft "try again" sound; the word is spoken again; the wrong attempt remains visible, faded, above a cleared input. No letter-level hints (no indication of which letters were wrong). |
| R-LSN-9 | After the **first** wrong try, a **Reveal answer** button appears and stays available for the rest of that word. |
| R-LSN-10 | **Correct**: celebratory chime and short positive animation; the word is spoken once; auto-advance after ~1.2 s. |
| R-LSN-11 | **Reveal, or third wrong try**: the correct word is shown (large, literacy font) next to the child's last attempt; the word is spoken once; a **Next** button appears. Tone stays encouraging — no harsh buzzers or red error screens. |
| R-LSN-12 | **Scoring**: a word is *correct* if spelled right within 3 tries. Reveal or three misses = *missed*. A word spelled right on the **first** try additionally earns a star. |
| R-LSN-13 | **Leaving mid-lesson**: a back/close control asks "Leave lesson?" (icon-led confirm). Confirming discards the lesson (no score, no reward). Words already missed in that lesson **do** enter the missed queue; words already answered correctly in that lesson are recorded as mastered. |
| R-LSN-14 | **Results screen**: shows X/10 and the first-try stars, with encouragement for any score. Then rewards per §8. |

---

## 5. Word selection

### 5.1 Missed-word queue

| ID | Requirement |
|---|---|
| R-SEL-1 | Each profile has a missed-word queue per level, ordered oldest-missed first. |
| R-SEL-2 | A word enters the queue when missed (R-LSN-12, R-LSN-13). |
| R-SEL-3 | A queued word leaves the queue (becomes mastered) when spelled correctly within 3 tries in a later lesson. If missed again, it stays (its `missedAt` is updated, moving it to the back). |

### 5.2 Building a lesson

| ID | Requirement |
|---|---|
| R-SEL-4 | Take up to **3** words from the front of that level's missed queue. |
| R-SEL-5 | Fill the remaining slots with random words from the level pool that are neither mastered in the current cycle nor in the queue. |
| R-SEL-6 | When fewer unseen words remain than needed, start a new cycle for that level: increment `LevelCycle.cycle`, making all mastered words eligible again (queued words remain queued). |
| R-SEL-7 | No word appears twice in one lesson. Homophones from the same `homophoneGroup` must not appear in the same lesson. |
| R-SEL-8 | Lesson order is shuffled (queued words are not all at the start). |
| R-SEL-9 | Selection logic must be a pure, unit-tested module with an injectable random source. |

---

## 6. Speech

| ID | Requirement |
|---|---|
| R-SPK-1 | v1 uses the browser **Web Speech API** (`speechSynthesis`). |
| R-SPK-2 | All speech goes through a provider interface so a pre-generated-audio provider (e.g. ElevenLabs files keyed by word id) can replace it without touching game code: |

```ts
interface SpeechProvider {
  isAvailable(): boolean;
  speakWord(word: WordEntry, opts?: { onStart?: () => void }): Promise<void>;
  speakSentence(word: WordEntry): Promise<void>;
  cancel(): void;
}
```

| ID | Requirement |
|---|---|
| R-SPK-3 | **Voice auto-selection**: choose an `en-US` voice, preferring names containing "Enhanced", "Premium", "Natural" or "Neural", then local over remote voices, then the platform default. Handle voices loading asynchronously (`voiceschanged`). |
| R-SPK-4 | Rate: ~0.85 for single words, ~0.9 for sentences (tunable constants). Pitch 1.0. |
| R-SPK-5 | Starting a new utterance cancels any in-progress one. |
| R-SPK-6 | iOS requires speech to begin from a user gesture: the first utterance of a session must be triggered by a tap (e.g. the difficulty selection tap). |
| R-SPK-7 | Easy-level flash timing starts on the utterance `onstart` event; if `onstart` hasn't fired within 1 s, start the 3-second timer anyway. |
| R-SPK-8 | The parent area offers a voice picker listing available `en-US` voices with a "test" button; the choice is saved in `DeviceSettings`. |
| R-SPK-9 | If speech synthesis is unavailable, show a clear parent-facing message (lessons can't run without audio on Medium/Hard). |

---

## 7. In-app keyboard and typography

| ID | Requirement |
|---|---|
| R-KEY-1 | A custom on-screen **QWERTY** keyboard: 26 lowercase letters, Backspace, Enter. No other keys. |
| R-KEY-2 | On touch devices the native keyboard must **never** open (the answer field is a display element, not a focusable `<input>`), preventing autocorrect, predictive text and spellcheck from revealing answers. |
| R-KEY-3 | On devices with a physical keyboard, `keydown` events for a–z, Backspace and Enter are also accepted. The on-screen keyboard remains visible. |
| R-KEY-4 | Keys fill the available width; minimum key height 52 px on phones; visible press state; optional subtle key-click sound (respects sfx setting). |
| R-KEY-5 | Input length capped at 20 characters. |
| R-KEY-6 | The same keyboard is used for profile names and panda names (names accept letters only, 1–12). |
| R-TYP-1 | Spelling words, the answer field and keyboard keys use **Andika** (self-hosted, SIL OFL), lowercase — chosen for single-storey "a" and "g" as children learn them. |
| R-TYP-2 | UI labels use a rounded, friendly self-hosted open-licence font (e.g. Nunito). |

---

## 8. Rewards and pandas

### 8.1 Earning

| ID | Requirement |
|---|---|
| R-RWD-1 | A lesson scoring **8/10 or 9/10** earns one panda. |
| R-RWD-2 | A lesson scoring **10/10** earns one **golden panda** instead (with a bigger celebration). There is no limit on golden pandas. |
| R-RWD-3 | A lesson below 8/10 earns no panda but always gets an encouraging message. |

### 8.2 Colours

| ID | Requirement |
|---|---|
| R-CLR-1 | Ten preset colours replace the dark fur areas (ears, eye patches, limbs, shoulder band): classic black, chocolate brown, rose pink, sky blue, mint, lavender, coral, slate grey, forest green, plum. Exact hex values chosen to look harmonious with the island's palette. White fur stays white. |
| R-CLR-2 | **Golden**: gold replaces the dark fur, with a subtle shimmer and occasional gentle sparkle. Not available in the normal palette. |

### 8.3 Creating a panda

| ID | Requirement |
|---|---|
| R-NEW-1 | After earning a normal panda: a colour screen with large tappable swatches and a live 3D preview, then a name screen. |
| R-NEW-2 | After earning a golden panda: skip colour selection; go straight to naming. |
| R-NEW-3 | Name: 1–12 letters typed on the in-app keyboard; a **random name** button fills a kid-friendly name from a built-in list (≥100 names). Names never leave the device; no moderation. |
| R-NEW-4 | After naming, return to the island: the camera smoothly zooms to the new panda's arrival (e.g. it bounces in), then eases back. |
| R-NEW-5 | A panda's name and colour are permanent: no renaming, recolouring or deleting. |

### 8.4 Panda Book and island capacity

| ID | Requirement |
|---|---|
| R-BOOK-1 | At most **12** pandas are on the island at once. The cap is lowered automatically on weaker devices (§10). |
| R-BOOK-2 | The **Panda Book** screen shows every panda the profile owns (name, colour, golden badge, rendered portrait) and which are on the island. Tapping a panda toggles it on/off the island. If the island is full, the child must take one off first (clear icon cue). |
| R-BOOK-3 | A newly earned panda always arrives on the island. If the island is full, the panda that has been on the island longest returns to the Book (with a brief visual cue). |

---

## 9. The 3D island

| ID | Requirement |
|---|---|
| R-WLD-1 | Style: a soft **toy-diorama floating island** — rounded forms, matte materials, soft warm daylight, gentle ambient occlusion feel, harmonious pastel palette. Everything is built procedurally in code (no external model files required). |
| R-WLD-2 | v1 lighting: **bright daytime only**. |
| R-WLD-3 | Static decor gives the island life: grass, bamboo clumps, rounded trees/bushes, rocks, a small pond or stream, flowers, drifting clouds around the island. No unlockable items. |
| R-WLD-4 | Camera: gently orbits on drag, limited pinch/scroll zoom, constrained angles so the island always looks good; slow idle drift when untouched. Respect `prefers-reduced-motion` by disabling idle drift and shortening transitions. |
| R-WLD-5 | Home screen = the island with one large **Play** button, plus icon buttons for the Panda Book, switching profile, and the parent gear (§11). |
| R-PND-1 | Pandas are modelled from smooth rounded primitives with a cohesive, cute, refined look. |
| R-PND-2 | Procedural animations: breathing, blinking, idle look-around, waddle walk, sit, eat bamboo, short nap (daytime doze). Pandas wander within island bounds with simple separation so they don't overlap. Behaviour is varied and unhurried — subtle, never frantic. |
| R-PND-3 | Tap reaction: a tapped panda does a random reaction (wave, roll, happy hop) with a small squeak sound and shows its name briefly above its head. |
| R-PND-4 | Golden pandas have the shimmer/sparkle of R-CLR-2 on the island too. |

---

## 10. Performance

| ID | Requirement |
|---|---|
| R-PRF-P1 | Target smooth 60 fps on roughly 2019+ phones (iPhone 11 / 2020 mid-range Android) and equivalents. |
| R-PRF-P2 | Adaptive quality: monitor frame rate (e.g. drei `PerformanceMonitor`) and step down device pixel ratio (cap 2, mobile start 1.5), shadow quality, decor density and the island panda cap (12 → 8 → 5) when sustained frame rate drops. |
| R-PRF-P3 | Rendering pauses (`frameloop` on demand / stopped) while a lesson overlay or full-screen menu covers the world, and when the tab is hidden. |
| R-PRF-P4 | Reuse geometries/materials across pandas (instancing or shared resources). |
| R-PRF-P5 | First load should be under ~3 MB gzipped excluding the word library; lazy-load the 3D scene after the profile picker renders. |

---

## 11. Parent area

| ID | Requirement |
|---|---|
| R-PAR-1 | Reached via a small **gear** icon that must be **pressed and held for 3 seconds** (with a visible progress ring). A short tap does nothing. |
| R-PAR-2 | Contents: voice picker + test (R-SPK-8); sound effects on/off; ambient audio on/off; "Install this app" instructions (iOS: Share → Add to Home Screen; Android/desktop: native install prompt via `beforeinstallprompt` where available), including a note that installing helps protect progress; delete profile (with confirm). |
| R-PAR-3 | The parent area is the only place with explanatory text; it may use normal reading-level copy. |

---

## 12. UI, accessibility and sound

| ID | Requirement |
|---|---|
| R-UI-1 | Icon-led UI. Children should be able to navigate without reading. Spoken instructions are **not** required. Text appears where it is the learning content itself, for names, or in the parent area. |
| R-UI-2 | Touch targets ≥ 48 px; primary actions (Play, Enter, Next) ≥ 64 px. |
| R-UI-3 | Visual polish over quantity: consistent easing, subtle transitions (≤ 400 ms typical), no jarring flashes. Refined, professional feel. |
| R-UI-4 | Sufficient colour contrast for word/answer text (WCAG AA). Correct/incorrect feedback is never conveyed by colour alone (motion and icon too). |
| R-SND-1 | Sound effects synthesised in code with Web Audio (no audio asset licensing): correct chime, soft try-again tone, panda squeaks, UI taps, reward fanfare (bigger for golden). |
| R-SND-2 | Optional ambient background audio (gentle, synthesised), **off by default**, and ducked/silenced while a word or sentence is being spoken. |
| R-SND-3 | A mute toggle is reachable from the home screen as well as the parent area. |

---

## 13. Screen flow

1. **Profile picker** → choose profile (or create one: name → starter panda colour → starter panda name).
2. **Island (home)** → Play / Panda Book / switch profile / gear.
3. **Play** → difficulty picker (Easy / Medium / Hard icons).
4. **Lesson overlay** (10 words) over the dimmed, paused island.
5. **Results** (X/10 + stars).
6. If earned: **colour** (skipped for golden) → **name**.
7. **Back to island** with camera zoom to the new panda's arrival.

---

## 14. Word library

### 14.1 Content

| ID | Requirement |
|---|---|
| R-WRD-1 | Approximately **1,500 words**, ~500 per level: Easy = grades K–1 (CVC words, common sight words, simple blends), Medium = grades 2–3 (digraphs, vowel teams, common suffixes, two-syllable words), Hard = grades 4–5 (multi-syllable, silent letters, tricky patterns, common prefixes/suffixes). Draw on established US grade-level frequency lists (e.g. Dolch, Fry) for the lower levels. |
| R-WRD-2 | Lowercase **a–z only**: no proper nouns, contractions, hyphenated words or capitals. |
| R-WRD-3 | **Family-friendly**: no violence, weapons, scary or upsetting themes, bodily/toilet humour, romance, religion, politics, alcohol/drugs, brand names, or words with a common crude secondary meaning. |
| R-WRD-4 | Exclude **heteronyms** (same spelling, different pronunciation: read, lead, tear, wind, bow, live…), since an isolated TTS rendering is ambiguous. |
| R-WRD-5 | Exclude words with common accepted US spelling variants (gray/grey, okay/ok, donut/doughnut) so only one answer is correct. |
| R-WRD-6 | Each word has one example **sentence**: 5–14 words, family-friendly, natural, contains the target word exactly once in the same form, and makes the meaning unambiguous. Easy-level sentences use simple vocabulary. |
| R-WRD-7 | Homophones (there/their/they're-excluded, bear/bare, to/too/two, see/sea…) share a `homophoneGroup` tag and their sentences must clearly distinguish them. |
| R-WRD-8 | The library is static JSON shipped with the app; adding words requires no code changes. |

### 14.2 Schema

```ts
interface WordEntry {
  id: string;                 // stable, e.g. "easy-cat"; never reused for a different word
  word: string;               // /^[a-z]+$/
  level: 'easy' | 'medium' | 'hard';
  grade: 'K' | '1' | '2' | '3' | '4' | '5';
  sentence: string;           // contains `word` exactly once (case-insensitive, whole word)
  homophoneGroup?: string;    // e.g. "bear-bare"
}
```

Stored as `src/data/words.json` (or one file per level), validated at build time.

### 14.3 Validation script (must)

A script (`npm run validate:words`, also run in CI/build) fails the build if any of these are violated: schema; unique `id`; unique `word` per level; `word` matches `/^[a-z]+$/`; `level` consistent with `grade`; sentence length 5–14 words; sentence contains the word exactly once as a whole word; homophone groups have ≥2 members; per-level counts within ±15% of 500. It should also print a blocklist report of any word/sentence containing terms from a maintained denylist, for human review.

---

## 15. Engineering requirements

| ID | Requirement |
|---|---|
| R-ENG-1 | Pure game logic (scoring, tries, queue, selection, reward rules, voice selection heuristic) lives outside React components and has **Vitest** unit tests. |
| R-ENG-2 | Persistence behind a repository interface so storage can be swapped or mocked in tests. |
| R-ENG-3 | A Playwright smoke test should cover: create profile → complete a lesson (with a mocked speech provider) → earn a panda → see it in the Panda Book. |
| R-ENG-4 | `README.md` covers local dev, scripts, word-library editing, and Vercel deployment. |
| R-ENG-5 | Suggested structure: `src/game/` (logic), `src/speech/`, `src/storage/`, `src/world/` (3D), `src/ui/` (screens, keyboard), `src/data/` (words, names), `src/audio/` (Web Audio sfx). |

---

## 16. Milestones and acceptance criteria

Each milestone must be playable and deployable to Vercel.

### M1 — Core lesson loop
- Profiles (create/select, max 4) with a placeholder avatar; IndexedDB persistence.
- Difficulty picker; 10-word lesson using a small seed word list (~30 per level).
- Speech provider (Web Speech) with auto voice selection, hear-again, sentence hint; Easy 3-second flash from speech start.
- QWERTY in-app keyboard; native keyboard never opens on touch; physical keyboard works.
- Tries/reveal/scoring/stars/results per §4; missed queue and selection per §5.
- **Accept when**: all §4–§7 requirements pass on an iPhone and an Android phone; unit tests for selection, queue and scoring pass.

### M2 — Full word library
- ~1,500 words with sentences and homophone tags per §14; validation script in the build.
- **Accept when**: validation passes; a human spot-check of a random 10% sample finds no content or ambiguity issues.

### M3 — Island and pandas
- Procedural island and pandas (§9), all animations and tap reactions.
- Rewards (8/10 panda, 10/10 golden), colour + naming flows, random names, arrival camera zoom.
- Starter panda on profile creation (replacing the M1 placeholder avatar).
- Panda Book with island cap and swap behaviour.
- Adaptive performance (§10).
- **Accept when**: 60 fps on an iPhone 11-class device with 12 pandas; quality steps down gracefully on a low-end Android device; all §8–§10 requirements pass.

### M4 — Polish and release
- Web Audio sound effects and optional ambient audio; mute toggle.
- Parent area with hold-to-open gear (§11).
- PWA: manifest, icons, offline precache, install guidance, `storage.persist()`.
- Transition and animation polish pass; reduced-motion support.
- **Accept when**: app installs to the Home Screen on iOS and Android, works in airplane mode after first load, and the Playwright smoke test passes.

---

## 17. Future (not v1, design should not preclude)

- Pre-generated high-quality voice audio (ElevenLabs or similar) via a new `SpeechProvider`.
- Day/night lighting following local time, with sleeping pandas and fireflies at night.
- Additional locales (UK/AU spelling and voices).
- Unlockable world items.
