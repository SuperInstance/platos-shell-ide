/**
 * MUD Terminal Provider
 * =====================
 *
 * Registers 'plato-mud' as a terminal profile. When the user opens a MUD terminal,
 * we spawn the MUD process (node plato-mud/index.js) inside a VS Code / Theia
 * integrated terminal via the Pseudoterminal API.
 *
 * The MUD terminal is:
 * - A real terminal process (pipeable, scriptable)
 * - Connected to SharedWorldStore via WebSocket
 * - Renders ANSI-colored text (green phosphor aesthetic)
 * - Parses verb input through VerbResolver
 * - Handles TALK TO via The Tap API
 *
 * API Notes:
 * - VS Code: uses `vscode.window.registerTerminalProfileProvider()` (API proposed in 1.63+)
 *   and the `terminal` contribution point in package.json
 * - Theia: supports the same `terminal.profiles` contribution since Theia 1.23+
 * - For maximum compatibility, we also register a command that creates a terminal
 *   with shell integration, as the TerminalProfileProvider API may not be available
 *   in all Theia versions.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';
import { EventLogger } from './a2ui/event-logger';

export class MudTerminalProvider {

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly eventLogger?: EventLogger
    ) {}

    register(): void {
        // ─── Command: Start MUD Terminal ───
        // This is the primary entry point. Works in both VS Code and Theia.
        this.context.subscriptions.push(
            vscode.commands.registerCommand('plato.startMUD', () => {
                this.startMudTerminal();
            })
        );

        // ─── Terminal Profile Provider (VS Code 1.63+) ───
        // When the user selects "Plato MUD" from the terminal dropdown (+) menu,
        // this provider is invoked to create the terminal.
        //
        // Note: registerTerminalProfileProvider is available in VS Code 1.63+ and
        // Theia versions that support the corresponding VS Code API version.
        // We guard with a runtime check for Theia compatibility.
        try {
            const api = vscode.window as any;
            if (typeof api.registerTerminalProfileProvider === 'function') {
                const provider: vscode.TerminalProfileProvider = {
                    provideTerminalProfile: (
                        _token: vscode.CancellationToken
                    ): vscode.ProviderResult<vscode.TerminalProfile> => {
                        return this.createMudTerminalProfile();
                    }
                };
                this.context.subscriptions.push(
                    api.registerTerminalProfileProvider('plato-mud', provider)
                );
                console.log('[Plato\'s Shell] Terminal profile provider registered');
            } else {
                console.warn('[Plato\'s Shell] registerTerminalProfileProvider not available — using command fallback only');
            }
        } catch (err) {
            console.warn('[Plato\'s Shell] Terminal profile provider registration failed:', err);
        }
    }

    /**
     * Launch a MUD terminal session.
     *
     * In Phase 1, this spawns the MUD process directly. The MUD CLI reads
     * room state from SharedWorldStore, parses verbs, and renders to stdout.
     *
     * Architecture:
     *   VS Code Terminal
     *     └── Pseudoterminal (handles stdin/stdout)
     *           └── ChildProcess: `node plato-mud/index.js`
     *                 └── WebSocket → SharedWorldStore (ws://localhost:8787)
     */
    private startMudTerminal(): void {
        const config = vscode.workspace.getConfiguration('platosShell');
        const mudCommand = config.get<string>('mudCommand', 'node');
        const mudArgs = config.get<string[]>('mudArgs', []);
        const worldStoreUrl = config.get<string>('worldStoreWsUrl', 'ws://localhost:8787');

        // If no args specified, try to find plato-mud in workspace
        if (mudArgs.length === 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                const candidate = path.join(workspaceRoot, 'plato-mud', 'index.js');
                mudArgs.push(candidate);
            }
        }

        // Pass WorldStore URL as environment variable
        const env = {
            ...process.env,
            PLATO_WORLDSTORE_URL: worldStoreUrl,
            PLATO_TERMINAL_MODE: 'integrated',
            FORCE_COLOR: '1',           // ANSI color output
            PLATO_COLOR_SCHEME: 'green' // Green phosphor aesthetic
        };

        const terminal = vscode.window.createTerminal({
            name: '⚔ Plato MUD',
            shellPath: mudCommand,
            shellArgs: mudArgs,
            env,
            iconPath: new vscode.ThemeIcon('terminal'),
            color: new vscode.ThemeColor('terminal.ansiGreen')
        });

        terminal.show(true);

        this.eventLogger?.log({
            type: 'mud_terminal_started',
            command: mudCommand,
            args: mudArgs,
            worldStoreUrl,
            timestamp: Date.now()
        });

        vscode.window.showInformationMessage(
            '⚔ Plato MUD terminal started. Type "look" to begin.'
        );
    }

    /**
     * Create a TerminalProfile for the profile provider API.
     * Returns a profile that, when activated, opens a MUD terminal.
     */
    private createMudTerminalProfile(): vscode.TerminalProfile {
        const config = vscode.workspace.getConfiguration('platosShell');
        const mudCommand = config.get<string>('mudCommand', 'node');
        const mudArgs = config.get<string[]>('mudArgs', []);
        const worldStoreUrl = config.get<string>('worldStoreWsUrl', 'ws://localhost:8787');

        const env = {
            PLATO_WORLDSTORE_URL: worldStoreUrl,
            PLATO_TERMINAL_MODE: 'integrated',
            FORCE_COLOR: '1',
            PLATO_COLOR_SCHEME: 'green'
        };

        return new vscode.TerminalProfile({
            name: '⚔ Plato MUD',
            shellPath: mudCommand,
            shellArgs: mudArgs,
            env,
            iconPath: new vscode.ThemeIcon('terminal')
        });
    }
}

