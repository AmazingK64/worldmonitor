# World Monitor

**一个用于浏览媒体资讯、热点内容和地图化新闻点位的个人娱乐应用。**

[English README](./README.md)

![World Monitor Dashboard](docs/images/worldmonitor-7-mar-2026.jpg)

---

## 项目简介

当前版本将 World Monitor 改造成一个偏个人娱乐方向的轻量应用，适合日常随手浏览媒体资讯、查看热点话题，并借助 AI 将大量信息整理成更容易阅读的短内容。

这个版本主要聚焦于：

- 以休闲浏览为目的查看媒体相关资讯流
- 发现正在升温的话题和内容聚合
- 生成简短 AI 摘要和趋势判断
- 结合地图查看新闻位置，让浏览更直观
- 支持本地运行，方便个人体验和折腾

---

## 个人娱乐功能

- **资讯流浏览**，覆盖新闻、广播、娱乐和数字平台动态
- **AI 简要摘要**，提升阅读效率
- **热点趋势发现**，帮助快速看到正在活跃的话题
- **地图交互浏览**，用更直观的方式查看新闻点位
- **本地 AI 支持**，可通过 Ollama 做个人化体验
- **桌面端支持**，基于 Tauri 2，支持 macOS、Windows 和 Linux

---

## 快速开始

```bash
git clone https://github.com/koala73/worldmonitor.git
cd worldmonitor
npm install
npm run dev
```

启动后访问 [http://localhost:5173](http://localhost:5173)。

如需启动个人娱乐方向的 media 变体：

```bash
npm run dev:media
```

---

## 技术栈

| 类别 | 技术 |
|----------|-------------|
| 前端 | Vanilla TypeScript、Vite、globe.gl + Three.js、deck.gl + MapLibre GL |
| 桌面端 | Tauri 2 + Node.js sidecar |
| AI | Ollama / Groq / OpenRouter、Transformers.js |
| API | Protocol Buffers、sebuf HTTP annotations |
| 部署 | Vercel Edge Functions、Railway relay、Tauri、PWA |
| 缓存 | Redis、CDN、service worker |

---

## 本地开发

```bash
npm run typecheck
npm run build:full
```

可使用 `npm run typecheck` 检查类型，使用 `npm run build:full` 验证项目是否可以正常构建。
