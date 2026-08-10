# 🐚 Plato's Shell IDE

> *The IDE is the ship. The MUD is the terminal. The ScummVM is the canvas. A2UI is the nervous system that learns.*

A VS Code / Eclipse Theia extension that turns the IDE into a game world. The MUD terminal is a real terminal. The ScummVM preview is a real webview. The room inspector is a real tree view. The A2UI event logger records every action to learn the user's habits. The shell doesn't wait to be found — it grows around you.

**Repo:** [SuperInstance/platos-shell-ide](https://github.com/SuperInstance/platos-shell-ide)
**Version:** 0.1.0 · **VS Code:** 1.85+ · **Theia:** 1.43+ · **Open VSX:** Compatible

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code / Theia                       │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  MUD     │  │  ScummVM     │  │  Room Inspector  │  │
│  │  Terminal│  │  Preview     │  │  (Tree View)     │  │
│  │  Profile │  │  (Webview)   │  │                  │  │
│  └────┬─────┘  └──────┬───────┘  └────────┬─────────┘  │
│       │                │                    │            │
│       └────────────────┼────────────────────┘            │
│                        │                                 │
│                ┌───────┴────────┐                        │
│                │  A2UI Event    │                        │
│                │  Logger        │                        │
│                └────────────────┘                        │
└─────────────────────────────────────────────────────────┘
         │
         ▼
  SharedWorldStore (WebSocket)
```

---

## Components

### 1. MUD Terminal — [`src/mud-terminal-provider.ts`](./src/mud-terminal-provider.ts)
Registers "Plato MUD" as a custom terminal profile. Spawns the MUD process inside a VS Code integrated terminal. Green phosphor ANSI aesthetic. Connects to SharedWorldStore via WebSocket. Parses verb input through VerbResolver.

### 2. ScummVM Preview — [`src/scummvm-preview.ts`](./src/scummvm-preview.ts)
Webview panel showing the game's visual rendering. Connects to the Phaser dev server. Vite HMR hot-reloads on file save — the preview updates instantly. No alt-tab between building the world and standing inside it.

### 3. Room Inspector — [`src/room-inspector.ts`](./src/room-inspector.ts)
Tree view in the activity bar sidebar showing the game world hierarchy: rooms, objects, agents, exits. Click a verb to execute it in the MUD. Click an object to open its source file. Click an exit to navigate.

```
🏠 Bar-Rail (current room)
  📦 Objects
    🎵 Jukebox [playing]
    🚪 Door (Aft Deck) [closed]
  🤖 Agents
    👤 Riker [idle]
  📜 Exits
    → aft-deck
    → radio-room
```

### 4. A2UI Event Logger — [`src/a2ui/`](./src/a2ui/)
The observation layer of the Agent-to-UI learning system. Records all user actions within the IDE:

- Which verbs the user uses most → predictive verb highlighting
- Which files they open after playing a room → smart file navigation
- Navigation patterns between MUD/editor/preview → workflow optimization
- Error patterns (failed verbs, broken hotspots) → debugging hints
- Timing patterns (reading time, edit time) → UI pacing

```
User Action → Event Logger → Event Log (JSONL)
                                 ↓
                           A2UI Model (Phase 4)
                                 ↓
                           UI Adaptation
                                 ↓
                           New User Actions
                                 ↓
                           (feedback loop)
```

---

## Commands

| Command | Description |
|---------|-------------|
| `Plato: Start MUD Terminal` | Opens a MUD terminal session |
| `Plato: Open ScummVM Preview` | Opens the game preview webview |
| `Plato: Refresh Room Inspector` | Refreshes the tree view |
| `Plato: Execute Verb` | Quick-pick verb selector |
| `Plato: Show A2UI Status` | Shows event logger statistics |

## Configuration

```json
{
  "platosShell.mudCommand": "node",
  "platosShell.mudArgs": ["plato-mud/index.js"],
  "platosShell.previewUrl": "http://localhost:5173",
  "platosShell.worldStoreWsUrl": "ws://localhost:8787",
  "platosShell.a2uiEnabled": true
}
```

---

## Development

```bash
npm install
npm run compile    # TypeScript → out/
npm test           # Jest tests
```

Press **F5** in VS Code to launch an Extension Development Host with the extension loaded.

---

## Fleet Connections

The IDE IS the shell — and it connects to the entire fleet:

- **→ [platos-shell](https://github.com/SuperInstance/platos-shell)** — The shell pattern this IDE implements
- **→ [forgemaster](https://github.com/SuperInstance/forgemaster)** — The grimoire/forge that builds worlds the IDE renders
- **→ [mud-engine](https://github.com/SuperInstance/mud-engine)** — The MUD engine the terminal connects to
- **→ [officers-quarters](https://github.com/SuperInstance/officers-quarters)** — The Phaser game client the preview renders
- **→ [scummvm-arcade](https://github.com/SuperInstance/scummvm-arcade)** — The game schemas and sync engine
- **→ [the-tap](https://github.com/SuperInstance/the-tap)** — The agentic bar (TALK TO routes through Tap API)
- **→ [spatial-registry](https://github.com/SuperInstance/spatial-registry)** — Room topology for the inspector
- **→ [fleet-connections](https://github.com/SuperInstance/fleet-connections)** — Integration keel wires the SharedWorldStore
- **→ [fleet-wiki](https://github.com/SuperInstance/fleet-wiki)** — Documentation for the world the IDE serves
- **→ [cns-bridge](https://github.com/SuperInstance/cns-bridge)** — CNS signals for agent communication
- **→ [hermes-perception](https://github.com/SuperInstance/hermes-perception)** — Sensory data feeds
- **→ [collective-unconscious](https://github.com/SuperInstance/collective-unconscious)** — Shared memory substrate
- **→ [fleet-envelope](https://github.com/SuperInstance/fleet-envelope)** — Event grammar
- **→ [AI-Writings](https://github.com/SuperInstance/AI-Writings)** — The creative corpus behind the world
- **→ [voxel-logic](https://github.com/SuperInstance/voxel-logic)** — 3D spatial reasoning for room placement

---

## The Hermit Crab Connection

The hermit crab doesn't find this shell — the shell grows around it. The A2UI event logger watches how you work: which verbs you use, which rooms you visit, which files you open. Over time, the IDE adapts: predictive verb highlighting, smart file navigation, room-specific autocomplete. The shell becomes a habitat.

See: [mud-engine](https://github.com/SuperInstance/mud-engine) (hermit-crab package) → [the-tap](https://github.com/SuperInstance/the-tap) → [platos-shell](https://github.com/SuperInstance/platos-shell) → **platos-shell-ide** → [AI-Writings](https://github.com/SuperInstance/AI-Writings/tree/main/prose).

---

## The Mirror Connection

The IDE is also The Mirror — [zeroclaw](https://github.com/SuperInstance/zeroclaw)'s dark twin. Where zeroclaw reflects the agent back at itself, the A2UI logger reflects the *developer* back at themselves. Both are observation systems. Both learn by watching.

---

## Research

- [`RESEARCH.md`](./RESEARCH.md) — Full research findings on VS Code/Theia extension architecture, terminal profile API, webview compatibility, and dual-platform deployment strategy

---

## Status

**v0.1.0** — Research complete, core architecture implemented (1,305 lines across 6 source files), not yet deployed to Open VSX. Phase 1 of A2UI (raw logging). See [RESEARCH.md](./RESEARCH.md) for the full roadmap.

### A2UI Phasing

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Implemented | Raw event logging |
| 2 | Planned | Basic statistics (most-used verbs, most-visited rooms) |
| 3 | Planned | Local model for predictions |
| 4 | Planned | Full adaptive UI |

---

## License

MIT © SuperInstance