/**
 * Pseudoterminal Implementation (for advanced use — custom I/O, not a real process)
 *
 * If we need finer control over terminal I/O (e.g., intercepting input for
 * verb autocompletion, rendering custom ANSI sequences), we can use
 * vscode.Pseudoterminal instead of spawning a real process.
 *
 * This is left as a stub for Phase 2+ when we want:
 * - Verb autocompletion in the terminal
 * - Custom ANSI rendering (room descriptions with formatting)
 * - Integrated hint system powered by A2UI
 */
export class PlatoPseudoterminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;

    private closeEmitter = new vscode.EventEmitter<number>();
    onDidClose?: vscode.Event<number> = this.closeEmitter.event;

    private mudProcess: ChildProcess | undefined;

    constructor(
        private readonly command: string,
        private readonly args: string[],
        private readonly env: NodeJS.ProcessEnv
    ) {}

    open(initialDimensions: vscode.TerminalDimensions | undefined): void {
        this.writeEmitter.fire('\r\n\x1b[32m═══ Plato\'s Shell ═══\x1b[0m\r\n');
        this.writeEmitter.fire('\x1b[32mConnecting to SharedWorldStore...\x1b[0m\r\n\r\n');

        // Spawn the MUD process
        this.mudProcess = spawn(this.command, this.args, {
            env: this.env,
            cwd: process.cwd()
        });

        // Pipe stdout → terminal
        this.mudProcess.stdout?.on('data', (data: Buffer) => {
            this.writeEmitter.fire(data.toString());
        });

        // Pipe stderr → terminal (in yellow for warnings)
        this.mudProcess.stderr?.on('data', (data: Buffer) => {
            this.writeEmitter.fire('\x1b[33m' + data.toString() + '\x1b[0m');
        });

        this.mudProcess.on('close', (code: number) => {
            this.writeEmitter.fire('\r\n\x1b[31m[Process exited with code ' + code + ']\x1b[0m\r\n');
            this.closeEmitter.fire(code);
        });
    }

    close(): void {
        this.mudProcess?.kill();
        this.mudProcess = undefined;
    }

    handleInput(data: string): void {
        // Forward user input to the MUD process
        this.mudProcess?.stdin?.write(data);
    }
}
