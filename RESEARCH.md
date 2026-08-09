# Plato's Shell IDE — Research Findings

**Date:** 2026-08-09
**Researcher:** Lucineer (subagent)
**Subject:** Theia/VS Code extension architecture for Plato's Shell

---

## 1. Can Theia and VS Code Both Be Targeted with the Same Extension?

**Short answer: YES.** This is the recommended approach.

Eclipse Theia achieved full VS Code extension API compatibility as of Theia 1.43 (December 2023 milestone). The Theia project explicitly recommends authoring extensions using the VS Code extension API whenever possible, because:

1. **Same API surface:** Theia implements the `vscode` namespace API identically. Your `import * as vscode from 'vscode'` code works unchanged.
2. **Same package.json manifest:** The `contributes` section (views, commands, terminal profiles, configuration) is parsed identically.
3. **Same extension format:** `.vsix` packages work in both environments.
4. **Open VSX registry:** Theia uses Open VSX (not Microsoft Marketplace) for distribution, but the format is identical.

**Key differences to be aware of:**

| Aspect | VS Code | Theia |
|--------|---------|-------|
| Extension marketplace | Microsoft Marketplace | Open VSX Registry |
| Proprietary features | Live Share, Copilot, some remote dev | Not available |
| API version lag | Latest immediately | Slight delay (weeks-months) |
| Native extensions | N/A | Theia extensions (InversifyJS, deeper access) |
| Terminal profile API | Stable since 1.63 | Supported since ~1.40+ |
| Webview API | Stable since 1.25 | Supported since 1.23+ |
| Tree view API | Stable | Fully supported |

**Recommendation:** Build as a VS Code extension using the `vscode` API. It will work in both VS Code, Theia, Codespaces, and Gitpod. Only use Theia-native extensions if we need deep platform integration (custom widgets, InversifyJS DI).

---

## 2. How to Register a Custom Terminal Profile (for the MUD)

### VS Code / Theia API

Two approaches, both compatible across platforms:

#### Approach A: package.json Contribution (Simplest)

```json
{
  "contributes": {
    "terminal": {
      "profiles": [
        {
          "id": "plato-mud",
          "title": "Plato MUD",
          "icon": "terminal"
        }
      ]
    }
  }
}
```

This adds "Plato MUD" to the terminal dropdown (+ menu). When selected, VS Code looks for a registered `TerminalProfileProvider`.

#### Approach B: Programmatic Registration

```typescript
const provider: vscode.TerminalProfileProvider = {
    provideTerminalProfile(token): vscode.ProviderResult<vscode.TerminalProfile> {
        return new vscode.TerminalProfile({
            name: 'Plato MUD',
            shellPath: 'node',
            shellArgs: ['/path/to/plato-mud/index.js'],
            env: { PLATO_WORLDSTORE_URL: 'ws://localhost:8787' }
        });
    }
};
context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider('plato-mud', provider)
);
```

#### Approach C: Command Fallback (Most Compatible)

For maximum Theia compatibility (older versions), also register a command:

```typescript
vscode.commands.registerCommand('plato.startMUD', () => {
    const terminal = vscode.window.createTerminal({
        name: '⚔ Plato MUD',
        shellPath: 'node',
        shellArgs: ['plato-mud/index.js'],
        env: { PLATO_WORLDSTORE_URL: 'ws://localhost:8787' }
    });
    terminal.show();
});
```

**Our implementation:** Uses all three approaches — contribution point + provider + command fallback. See `src/mud-terminal-provider.ts`.

#### Advanced: Pseudoterminal for Custom I/O

If we need to intercept terminal I/O (for verb autocompletion, custom ANSI rendering), we can use `vscode.Pseudoterminal`:

```typescript
class PlatoPseudoterminal implements vscode.Pseudoterminal {
    onDidWrite = writeEmitter.event;
    onDidClose = closeEmitter.event;

    open() { /* spawn process, pipe stdout → writeEmitter */ }
    close() { /* kill process */ }
    handleInput(data: string) { /* forward to process stdin */ }
}

const term = vscode.window.createTerminal({
    name: 'Plato MUD',
    pty: new PlatoPseudoterminal()
});
```

