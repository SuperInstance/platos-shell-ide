/**
 * ScummVM Preview Panel
 * =====================
 *
 * A webview panel that loads the Phaser/Three.js game canvas from the local
 * Vite dev server. This is the "ScummVM panel" from the IDE architecture —
 * the visual projection of the current room.
 *
 * How it works:
 * 1. The Phaser game runs as a Vite dev server (npm run dev → localhost:5173)
 * 2. This extension creates a webview panel that loads that URL
 * 3. Vite HMR hot-reloads on file save — the preview updates instantly
 * 4. SharedWorldStore syncs state between the MUD terminal and the Phaser canvas
 * 5. The inspector below the canvas shows selected hotspot info
 *
 * The webview can be positioned in the editor area (center split) or in a
 * side panel. For the architecture's right-panel layout, users drag the tab
 * to the rightmost column.
 *
 * Compatibility:
 * - VS Code: full webview API support since 1.25+
 * - Theia: webview support since 1.23+
 * - Codespaces: works via port forwarding (VS Code handles automatically)
 *   The webview loads the forwarded URL transparently.
 */

import * as vscode from 'vscode';
import { EventLogger } from './a2ui/event-logger';

export class ScummvmPreview {

    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly eventLogger?: EventLogger
    ) {}

    register(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('plato.openPreview', () => {
                this.openPreview();
            })
        );
    }

    /**
     * Open (or reveal) the ScummVM preview panel.
     *
     * The webview loads an iframe pointing at the Vite dev server.
     * We wrap it in a minimal HTML shell that also:
     * - Sends a heartbeat to keep the connection alive
     * - Listens for messages from the game (hotspot clicks, state changes)
     * - Forwards those messages back to the extension via postMessage
     */
    private openPreview(): void {
        const config = vscode.workspace.getConfiguration('platosShell');
        const previewUrl = config.get<string>('previewUrl', 'http://localhost:5173');

        // Reveal existing panel if we have one
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
            return;
        }

        // Create the webview panel in the editor area
        this.panel = vscode.window.createWebviewPanel(
            'platoScummvmPreview',
            '🎮 ScummVM Preview',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                enableForms: true,
                // Allow loading from localhost dev server
                localResourceRoots: [],
                // Enable content from the dev server
                portMapping: [
                    { webviewPort: 5173, extensionHostPort: 5173 }
                ],
                retainContextWhenHidden: true // Keep the game running when tab is not active
            }
        );

        // Set the HTML content — an iframe wrapper around the Vite dev server
        this.panel.webview.html = this.getWebviewHtml(previewUrl);

        // Handle messages from the webview (game events forwarded to extension)
        this.panel.webview.onDidReceiveMessage(
            (message) => this.handleGameMessage(message),
            undefined,
            this.context.subscriptions
        );

        // Clean up when panel is closed
        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
                console.log('[Plato\'s Shell] ScummVM preview panel disposed');
            },
            undefined,
            this.context.subscriptions
        );

        this.eventLogger?.log({
            type: 'preview_opened',
            url: previewUrl,
            timestamp: Date.now()
        });

        console.log(`[Plato\'s Shell] ScummVM preview opened: ${previewUrl}`);
    }

    /**
     * Generate the webview HTML.
     *
     * This creates a full-page iframe loading the Phaser game.
     * A lightweight script bridges postMessage between the iframe's game
     * and the VS Code extension host.
     */
    private getWebviewHtml(gameUrl: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ScummVM Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background: #0a0a0a;
        }
        #game-frame {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
        #loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #4ec9b0;
            font-family: 'Cascadia Code', 'Fira Code', monospace;
            font-size: 14px;
            text-align: center;
        }
        #loading .spinner {
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 2px solid #4ec9b033;
            border-top-color: #4ec9b0;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        #error {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #f44747;
            font-family: monospace;
            text-align: center;
            display: none;
        }
    </style>
</head>
<body>
    <div id="loading">
        <div class="spinner"></div><br>
        Connecting to ${gameUrl}...
    </div>
    <div id="error">
        <strong>⚠ Dev server not reachable</strong><br><br>
        Start the Phaser game server:<br>
        <code>npm run dev</code><br><br>
        Expected at: <code>${gameUrl}</code>
    </div>
    <iframe
        id="game-frame"
        src="${gameUrl}"
        allow="fullscreen; autoplay; gamepad; pointer-lock"
        onload="document.getElementById('loading').style.display='none'"
        onerror="showError()"
    ></iframe>
    <script>
        // Forward messages from the game iframe to the VS Code extension
        const vscode = acquireVsCodeApi();
        const frame = document.getElementById('game-frame');

        // Listen for messages from the game (if it uses postMessage)
        window.addEventListener('message', (event) => {
            // Forward game events to the extension host
            if (event.data && event.data.type) {
                vscode.postMessage(event.data);
            }
        });

        // Connection check — if iframe fails to load within 5s, show error
        setTimeout(() => {
            const frame = document.getElementById('game-frame');
            if (frame && document.getElementById('loading').style.display !== 'none') {
                showError();
            }
        }, 5000);

        function showError() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('error').style.display = 'block';
            document.getElementById('game-frame').style.display = 'none';
        }
    </script>
</body>
</html>`;
    }

    /**
     * Handle messages received from the game (via webview postMessage).
     *
     * These are game events like:
     * - hotspot_clicked: user clicked a hotspot in the canvas
     * - room_changed: player moved to a new room
     * - state_changed: a game object's state was modified
     *
     * We forward these to:
     * - The event logger (A2UI learning layer)
     * - The status bar (update room/agent indicators)
     */
    private handleGameMessage(message: any): void {
        console.log('[Plato\'s Shell] Game message:', message);

        switch (message.type) {
            case 'hotspot_clicked':
                this.eventLogger?.log({
                    type: 'hotspot_clicked',
                    hotspot: message.hotspot,
                    room: message.room,
                    timestamp: Date.now()
                });
                break;

            case 'room_changed':
                // Update status bar
                vscode.commands.executeCommand('plato.refreshInspector');
                this.eventLogger?.log({
                    type: 'room_changed',
                    room: message.room,
                    timestamp: Date.now()
                });
                break;

            case 'state_changed':
                this.eventLogger?.log({
                    type: 'game_state_changed',
                    target: message.target,
                    property: message.property,
                    newValue: message.value,
                    timestamp: Date.now()
                });
                break;
        }
    }

    /**
     * Programmatically close the preview panel.
     */
    dispose(): void {
        this.panel?.dispose();
        this.panel = undefined;
    }
}
