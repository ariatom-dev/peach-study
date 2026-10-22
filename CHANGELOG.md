# Changelog

## Section 1 — Theme & foundation
- Charcoal / cream theme with System, Cream (light) and Charcoal (dark) modes; saved per device, no flash on load.
- Newsreader (serif) + Inter (UI labels) via Google Fonts, cached by the service worker for offline.
- Cloud sign-in is now optional (Settings → Account). The app opens straight to your library.
- Phone-first layout: bottom tab bar, safe-area support for the home-screen app, back-swipe works (hash routes).
- New charcoal/cream app icon. Cloud sync only pushes decks that actually changed.
- No new npm dependencies.

## Section 2 — Study modes
- Study screen with two modes: **Scroll** (term + definition on one screen, swipe/scroll for the next, snap-scrolling) and **Cards** (tap-to-flip flashcards, swipe or arrows).
- "I know this" and "Save" on every card (kept with the deck, so they sync). Filters: All / Saved / To learn, plus Shuffle.
- "Hide definitions" option for the scroll mode (tap to reveal). Remembers your last position per set.
- Keyboard: arrows to move, Space to flip/reveal, S to save, M to mark known.
