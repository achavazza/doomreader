# Doomreader 📖🌀

**Doomreader** is an experimental document reader (EPUB / DOC / long-form text) that rethinks reading through the lens of *doom scrolling*.

Instead of fighting the endless scroll habit, Doomreader embraces it, turning continuous scrolling into a focused, frictionless reading experience designed for mobile devices and long sessions.

The project is built as a **Progressive Web App (PWA)**, meaning it works offline, can be installed, and is optimized for performance and daily use.


## 💡 Inspiration

Doomreader is inspired by [xikipedia.org](https://xikipedia.org), a project that reimagines Wikipedia as an infinite, scroll-based reading experience.

Xikipedia demonstrates how continuous scrolling can transform the way long-form content is consumed, making deep reading feel more natural and less fragmented.

Doomreader builds on this idea and applies it to personal libraries, documents, and books, extending the concept into an offline-first, installable reading app.


---

## ✨ Concept

- Continuous vertical reading
- Content split into readable blocks (chunks)
- Bookmark navigation
- No traditional pagination
- Mobile-first approach


## 🎮 Gamification (Planned)

Doomreader will gradually introduce light gamification elements to encourage consistent reading without turning it into a distraction.

The goal is not competition or pressure, but motivation, rhythm, and habit-building.

Planned ideas include:

- 🧩 **Reading streaks**  
  Track consecutive reading days and long scroll sessions.

- 📊 **Progress milestones**  
  Visual markers for completed chapters, sections, or scroll depth.

- 🏆 **Achievements & badges**  
  Rewards for finishing books, reading sessions, or maintaining streaks.


---

## 🧱 Tech Stack

- **Vue 3** — Main framework
- **Vite** — Build tool and dev environment
- **Pinia** — State management
- **Tailwind CSS** — Styling and layout
- **IndexedDB (idb)** — Local persistence for books, progress, and preferences
-- **Virtua**  — Virtual Scroller https://github.com/inokawa/virtua
- **PWA** — Offline support and installability

---

## 🚀 Key Features

- 📚 EPUB / DOC import (work in progress)
- 🔄 Doom-scroll style infinite reading
- 💾 Automatic reading progress saving
- 📱 Installable as an app (PWA)
- ⚡ Fast loading and offline usage
- 🎨 Minimal UI focused on readability

---

## 🛠️ Project Setup

Install dependencies:

```sh
npm install
