/**
 * Plato's Shell IDE — Extension Entry Point
 * =========================================
 *
 * The IDE is the ship. The MUD is the terminal. The ScummVM is the canvas.
 * A2UI is the nervous system that learns.
 *
 * This extension registers:
 * 1. MUD terminal profile (plato-mud) — the game as an integrated terminal
 * 2. ScummVM preview panel — webview pointing at the Phaser dev server
 * 3. Room/object inspector — tree view showing game world state
 * 4. A2UI event logger — records all user actions for the learning layer
 */

import * as vscode from 'vscode';
import { MudTerminalProvider } from './mud-terminal-provider';
import { ScummvmPreview } from './scummvm-preview';
import { RoomInspectorProvider } from './room-inspector';
import { EventLogger } from './a2ui/event-logger';

let eventLogger: EventLogger | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Plato\'s Shell] Extension activating...');

    const config = vscode.workspace.getConfiguration('platosShell');

    // ─── 1. A2UI Event Logger (activate first — it watches everything) ───
    const a2uiEnabled = config.get<boolean>('a2uiEnabled', true);
    if (a2uiEnabled) {
        eventLogger = new EventLogger(context);
        eventLogger.start();
        console.log('[Plato\'s Shell] A2UI event logger started');
    }

    // ─── 2. MUD Terminal Provider ───
    const mudProvider = new MudTerminalProvider(context, eventLogger);
    mudProvider.register();

    // ─── 3. ScummVM Preview Panel ───
    const preview = new ScummvmPreview(context, eventLogger);
    preview.register();

    // ─── 4. Room Inspector (Tree View) ───
    const inspectorProvider = new RoomInspectorProvider(context, eventLogger);
    inspectorProvider.register();

    // ─── Status Bar Items ───
    registerStatusBarItems(context);

    // ─── Verb Command (Ctrl+Shift+P → "Plato: Execute Verb") ───
    context.subscriptions.push(
        vscode.commands.registerCommand('plato.executeVerb', async () => {
            const verb = await vscode.window.showQuickPick(
                ['LOOK', 'LOOK AT', 'TALK TO', 'USE', 'PICK UP', 'OPEN', 'CLOSE', 'PUSH', 'PULL', 'GIVE'],
                { placeHolder: 'Select a verb to execute...' }
            );
            if (!verb) return;

            // Send to active MUD terminal if one exists
            const activeTerminal = vscode.window.activeTerminal;
            if (activeTerminal && activeTerminal.name.includes('Plato MUD')) {
                activeTerminal.sendText(verb.toLowerCase());
            } else {
                vscode.window.showWarningMessage('No active Plato MUD terminal. Start one with "Plato: Start MUD Terminal".');
            }

            eventLogger?.log({
                type: 'verb_executed',
                verb,
                timestamp: Date.now()
            });
        })
    );

    // ─── A2UI Status Command ───
    context.subscriptions.push(
        vscode.commands.registerCommand('plato.showA2UIStatus', () => {
            if (eventLogger) {
                eventLogger.showStatus();
            } else {
                vscode.window.showInformationMessage('A2UI is disabled. Enable in settings.');
            }
        })
    );

    console.log('[Plato\'s Shell] Extension activated.');
}

function registerStatusBarItems(context: vscode.ExtensionContext) {
    // Room indicator
    const roomItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    roomItem.text = '$(home) Room: —';
    roomItem.tooltip = 'Current room (from SharedWorldStore)';
    roomItem.command = 'plato.refreshInspector';
    roomItem.show();
    context.subscriptions.push(roomItem);

    // Agent indicator
    const agentItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    agentItem.text = '$(person) Agent: —';
    agentItem.tooltip = 'Active NPC/Agent in current room';
    agentItem.show();
    context.subscriptions.push(agentItem);

    // A2UI indicator
    const a2uiItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    a2uiItem.text = '$(sparkle) A2UI';
    a2uiItem.tooltip = 'A2UI Learning Layer — Active';
    a2uiItem.command = 'plato.showA2UIStatus';
    a2uiItem.show();
    context.subscriptions.push(a2uiItem);

    // Store references for updates (export via globalState for other modules)
    context.globalState.update('plato.statusBar.room', roomItem);
    context.globalState.update('plato.statusBar.agent', agentItem);
}

export function deactivate() {
    eventLogger?.flush();
    console.log('[Plato\'s Shell] Extension deactivated.');
}
