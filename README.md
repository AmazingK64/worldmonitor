# World Monitor

**A personal entertainment app for browsing media news, trending stories, and map-based story highlights.**

[中文说明](./README.zh-CN.md)

![World Monitor Dashboard](docs/images/worldmonitor-7-mar-2026.jpg)

---

## Overview

World Monitor is adapted here as a lightweight personal entertainment project. It is designed for casually exploring media news, checking what is trending, and using AI to turn large amounts of information into easier short-form reading.

This version focuses on:

- browsing media-related news feeds for leisure reading
- discovering trending topics and story clusters
- generating short AI summaries and speculative trend notes
- exploring story locations on a map for a more visual experience
- running locally for personal use and experimentation

---

## Personal Entertainment Features

- **News feed browsing** for press, broadcasting, entertainment, and digital platform updates
- **AI short summaries** for faster reading
- **Trend spotting** to surface themes that are becoming active
- **Map interaction** for viewing story locations in a more visual way
- **Local AI support** with Ollama for personal experimentation
- **Desktop support** through Tauri 2 on macOS, Windows, and Linux

---

## Quick Start

```bash
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

To run the entertainment-oriented media variant:

```bash
npm run dev:media
```

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| Frontend | Vanilla TypeScript, Vite, globe.gl + Three.js, deck.gl + MapLibre GL |
| Desktop | Tauri 2 with Node.js sidecar |
| AI | Ollama / Groq / OpenRouter, Transformers.js |
| API | Protocol Buffers, sebuf HTTP annotations |
| Deployment | Vercel Edge Functions, Railway relay, Tauri, PWA |
| Caching | Redis, CDN, service worker |

---

## Local Development

```bash
npm run typecheck
npm run build:full
```

Use `npm run typecheck` to verify types and `npm run build:full` to confirm the project still builds correctly.