**Use case:** Phase 2+ when we want verb autocompletion and custom rendering.

---

## 3. How to Add a Webview Panel (for ScummVM/Phaser Preview)

### VS Code / Theia API

```typescript
const panel = vscode.window.createWebviewPanel(
    'platoScummvmPreview',         // viewType
    '🎮 ScummVM Preview',           // title
    vscode.ViewColumn.Active,       // column
    {
        enableScripts: true,
        retainContextWhenHidden: true,
        portMapping: [{ webviewPort: 5173, extensionHostPort: 5173 }]
    }
);
panel.webview.html = `<iframe src="http://localhost:5173" style="width:100%;height:100%">`;
```

### Key Features for Our Use Case

1. **Iframe loading:** We can embed the Vite dev server URL directly in an iframe within the webview HTML. This is the simplest approach.

2. **Port forwarding:** In Codespaces/remote dev, VS Code automatically forwards ports. The `portMapping` option ensures the webview can reach localhost.

3. **Message passing:** Bidirectional communication between the extension and the webview via `postMessage`. The game (Phaser) can send events (hotspot clicks, room changes) that the extension forwards to A2UI.

4. **Retention:** `retainContextWhenHidden: true` keeps the game running when the user switches tabs — critical for a live game.

5. **Position:** The webview opens as an editor tab. Users can drag it to the right column for the IDE architecture's split layout. Alternatively, we can use `WebviewView` to place it in a sidebar panel.

### Alternative: Simple Browser

VS Code has a built-in "Simple Browser" command (`Simple Browser: Show`) that opens any URL in a preview tab. We could simply use `vscode.commands.executeCommand('simpleBrowser.show', 'http://localhost:5173')`. However, the custom webview gives us message passing and more control.

---

## 4. How to Create a Custom Tree View (Room/Object Inspector)

### VS Code / Theia API

```typescript
class RoomInspectorProvider implements vscode.TreeDataProvider<TreeNode> {
    onDidChangeTreeData = changeEmitter.event;

    getTreeItem(element): vscode.TreeItem { /* ... */ }
    getChildren(element?): TreeNode[] { /* ... */ }
}

vscode.window.registerTreeDataProvider('plato.roomInspector', provider);
```

