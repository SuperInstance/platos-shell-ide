# Plato's Shell IDE — Source

1,305 lines of TypeScript across 6 files. The complete extension.

## Structure

```
src/
├── extension.ts                 — Entry point: registers all components
├── mud-terminal-provider.ts     — MUD terminal profile (custom terminal)
├── scummvm-preview.ts           — ScummVM preview panel (webview)
├── room-inspector.ts            — Game world tree view (activity bar)
└── a2ui/
    ├── event-log-core.ts        — Pure event logging logic (testable)
    └── event-logger.ts          — VS Code event hooks wrapping EventLogCore
```

## Key Abstractions

- `MudTerminalProvider` — Registers the "Plato MUD" terminal profile, spawns the MUD process
- `ScstubPreview` → `ScummvmPreview` — Webview panel loading Phaser dev server with HMR
- `RoomInspectorProvider` — TreeDataProvider rendering the game world as a navigable tree
- `EventLogCore` — Pure event logging with batching, flush intervals, and JSONL persistence
- `EventLogger` — VS Code hooks wrapping EventLogCore (file opens, saves, terminal events, cursor moves)

## Architecture Principles

1. **Real VS Code APIs, not simulations.** The terminal is a real terminal profile. The preview is a real webview. The inspector is a real tree view.
2. **A2UI is separable.** EventLogCore has zero VS Code deps — it's pure TypeScript, testable in isolation.
3. **Dual compatibility.** Every API used works in both VS Code 1.85+ and Eclipse Theia 1.43+.
4. **Lazy activation.** Components start only when needed (`onStartupFinished` for A2UI, command-triggered for the rest).

## Related

- [Plato's Shell IDE README](../README.md)
- [Research findings](../RESEARCH.md)
- [Tests](../tests/)
