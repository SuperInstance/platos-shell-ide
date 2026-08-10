# Plato's Shell IDE

**The IDE is the ship. The MUD is the terminal. The ScummVM is the canvas.**

A VS Code / Eclipse Theia extension that integrates a text-adventure MUD engine, a ScummVM-style game renderer, a room inspector, and an adaptive learning layer (A2UI) into a single development environment.

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

## Components

### 1. MUD Terminal (`mud-terminal-provider.ts`)
- Registers "Plato MUD" as a custom terminal profile
- Spawns the MUD process inside a VS Code integrated terminal
- Green phosphor ANSI aesthetic
- Connects to SharedWorldStore via WebSocket
- Parses verb input through VerbResolver
- Includes Pseudoterminal stub for Phase 2 (verb autocompletion, custom ANSI rendering)

### 2. ScummVM Preview (`scummvm-preview.ts`)
- Webview panel showing the game's visual rendering
- Connects to the Phaser dev server
- Live preview of the current room

### 3. Room Inspector (`room-inspector.ts`)
- Tree view showing the game world state
- Lists rooms, objects, NPCs, and exits
- Click to navigate or inspect

### 4. A2UI Event Logger (`a2ui/event-logger.ts`)
- Records all user actions (verbs, navigation, clicks)
- Feeds the adaptive learning layer
- The "nervous system that learns"

## Commands

| Command | Description |
|---------|-------------|
| `Plato: Start MUD Terminal` | Opens a MUD terminal session |
| `Plato: Execute Verb` | Quick-pick verb selector |
| `Plato: Show A2UI Status` | Shows event logger status |

## Configuration

```json
{
  "platosShell.mudCommand": "node",
  "platosShell.mudArgs": ["plato-mud/index.js"],
  "platosShell.worldStoreWsUrl": "ws://localhost:8787",
  "platosShell.a2uiEnabled": true
}
```

## Requirements

- VS Code 1.63+ or Eclipse Theia 1.43+
- Node.js and a running MUD engine
- SharedWorldStore WebSocket server

## Development

```bash
npm install
npm run compile  # TypeScript → out/
```

Press F5 in VS Code to launch an Extension Development Host with the extension loaded.

## Relationship to the Fleet

- **SharedWorldStore** — Central game state server
- **plato-mud** — The MUD engine itself
- **Plato's Shell** — The vessel this IDE serves
- **ScummVM** — The rendering layer for the game world

## Status

Early stage (v0.1.0). Research complete (see RESEARCH.md), core architecture implemented, not yet tested or deployed.