Contributed in `package.json`:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "platos-shell",
        "title": "Plato's Shell",
        "icon": "media/plato-icon.svg"
      }]
    },
    "views": {
      "platos-shell": [{
        "id": "plato.roomInspector",
        "name": "Room Inspector"
      }]
    }
  }
}
```

### Our Implementation

The tree view shows:
- Room (expandable)
  - Objects (category)
    - Individual objects with verb children
  - Agents (category)
    - NPCs with dialogue verbs
  - Exits (category)
    - Clickable room transitions

Clicking a verb sends the command to the MUD terminal. Clicking an object opens its source file. See `src/room-inspector.ts`.

---

## 5. Status Bar Items

```typescript
const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
item.text = '$(home) Room: Bar-Rail';
item.tooltip = 'Current room';
item.command = 'plato.refreshInspector';
item.show();
```

Our implementation registers three status bar items:
- **Left:** Room name (synced from SharedWorldStore)
- **Left:** Active agent/NPC
- **Right:** A2UI indicator (sparkle icon)

---

## 6. Existing Game-IDE Integrations — Lessons Learned

### Unity + VS Code
- Microsoft's official extension provides IntelliSense, debugging, and code coloration
- Uses the C# Dev Kit + Roslyn for language server
- Key lesson: **tight integration with the game engine's build system is essential**

### Godot + VS Code
- Godot Tools extension provides GDScript LSP, scene tree debugger, shader syntax
- Can launch Godot editor from VS Code
- Key lesson: **scene tree visualization in the IDE helps navigate complex game hierarchies**

### Phaser + VS Code
- No official extension — Phaser projects use standard web tooling
- Live Server extension for preview (similar to our approach)
- Key lesson: **webview preview pointing at a dev server works well for HTML5 games**

### Codespaces Preview
- Simple Browser extension opens any URL in a preview panel
- Port forwarding handles connectivity transparently
- Key lesson: **the pattern of "dev server + iframe preview" is well-established**

---

## 7. Key API Differences: Theia Terminal vs VS Code Terminal

| Feature | VS Code | Theia |
|---------|---------|-------|
| `createTerminal()` | ✅ Full support | ✅ Full support |
| `TerminalProfileProvider` | ✅ Since 1.63 | ✅ Supported (VS Code compat) |
| `Pseudoterminal` | ✅ Full support | ✅ Supported |
| Terminal profiles in package.json | ✅ | ✅ |
| Shell integration | ✅ | ⚠️ Partial |
| Terminal reuse | ✅ | ⚠️ Partial |
| Custom terminal renderers | ✅ Proposed API | ❌ Not yet |

**Bottom line:** For our use case (spawn a process and pipe stdin/stdout), the API is identical. No workarounds needed.

---

## 8. Minimum Viable Extension for Phase 1

### What Phase 1 Needs (from IDE-ARCHITECTURE.md):
1. ✅ MUD terminal profile (register `plato-mud`)
2. ✅ ScummVM preview panel (webview loading localhost:5173)
3. ✅ Room/object inspector (tree view reading from workspace files)
4. ✅ Verb command palette
5. ✅ Status bar items

### What's Already Built:
All five items are scaffolded in `/src/`. The extension:
- Activates on workspace startup
- Registers a MUD terminal profile + command
- Opens a webview panel loading the Phaser dev server
- Shows a tree view of rooms, objects, agents, exits
- Has status bar indicators
- Logs all user actions via the A2UI event logger

### What's Needed to Make It Real:
1. **plato-mud CLI tool** — the actual MUD process (Node.js) that reads room state, parses verbs, renders ANSI text. This is a separate project at `platos-shell/plato-mud/`.
2. **SharedWorldStore WebSocket server** — syncs state between terminal and canvas.
3. **Room definitions** — JSON or TS files in `rooms/` that the inspector reads.
4. **Media assets** — icon for the activity bar (`media/plato-icon.svg`).

---

## 9. Recommended Phase 1 Implementation Path

```
Day 1 Morning:
├── Scaffold the extension (✅ done)
├── Create plato-mud CLI stub (separate package)
│   └── Connects to SharedWorldStore, reads room JSON, renders text
├── Create sample room definitions (rooms/bar-rail/room.json)
└── Test extension: F5 to launch Extension Development Host

Day 1 Afternoon:
├── Implement MUD terminal: real verb parsing (LOOK, TALK TO, GO)
├── Wire SharedWorldStore (even if just in-memory for Phase 1)
├── Test ScummVM preview with existing Phaser build
└── Verify tree view shows room structure from JSON

Day 2:
├── Hot-reload: saving a room JSON updates the inspector
├── Hot-reload: saving a Phaser scene updates the preview
├── Wire verb clicks → terminal → game response
├── Status bar syncs with game state
└── Package as .vsix and test in clean Theia instance
```

---

## 10. Summary

| Question | Answer |
|----------|--------|
| Can we target both VS Code and Theia? | **Yes** — write once as VS Code extension, works everywhere |
| Terminal profile for MUD? | **Yes** — package.json contribution + provider API |
| Webview for ScummVM preview? | **Yes** — iframe loading Vite dev server |
| Tree view for room inspector? | **Yes** — TreeDataProvider reading workspace files |
| Status bar items? | **Yes** — room, agent, A2UI indicators |
| Is anything hard? | **No** — all Phase 1 features use stable, well-documented APIs |
| Risk areas? | Theia API lag (minor), port forwarding in remote dev (handled by VS Code), webview security CSP (manageable) |

**Verdict: The architecture is sound and entirely buildable with today's APIs. Phase 1 is a 2-day effort as estimated.**
