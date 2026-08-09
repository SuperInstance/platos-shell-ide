/**
 * A2UI Event Logger
 * =================
 *
 * The observation layer of the A2UI (Agent-to-UI) learning system.
 * Records all user actions within the IDE to build patterns that can later
 * drive adaptive UI behavior:
 *
 * - Which verbs the user uses most → predictive verb highlighting
 * - Which files they open after playing a room → smart file navigation
 * - Which hotspots they click most → room-specific autocomplete
 * - Navigation patterns between MUD/editor/preview → workflow optimization
 * - Error patterns (failed verbs, broken hotspots) → debugging hints
 * - Timing patterns (reading time, edit time) → UI pacing
 *
 * Architecture:
 *
 *   User Action → Event Logger → Event Log (JSON)
 *                                   ↓
 *                             A2UI Model (Phase 4)
 *                                   ↓
 *                             UI Adaptation
 *                                   ↓
 *                             New User Actions
 *                                   ↓
 *                             (feedback loop)
 *
 * Phase 1: Raw logging only (this file)
 * Phase 2: Basic statistics (most-used verbs, most-visited rooms)
 * Phase 3: Local model for predictions
 * Phase 4: Full adaptive UI
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface A2UIEvent {
    type: string;
    timestamp: number;
    [key: string]: any;
}

export class EventLogger {
    private eventLog: A2UIEvent[] = [];
    private logFilePath: string;
    private flushInterval: NodeJS.Timeout | undefined;
    private readonly FLUSH_INTERVAL_MS = 10_000; // Flush every 10s
    private readonly MAX_BATCH_SIZE = 500;

    // Counters for quick status display
    private counters: Record<string, number> = {};

    constructor(private readonly context: vscode.ExtensionContext) {
        // Store event log in workspace .a2ui/ directory
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const a2uiDir = workspaceRoot
            ? path.join(workspaceRoot, '.a2ui')
            : path.join(context.globalStorageUri.fsPath, 'a2ui');

        if (!fs.existsSync(a2uiDir)) {
            fs.mkdirSync(a2uiDir, { recursive: true });
        }

        // Daily log file
        const today = new Date().toISOString().split('T')[0];
        this.logFilePath = path.join(a2uiDir, 'events-' + today + '.jsonl');
    }

    /**
     * Start the event logger.
     * Hooks into VS Code / Theia events to record user actions automatically.
     */
    start(): void {
        // ─── Editor Events ───
        vscode.window.onDidChangeActiveTextEditor(
            (editor) => {
                if (editor) {
                    this.log({
                        type: 'file_opened',
                        file: editor.document.fileName,
                        language: editor.document.languageId,
                        timestamp: Date.now()
                    });
                }
            },
            undefined,
            this.context.subscriptions
        );

        vscode.workspace.onDidSaveTextDocument(
            (doc) => {
                this.log({
                    type: 'file_saved',
                    file: doc.fileName,
                    language: doc.languageId,
                    timestamp: Date.now()
                });
            },
            undefined,
            this.context.subscriptions
        );

        // ─── Terminal Events ───
        vscode.window.onDidOpenTerminal(
            (terminal) => {
                this.log({
                    type: 'terminal_opened',
                    name: terminal.name,
                    timestamp: Date.now()
                });
            },
            undefined,
            this.context.subscriptions
        );

        // ─── Active editor changes (navigation patterns) ───
        vscode.window.onDidChangeTextEditorSelection(
            (e) => {
                // Throttle: only log significant selections (not empty cursor moves)
                const sel = e.selections[0];
                if (sel && !sel.isEmpty) {
                    this.log({
                        type: 'selection_made',
                        file: e.textEditor.document.fileName,
                        line: sel.active.line,
                        timestamp: Date.now()
                    });
                }
            },
            undefined,
            this.context.subscriptions
        );

        // ─── Periodic flush ───
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.FLUSH_INTERVAL_MS);

        // ─── Flush on deactivation ───
        this.context.subscriptions.push({
            dispose: () => this.flush()
        });
    }

    /**
     * Log an event.
     * Events are buffered in memory and flushed to disk periodically.
     */
    log(event: A2UIEvent): void {
        this.eventLog.push(event);

        // Update counters
        this.counters[event.type] = (this.counters[event.type] || 0) + 1;

        // Flush if batch is full
        if (this.eventLog.length >= this.MAX_BATCH_SIZE) {
            this.flush();
        }
    }

    /**
     * Flush buffered events to the JSONL log file.
     */
    flush(): void {
        if (this.eventLog.length === 0) return;

        const batch = [...this.eventLog];
        this.eventLog = [];

        try {
            const lines = batch.map(e => JSON.stringify(e)).join('\n') + '\n';
            fs.appendFileSync(this.logFilePath, lines);
        } catch (err) {
            console.error('[A2UI] Failed to flush events:', err);
            // Re-queue on failure
            this.eventLog.unshift(...batch);
        }
    }

    /**
     * Show current A2UI status — event counts, log file location, etc.
     */
    showStatus(): void {
        const totalEvents = Object.values(this.counters).reduce((a, b) => a + b, 0);
        const lines: string[] = [
            'A2UI Learning Layer - Status',
            '',
            'Total events logged: ' + totalEvents,
            'Log file: ' + this.logFilePath,
            '',
            'Event breakdown:'
        ];

        const sorted = Object.entries(this.counters).sort((a, b) => b[1] - a[1]);
        for (const [type, count] of sorted) {
            lines.push('  - ' + type + ': ' + count);
        }

        if (totalEvents < 10) {
            lines.push('', 'Learning just started... keep playing!');
        } else if (totalEvents < 100) {
            lines.push('', 'Patterns emerging...');
        } else {
            lines.push('', 'Rich behavioral data - predictions available.');
        }

        // Show in an output channel
        const channel = vscode.window.createOutputChannel("Plato's Shell: A2UI");
        channel.clear();
        channel.appendLine(lines.join('\n'));
        channel.show();
    }

    /**
     * Get the current event counters (for other modules to read).
     */
    getCounters(): Record<string, number> {
        return { ...this.counters };
    }

    /**
     * Get recent events of a specific type.
     */
    getRecent(type: string, limit: number = 10): A2UIEvent[] {
        return this.eventLog
            .filter(e => e.type === type)
            .slice(-limit);
    }
}
