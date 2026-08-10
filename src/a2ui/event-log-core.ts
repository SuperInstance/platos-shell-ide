/**
 * EventLog Core — the pure logic of the A2UI event logger.
 *
 * Extracted from event-logger.ts to enable testing without the
 * VS Code extension host. The EventLogger class wraps this core
 * with VS Code event hooks.
 */

import * as fs from 'fs';

export interface A2UIEvent {
    type: string;
    timestamp: number;
    [key: string]: any;
}

export class EventLogCore {
    protected eventLog: A2UIEvent[] = [];
    protected logFilePath: string;
    protected counters: Record<string, number> = {};
    protected readonly FLUSH_INTERVAL_MS = 10_000;
    protected readonly MAX_BATCH_SIZE = 500;

    constructor(logFilePath: string) {
        this.logFilePath = logFilePath;
    }

    /**
     * Log an event. Events are buffered in memory and flushed
     * to disk periodically or when the batch is full.
     */
    log(event: A2UIEvent): void {
        this.eventLog.push(event);
        this.counters[event.type] = (this.counters[event.type] || 0) + 1;

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
     * Get the current event counters.
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

    /**
     * Get total event count.
     */
    get totalEvents(): number {
        return Object.values(this.counters).reduce((a, b) => a + b, 0);
    }

    /**
     * Get buffered event count (not yet flushed).
     */
    get bufferedCount(): number {
        return this.eventLog.length;
    }
}
