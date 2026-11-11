# Panda World Spelling

Panda World Spelling is a spelling game for young children. A child hears a word, types it on an on-screen keyboard, and gets a sentence hint if they need one. Each lesson has 10 words across three levels: Easy, Medium and Hard. Every 8 or 10 correct answers earns a panda for the child's island. The app is a Progressive Web App (PWA). It works offline after the first load and can be added to a home screen.

## Local development

Requirements: Node.js 20 or later.

```sh
npm install
npm run dev
```

Open the URL that Vite prints (usually http://localhost:5173).

## Scripts

| Script                   | What it does                                                  |
| ------------------------ | ------------------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server with hot reload.                    |
| `npm run build`          | Validate the word library, type-check, then build to `dist/`. |
| `npm run preview`        | Serve the built `dist/` folder locally.                       |
| `npm run lint`           | Run ESLint.                                                   |
| `npm run format`         | Format the project with Prettier.                             |
| `npm run typecheck`      | Run the TypeScript compiler in build mode.                    |
| `npm run validate:words` | Check the word library files.                                 |

## Editing the word library

Words live in three files:

- `src/data/words/easy.json`
- `src/data/words/medium.json`
- `src/data/words/hard.json`

Each file is a JSON array of entries. An entry looks like this:

```json
{
  "id": "easy-cat",
  "word": "cat",
  "level": "easy",
  "grade": "K",
  "sentence": "The cat sleeps on the soft green rug.",
  "homophoneGroup": "optional-tag"
}
```

- `id` must be unique and never reused for a different word.
- `word` uses lowercase letters a to z only. No capitals, names, contractions or hyphens.
- `level` is `easy`, `medium` or `hard`. `grade` must match the level: Easy uses K or 1, Medium uses 2 or 3, Hard uses 4 or 5.
- `sentence` has 5 to 14 words. It must use the word exactly once, in the same form.
- `homophoneGroup` is optional. Words that sound the same (for example bear and bare) share a tag. Each tag needs at least two words, and their sentences must make the meaning clear.

Content rules (from the spec, section 14):

- Use family-friendly words and sentences only.
- Do not use heteronyms (words spelled the same but said differently, such as read, lead or wind).
- Do not include words with two accepted US spellings (such as gray and grey).
- Each level should hold about 500 words.

After you edit a file, run:

```sh
npm run validate:words
```

The script fails if a rule is broken. It also prints a list of words that may need a human check. Check those by hand.

## Project structure

```
src/
  game/     Game logic: scoring, tries, word queue, rewards
  speech/   Text-to-speech providers and voice choice
  storage/  Saved profiles and progress (IndexedDB)
  world/    3D island and pandas (react-three-fiber)
  ui/       Screens and the on-screen keyboard
  data/     Word library and name lists
  audio/    Sound effects (Web Audio)
public/     Icons and other static files
scripts/    Build-time checks (word validator)
```

## Testing without speech

Add `?mockSpeech=1` to the URL, for example `http://localhost:5173/?mockSpeech=1`. The app then uses a mock speech provider instead of the browser's voices. This is useful on desktops or in automated tests.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, choose **Add New Project** and import the GitHub repository.
3. Set **Framework Preset** to **Vite**.
4. Set **Build Command** to `npm run build`.
5. Set **Output Directory** to `dist`.
6. Click **Deploy**.

The file `vercel.json` already sets the single-page app rewrite and the no-cache header for `sw.js`.

## Install on a phone

**iPhone (Safari):** open the app, tap the Share button, then tap **Add to Home Screen**.

**Android (Chrome):** open the app, tap the menu (three dots), then tap **Install app** or **Add to Home screen**.

Installing the app helps keep the child's progress safe on the device.
