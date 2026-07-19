# Focus Timer
A simple, ad-free focus timer for deep work, focus sessions, and concentration practice — built on the same design and interaction patterns as [Workout Timer](https://github.com/elinhaggberg/workout-timer). Randomized to-do lists are coming in a follow-up pass. All data stays on your device.

## Features

- **Home Screen** — two quick-start cards (Set focus timer / Create to-do list) and a saved-activities list.
- **Focus timer**
  - **Pomodoro** tab: classic Focus/Short Break cycle with an editable rounds counter, draggable interval grips, and an optional Long Break.
  - **Custom** tab: build your own sequence of intervals and sets, just like Workout Timer's editor.
  - **Activities**: tag a timer with a color-matched icon (Read, Study, Write, Chores, Clean, or your own) from a Font Awesome icon library, shown during the play screen.
  - Play screen with a countdown ring, sound toggle, and a confetti finish screen.
- Light/dark theme that follows the system by default.
- Installable as a PWA (offline-capable, home-screen icon).

## Tech

Vanilla HTML/CSS/JS — no build step, no framework, no server. Everything is stored in `localStorage`.

## License

[GNU AGPL-3.0](LICENSE). Free to use, copy, and modify — but any version you distribute or run as a hosted service has to stay open source too.
